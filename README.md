<p align="center">
  <img src="./public/wordmarks/dexter-wordmark.svg" alt="Dexter wordmark" width="360">
</p>

<p align="center">
  <a href="https://nodejs.org/en/download"><img src="https://img.shields.io/badge/node-%3E=20.0-green.svg" alt="Node >= 20"></a>
  <a href="https://mcp.dexter.cash/mcp"><img src="https://img.shields.io/badge/MCP-https%3A%2F%2Fmcp.dexter.cash%2Fmcp-blue.svg" alt="MCP endpoint"></a>
  <a href="https://dexter.cash"><img src="https://img.shields.io/badge/stack-Dexter%20Connectors-purple.svg" alt="Dexter connectors"></a>
</p>

<p align="center">
  <a href="https://github.com/BranchManager69/dexter-api">Dexter API</a>
  · <a href="https://github.com/BranchManager69/dexter-fe">Dexter FE</a>
  · <strong>Dexter MCP</strong>
  · <a href="https://github.com/BranchManager69/dexter-ops">Dexter Ops</a>
  · <a href="https://github.com/BranchManager69/pumpstreams">PumpStreams</a>
</p>

Fully managed Model Context Protocol (MCP) bridge for Dexter. The service exposes a curated set of connector tools (wallet resolution, diagnostics, session overrides) over both stdio and HTTPS, reusing the Dexter OAuth infrastructure for user-level access control.

---

## Highlights

- **Production-ready HTTP transport** – OAuth2/OIDC, bearer fallback, SSE streaming, and metadata endpoints compatible with Claude & ChatGPT connectors.
- **Wallet-first toolset** – `resolve_wallet`, `list_my_wallets`, `auth_info`, `set_session_wallet_override`, plus per-session overrides backed by Supabase.
- **Composable tool registry** – drop new bundles into `toolsets/`, enable them via env, CLI flags, or `?tools=` query parameters.
- **Dual-runtime** – stdio entrypoint for local agents & Codex, HTTPS entrypoint for public connectors (proxied at `https://dexter.cash/mcp` and `https://mcp.dexter.cash/mcp`).
- **Supabase-native auth** – validates incoming tokens through Dexter API/Supabase resolver, injects identity headers for downstream tools, and preserves token caching to limit IdP calls.

---

## Access Tiers

| Label | Who can call | Notes | Examples |
|-------|--------------|-------|----------|
| `guest` | Shared demo bearer (`TOKEN_AI_MCP_TOKEN`), no login required | Backed by the communal managed wallet; live trading is enabled so prospects can try buys/sells immediately. | `solana_*`, `wallet/resolve_wallet`, `wallet/list_my_wallets`, `general/search`, `pumpstream_live_summary` |
| `member` | Authenticated Supabase session / `dexter_mcp_jwt` | Uses the user-specific resolver wallet and unlocks session overrides. | `wallet/set_session_wallet_override` |
| `pro` | Role-gated (Pro or Super Admin) | Calls Supabase to verify `pro`/`superadmin` before running. | `stream_get_scene`, `stream_set_scene` |
| `dev` | Super Admins only | Protected experimental surfaces. | `codex_*` |
| `internal` | Diagnostic tooling | Not exposed to end users. | `wallet/auth_info` |

Guest/demo/member terminology maps to marketing: the shared bearer is a full managed wallet so prospects experience real trades without creating an account, while member-tier tools expect the per-user wallet provisioned at signup.

---

## Dexter Stack

| Repo | Role |
|------|------|
| [`dexter-api`](https://github.com/BranchManager69/dexter-api) | Issues realtime tokens, proxies MCP, x402 billing |
| [`dexter-fe`](https://github.com/BranchManager69/dexter-fe) | Next.js frontend for voice/chat surfaces |
| [`dexter-ops`](https://github.com/BranchManager69/dexter-ops) | Shared operations scripts, PM2 config, nginx templates |
| [`pumpstreams`](https://github.com/BranchManager69/pumpstreams) | Pump.fun analytics suite (adjacent tooling) |

---

## Quick Start

```bash
git clone https://github.com/BranchManager69/dexter-mcp.git
cd dexter-mcp
npm install
cp .env.example .env

# populate .env with Supabase + OAuth settings (see Configuration)

# HTTPS transport (port 3930)
npm start

# or stdio transport for local tools
node server.mjs --tools=wallet
```

Verify the HTTP transport:

```bash
curl -sS http://localhost:3930/mcp/health | jq
```

With the public proxy in place you can also query:

```bash
curl -H "Authorization: Bearer <TOKEN_AI_MCP_TOKEN>" \
     https://mcp.dexter.cash/mcp/health
```

---

## Authentication

| Mode | When to use | How |
|------|-------------|-----|
| **OAuth2 / OIDC** | Claude, ChatGPT, hosted connectors | Set `TOKEN_AI_MCP_OAUTH=true` and supply `TOKEN_AI_OIDC_*` (or Supabase) endpoints. Users sign in via the Dexter IdP; tokens are validated on every session. |
| **Bearer token** | Service-to-service calls, Codex, Cursor | Define `TOKEN_AI_MCP_TOKEN`. Any request presenting the matching `Authorization: Bearer …` header is accepted without hitting the IdP. |
| **Allow-any (demo)** | Local demos only | Set `TOKEN_AI_MCP_OAUTH_ALLOW_ANY=1`. Skips verification—**never enable in production**. |

Metadata endpoints (for connector discovery) are exposed at:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`
- `/.well-known/openid-configuration`

These routes are proxied on both `dexter.cash` and `mcp.dexter.cash`, so connectors can follow the same issuer regardless of which hostname they use.

---

## Toolsets

Tool bundles live under `toolsets/<name>/index.mjs` and register themselves through the manifest in `toolsets/index.mjs`.

Currently shipped:

- **general** – Static `search` / `fetch` helpers that surface curated Dexter OAuth + connector docs.
- **pumpstream** – `pumpstream_live_summary` wrapper for `https://pump.dexter.cash/api/live` with paging, search, and filter controls.
- **wallet** – Supabase-backed wallet resolution, diagnostics, and per-session overrides (used by all Dexter connectors).
- **solana** – Token resolution, portfolio balances, and managed-wallet buy/sell execution (proxied through `dexter-api`).
- **markets** – Birdeye pair-backed OHLCV retrieval for plotting price history lines (auto-selects top pair when only a mint is provided).
- **twitter** – Session-backed Twitter search via Playwright (multi-query presets, optional language/reply filters, media-only + verified-only toggles, enriched author metadata).

Each tool definition exposes an `_meta` block so downstream clients can group or gate consistently:

```json
{
  "name": "solana_execute_buy",
  "title": "Execute Buy",
  "description": "Buy a token using SOL from a managed wallet.",
  "_meta": {
    "category": "solana.trading",
    "access": "managed",
    "tags": ["buy", "execution"]
  }
}
```

- `category` – high-level grouping for UX (e.g. `wallets`, `analytics`, `solana.trading`).
- `access` – current entitlement level (`public`, `free`, `pro`, `managed`, `internal`).
- `tags` – free-form labels for filtering/badging.

The `/tools` API simply relays this metadata so UIs (including `dexter-fe`) pick it up automatically. Add new values conservatively and document them if third-party clients depend on them.

Selection options:

- **Environment default:** leave `TOKEN_AI_MCP_TOOLSETS` unset to load every registered bundle (`general,pumpstream,wallet`). Set it (comma-separated) to restrict the selection, e.g. `TOKEN_AI_MCP_TOOLSETS=wallet`.
- **CLI/stdio:** `node server.mjs --tools=wallet`.
- **HTTP query:** `POST /mcp?tools=wallet`.
- **Codex:** set `TOKEN_AI_MCP_TOOLSETS` in the env before launching, or add `includeToolsets` when invoking `buildMcpServer` manually.

Legacy Token-AI bundles remain in `legacy-tools/` for reference. They are not registered by default but can be migrated into `toolsets/` as they are modernized.

---

## Configuration Reference

Populate `.env` (or inject via process manager) with at least:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` | Supabase project credentials used by the wallet resolver. |
| `DEXTER_API_BASE_URL` | Dexter API base URL (e.g. `https://api.dexter.cash`). Wallet resolver requests are routed through this API. |
| `BIRDEYE_API_KEY` | Required for `markets_fetch_ohlcv`; Birdeye public API key used for OHLCV candles. |
| `BIRDEYE_DEFAULT_CHAIN` | Optional default chain header for Birdeye calls (defaults to `solana`). |
| `TWITTER_SESSION_PATH` | Absolute path to the Playwright storageState JSON for the logged-in X session (required for `twitter_search`). |
| `TWITTER_PROFILE_LOOKUP_LIMIT` | Max profiles per search (default 10) enriched for metadata. Optional. |
| `TOKEN_AI_MCP_PUBLIC_URL`, `TOKEN_AI_MCP_PORT` | Public HTTPS URL + bind port for the HTTP transport. |
| `MCP_JWT_SECRET` | HS256 secret used to validate per-user Dexter MCP JWTs from dexter-api. When set, Authorization: Bearer <dexter_mcp_jwt> is accepted. |
| `TOKEN_AI_OIDC_*` | External IdP endpoints when `TOKEN_AI_MCP_OAUTH=true` (authorization, token, userinfo, issuer, JWKS, scopes, client ID). |
| `TOKEN_AI_MCP_TOKEN` | Optional static bearer for service-to-service access. |
| `TOKEN_AI_MCP_TOOLSETS` | Comma-separated list of toolsets to auto-load. Defaults to all registered sets. |
| `TOKEN_AI_MCP_CORS` | Allowed origin(s) for HTTP transport (default `*`). |

StdIO launches also load environment files from the repo root and `token-ai/.env`, so shared secrets can be stored once and reused across services.

---

## Development & PM2

Run locally:

```bash
# HTTP transport with auto-reload (e.g. via nodemon)
TOKEN_AI_MCP_PORT=3930 npm start

# Stdio session for quick manual tests
node server.mjs --tools=wallet

# Connect with Codex (bearer token example)
# ~/.codex/config.toml
# [mcp_servers.dexter]
# transport = "http"
# url = "https://mcp.dexter.cash/mcp"
# headers = { Authorization = "Bearer <TOKEN_AI_MCP_TOKEN>" }
```

### Harness smoke (API default)

The helper script can exercise the new pagination either through the Playwright UI flow or directly via the MCP API:

```bash
# API only (default)
npm run test:pumpstream -- --page-size 5 --json --no-artifact

# UI only (optional)
export HARNESS_COOKIE='cf_clearance=...; sb-xyz-auth-token=...; sb-xyz-refresh-token=...'
npm run test:pumpstream -- --mode ui --headful --prompt "List pump streams"

# API only (no browser)
export HARNESS_MCP_TOKEN='Bearer <mcp bearer>'   # if session response redacts the header
export HARNESS_SESSION_URL='https://api.dexter.cash/realtime/sessions'  # optional override
npm run test:pumpstream -- --mode api --page-size 10 --json --no-artifact
```

The harness auto-loads `.env`, so you can keep `HARNESS_COOKIE`, `HARNESS_AUTHORIZATION`, `HARNESS_MCP_TOKEN`, and other overrides there instead of exporting them per run (see `.env.example`). Default mode is API-only; when you explicitly run `--mode both`, the script still executes API mode even if UI credentials are missing or the Playwright run fails—it logs the UI error and continues.

Flags (`--prompt`, `--url`, `--wait`, `--headful`, `--no-artifact`, `--json`, `--mode`, `--page-size`) are forwarded to the underlying runners. UI mode requires a fresh Supabase session (`HARNESS_COOKIE` or `HARNESS_AUTHORIZATION`). API mode falls back to guest sessions but can reuse the same cookies/headers to hop past Cloudflare; if the session payload redacts the MCP header, provide `HARNESS_MCP_TOKEN` (or reuse `TOKEN_AI_MCP_TOKEN`).

For production, PM2 is managed through `dexter-ops/ops/ecosystem.config.cjs`. The config already forwards `TOKEN_AI_MCP_OAUTH=true` and supporting variables; restart via:

```bash
pm2 restart dexter-mcp
pm2 logs dexter-mcp
```

### Session Maintenance Cheatsheet

```
Turnstile + Supabase login (desktop helper)
           │  generates encoded cookie + state.json
           ▼
HARNESS_COOKIE in repos (.env)
           │  injected into Playwright runs
           ▼
Dexchat / pumpstream harness executions
```

| Situation | Run this | Result |
|-----------|----------|--------|
| Have a new encoded cookie string | `dexchat refresh` (in `dexter-agents`) | Updates both repos’ `.env` files and rewrites `~/websites/dexter-mcp/state.json` through a local Playwright run. |
| Want a scripted variant | `npm run dexchat:refresh -- --cookie $(cat cookie.txt)` | Same as above without the interactive prompt. |
| Supabase session has expired / cookie immediately fails | `refresh-supabase-session.ps1` (desktop helper) | Spins up SOCKS proxy + Chrome for Turnstile + Supabase login, prints the cookie, and can refresh storage automatically. Afterwards run `dexchat refresh` with the new value. |
| Validate guest behaviour | `npm run dexchat -- --prompt "..." --guest` (or add `--guest` to `npm run pumpstream:harness ...`) | Runs the UI anonymously while the API leg reuses the shared demo bearer (`TOKEN_AI_MCP_TOKEN`). |

Remember: the desktop helper is rare (weeks between runs). `dexchat refresh` is the lightweight, local option you’ll use most often. Additional command details live in `dexter-agents/scripts/README.md`.

---

## Architecture Notes

- **`common.mjs`** – builds the MCP server, normalizes Zod schemas, wraps tool registration with logging.
- **`toolsets/`** – declarative manifest of tool bundles plus the wallet toolset implementation.
- **Toolset authoring guide:** see `toolsets/ADDING_TOOLSETS.md` for step-by-step instructions and examples (including the `pumpstream` toolset).
- **`server.mjs`** – stdio entrypoint (used by local agents and Codex); respects `--tools=` flags.
- **`dexter-mcp-stdio-bridge.mjs`** – bridges stdio clients to the hosted OAuth HTTP transport (handy for Codex/Cursor when they only support stdio).
- **`http-server-oauth.mjs`** – HTTPS transport with OAuth/OIDC, session caching, and metadata routes (still contains a Prisma-backed fallback to seed per-session wallet overrides).
- **`legacy-tools/`** – archived Token-AI tools kept for reference during migration.

Supabase interactions flow through Dexter API helpers for consistent auth enforcement. The only remaining Prisma access is the wallet-override seeding noted above; retire it when the resolver exposes a "default wallet" flag.

---

## Related Repositories

- [dexter-api](../dexter-api) – OAuth issuer, wallet resolver, and connector orchestration.
- [dexter-fe](../dexter-fe) – Web frontend (Claude/ChatGPT connector auth, realtime demos).
- [pumpstreams](../pumpstreams) – Monitoring suite that inspired this README structure.

---

## License

Private – internal Dexter connector infrastructure.
