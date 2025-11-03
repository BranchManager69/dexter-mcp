# Hyperliquid Integration – Developer Notes

This companion doc explains how the Hyperliquid toolset works under the hood so you can extend or operate it confidently. Pair with `HYPERLIQUID_USER.md` for the user-facing view.

---

## High-Level Architecture

```
Dexter MCP Toolset (hyperliquid/*.mjs)
        │
        ▼
Dexter API (routes/hyperliquid.ts)
        │
        ├── services/hyperliquid/wallets.ts      # agent provisioning & keys
        ├── services/hyperliquid/trading.ts      # order placement + position writes
        ├── services/hyperliquid/ledger.ts       # balance + ledger mutations
        ├── services/hyperliquid/markets.ts      # symbol cache
        ├── services/hyperliquid/account.ts      # equity snapshots
        └── tasks/*                              # rotation, reconcile, payouts
        │
        ▼
Hyperliquid exchange API + Solana treasury
```

MCP tools simply wrap HTTP routes; the heavy lifting (rotating agents, reconciling fills, funding, withdrawals) lives in the API service.

---

## MCP Toolset (dexter-mcp/toolsets/hyperliquid)

| Tool | Endpoint | Notes |
| --- | --- | --- |
| `hyperliquid_markets` | `GET /hyperliquid/markets` | No payload. Requires bearer token in headers for pro access. |
| `hyperliquid_opt_in` | `POST /hyperliquid/opt-in` | Body: `{ managedWalletPublicKey?, agentName? }`. Validates lengths; concierge usually supplies the wallet if omitted. |
| `hyperliquid_perp_trade` | `POST /hyperliquid/perp-trade` | Body includes size, symbol, limit/market flags, TP/SL, leverage. Schema mirrors server-side validation. |

Implementation highlights:
- `resolveApiBase()` reads `HYPERLIQUID_API_BASE_URL` → `API_BASE_URL` → `DEXTER_API_BASE_URL` → defaults to `http://localhost:3030`.
- `extractAuthorization()` pulls any existing auth header off the MCP request context so agent sessions inherit the user token.
- `fetchWithX402Json` adds telemetry (`metadata.tool`, `authHeaders`) and handles JSON parsing; you only need to throw when `response.ok` is false.

---

## Key API Components

### Routes (`src/routes/hyperliquid.ts`)
- **Opt-in** resolves a managed wallet, provisions an agent via `provisionHyperliquidAgent`, stores agent metadata, returns to client.
- **Markets** just proxies the cached symbol list (`fetchHyperliquidMarkets(env)`).
- **Balance** aggregates: `getPerpBalance`, latest ledger entries, managed wallets, active agents, recent positions.
- **Withdrawals** create/settle/claim using ledger helpers.
- **Perp trade** orchestrates validation, symbol check, mid-price lookup (if needed), notional reservation, order placement, $1 fee entry, and release-on-failure.
- **Admin overview** surfaces aggregated balances, optional live equity (calls `fetchHyperliquidEquity` per wallet), plus pending withdrawals.
- **Admin withdrawals** is a paginated list endpoint.

All admin routes require `requireSuperAdmin` (post-hardening, they inspect `app_metadata.roles` only).

### Services
- **wallets.ts**
  - `resolveMasterWallet` decrypts managed wallet key material, merges metadata overrides (`metadata.hyperliquid.masterAddress`), and returns final address/private key.
  - `provisionHyperliquidAgent` checks for existing active agents, rotates if needed, approves the agent on Hyperliquid via `client.exchange.approveAgent`, encrypts the agent key, sets TTL, and stores metadata/nonce.
- **trading.ts**
  - `placePerpTrade` uses a per-agent queue (`walletQueues`) to serialize orders, builds the Hyperliquid request (`exchange.placeOrder`), optionally submits TP/SL triggers, stores position/metadata, increments nonce.
- **ledger.ts**
  - Handles all balance mutations in transactions. Key functions: `reservePerpNotional`, `releasePerpNotional`, `recordPerpFee`, `recordPerpFunding`, `createPerpWithdrawalRequest`, `updatePerpWithdrawalStatus`.
- **account.ts**
  - `fetchHyperliquidEquity` reads portfolio snapshots (`info.portfolio`) and derives `freeEquity = accountValue - totalMarginUsed`.
- **markets.ts**
  - Fetches `metaAndAssetCtxs` via POST, caches uppercase symbols for 5 minutes, gracefully falls back to `['BTC-PERP','ETH-PERP','SOL-PERP']` on failure.
- **pnl.ts**
  - `computeRealizedPnlFromFills` (running average cost, handles direction flips) used during reconciliation.

### Background Tasks
- `startHyperliquidRotationLoop` – polls agents near `valid_until`, reuses `provisionHyperliquidAgent`, marks old agents `retired`.
- `startHyperliquidReconcileLoop` – for each active agent, syncs fills, positions, open orders, funding; updates ledger (`releasePerpNotional`, `recordPerpFunding`), metadata, and `valid_until`.
- `startPerpWithdrawalWorker` – automatically pays `ready` withdrawals via Solana SPL transfer and updates status to `paid`.

---

## Environment Variables of Interest

| Variable | Where used | Purpose |
| --- | --- | --- |
| `HYPERLIQUID_API_BASE` | API + MCP (derives testnet flag) | Exchange REST/WebSocket base. |
| `HYPERLIQUID_MASTER_ADDRESS` | wallets.ts | Optional override for master address per env. |
| `HYPERLIQUID_MAX_TTL_DAYS`, `HYPERLIQUID_ROTATION_THRESHOLD_DAYS`, `HYPERLIQUID_INFO_POLL_INTERVAL_MS` | Rotation & reconcile loops | Controls agent rotation cadence and poll intervals. |
| `PERP_USER_MAX_NOTIONAL_USD`, `PERP_GLOBAL_EQUITY_BUFFER_USD`, `PERP_ORDER_RATE_LIMIT_PER_MINUTE` | Route + ledger | Risk limits for users/trades. |
| `PERP_TREASURY_WALLET_PUBLIC_KEY`, `CONNECTOR_REWARD_MANAGED_WALLET` | Withdrawal worker | Treasury source for payouts. |
| `X402_ASSET_MINT`, `X402_ASSET_DECIMALS` | Withdrawal worker | Token mint and decimals for SPL payouts. |

Remember to mirror env changes in `.env.example` whenever new variables become required.

---

## Data & Storage

- **Prisma tables** (see `prisma/migrations/20251102_add_hyperliquid_tables`):
  - `hyperliquid_wallets` – agent wallet metadata & encrypted private key.
  - `hyperliquid_positions` – open/protected/closed positions with raw payloads and reserved notional tracking.
  - `hyperliquid_fills` – historical fills keyed by `fill_id`/`order_id`.
  - `user_perp_balances`, `user_perp_ledger`, `user_perp_withdrawals` – user-level accounting/ledger.
- **Supabase auth** – roles come from `app_metadata.roles`. No user-metadata fallbacks remain after recent hardening.

---

## Extending or Debugging

- **Add a new tool?** Implement the API route first, then expose it in `toolsets/hyperliquid/index.mjs` with a zod schema, metadata, and `fetchWithX402Json`.
- **Need live price data in MCP?** Reuse `hyperliquid_markets` to ensure symbols stay canonical, then add a new route that proxies `client.info.getAllMids` and cache it server side.
- **Troubleshoot a trade** – check `hyperliquid_positions.raw_position` for the recorded request/response, confirm ledger entries via `user_perp_ledger`, inspect CloudWatch/PM2 logs (`routes.hyperliquid`, `hyperliquid.trade`).
- **Rebinding wallets** – update `managed_wallets.metadata.hyperliquid.masterAddress` if the exchange introduces a new master address. Rotation and reconcile loops will pick it up automatically.

---

## Related Tasks & Tests

- Background workers start in `src/app.ts` (`startHyperliquidRotationLoop`, `startHyperliquidReconcileLoop`, `startPerpWithdrawalWorker`).
- Tests:
  - `tests/hyperliquid.pnl.test.ts` – verifies PnL math.
  - `tests/hyperliquid.routes.test.ts` – exercises opt-in/trade flows (update when schemas change).

---

Questions or planning upstream changes? Drop a note in the #hyperliquid-dev channel with the route/service you’re touching so reconciliation and tooling owners can review.***
