<p align="center">
  <img src="https://raw.githubusercontent.com/Dexter-DAO/dexter-x402-sdk/main/assets/dexter-wordmark.svg" alt="Dexter" width="360">
</p>

<h1 align="center">@dexterai/opendexter</h1>

<p align="center">
  <strong>x402 gateway for AI agents. Search, pay, and call any paid API.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dexterai/opendexter"><img src="https://img.shields.io/npm/v/@dexterai/opendexter.svg" alt="npm"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E=18-brightgreen.svg" alt="Node"></a>
  <a href="https://dexter.cash/opendexter"><img src="https://img.shields.io/badge/Marketplace-dexter.cash-blueviolet" alt="Marketplace"></a>
</p>

<p align="center">
  <a href="https://dexter.cash/opendexter"><strong>Browse paid APIs →</strong></a>
</p>

---

## What is x402?

[x402](https://x402.org) is an open protocol for machine-to-machine payments over HTTP. When an API returns `402 Payment Required`, it includes payment instructions. The client pays (USDC on Solana, Base, or other chains), and the API delivers the response. No API keys, no subscriptions, no invoices. Dexter operates the most-used x402 facilitator, processing millions of settlements.

---

## Install

```bash
npx @dexterai/opendexter install
```

Supports **Cursor**, **Claude Code**, **Codex**, **VS Code**, **Windsurf**, and **Gemini CLI**.

The installer creates a local Solana wallet at `~/.dexterai-mcp/wallet.json` and writes the MCP config for your client. Fund the wallet with USDC and your agent can start paying for APIs from your own machine.

**Claude Code** gets full plugin support: the installer registers 7 skills (opendexter, x402-client, x402-server, x402-react, x402-protocol, x402-marketplace, x402-debugging) as a native Claude Code plugin alongside the MCP server. Your agent gets both live tools and deep SDK knowledge in a single install.

## Fastest Start

If you want the cleanest first-run flow, use:

```bash
npx @dexterai/opendexter setup
```

`setup`:

1. creates or loads your local Solana + EVM wallet
2. detects supported AI clients already installed on your machine
3. installs OpenDexter into all detected clients at once
4. shows live settlement rails and the funding path if your treasury is empty
5. prints the fastest first-use workflow (`search` → `check` → `fetch`)

If you already know exactly which client you want, `install` is still the narrower option. If you just want to get moving quickly, use `setup`.

### Install Into All Detected Clients

```bash
npx @dexterai/opendexter install --all
```

This scans your machine for supported MCP clients and installs OpenDexter into every one it finds.

### Manual Configuration

**Cursor** — `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "dexter-x402": {
      "command": "npx",
      "args": ["-y", "@dexterai/opendexter@latest"]
    }
  }
}
```

**Claude Code** — use the installer instead of manual config. It registers the MCP server and installs 7 SDK/protocol skills as a native plugin:

```bash
npx @dexterai/opendexter install --client claude-code
```

Manual MCP-only (no skills): `claude mcp add dexter-x402 -- npx -y @dexterai/opendexter@latest`

**Codex** — `~/.codex/config.toml`:

```toml
[mcp_servers.dexter-x402]
command = "npx"
args = ["-y", "@dexterai/opendexter@latest"]
```

---

## Tools

### `x402_search`

Semantic capability search over the [Dexter x402 marketplace](https://dexter.cash/opendexter). Pass a natural-language query and get back two tiers: **strong matches** (high-confidence capability hits) and **related matches** (adjacent services that cleared the similarity floor). Handles synonym expansion, filters by similarity threshold, and applies a cross-encoder LLM rerank to the top strong results.

```
"Find an image generation API"
→ x402_search(query: "generate an image")

"Get the current ETH price"
→ x402_search(query: "ETH spot price feed")

"Check wallet balances on Base"
→ x402_search(query: "check wallet balance on Base")
```

| Param | Type | Description |
|-------|------|-------------|
| `query` | string | Natural-language description of the capability you want. Don't pre-filter by chain or category — the search layer handles expansion and ranking. |
| `limit` | number | Max results across strong + related tiers combined (1–50, default 20) |
| `unverified` | boolean | Include unverified resources (default false) |
| `testnets` | boolean | Include testnet-only resources (default false) |
| `rerank` | boolean | Cross-encoder LLM rerank of top strong results (default true). Set false for deterministic order or lowest-latency path. |

**Response shape.** Each result has a `tier` (`"strong"` or `"related"`), a raw `similarity` score (0–1), and a `why` string that explains the ranking factors. Strong matches come with LLM-reordering when `rerank` is on. If nothing clears the similarity floor, `noMatchReason` tells you whether the corpus has zero candidates or just no strong hits.

---

### `x402_fetch`

Call any x402-protected API with automatic payment. The MCP detects the 402 response, signs a USDC payment with your local wallet, and retries the request — returning the API response directly.

Works with any x402 seller, not just Dexter endpoints:

```
"Get a Jupiter DEX quote for 1 SOL to USDC"
→ x402_fetch("https://x402.dexter.cash/api/jupiter/quote?inputMint=So11...&amount=1000000000")
→ Pays $0.05, returns the full quote with route plan

"Generate an image of a robot trading crypto"
→ x402_fetch("https://api.xona-agent.com/image-model/seedream-4.5", method: "POST", body: '{"prompt":"a robot trading crypto"}')
→ Pays $0.08 to Xona Agent, returns the image URL
```

| Param | Type | Description |
|-------|------|-------------|
| `url` | string | The x402 resource URL |
| `method` | string | `GET` `POST` `PUT` `DELETE` — default `GET` |
| `body` | string | JSON request body for POST/PUT |

Response includes the API data plus on-chain settlement proof:

```json
{
  "status": 200,
  "data": { "...API response..." },
  "payment": {
    "settled": true,
    "details": {
      "transaction": "Djo6aA9SXFx...",
      "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      "payer": "2SB3VTnjrct..."
    }
  }
}
```

---

### `x402_pay`

Alias of `x402_fetch` for clients that want an explicit payment verb.

Use it when you want the model or user flow to think in terms of:

1. discover
2. inspect
3. pay and call

The request schema and settlement behavior are the same as `x402_fetch`.

---

### `x402_access`

Access identity-gated endpoints using a wallet proof instead of a payment.

Use this when:

1. an endpoint requires Sign-In-With-X or wallet authentication
2. the provider wants proof of wallet control rather than an immediate paid call
3. `x402_check` or marketplace metadata tells you the endpoint is auth-gated

```bash
npx @dexterai/opendexter access "https://x402.quicknode.com/base-mainnet"
```

This is separate from `x402_fetch` on purpose:

- `x402_fetch` = pay and call
- `x402_access` = prove wallet ownership and access

---

### `x402_check`

Probe an endpoint to see its pricing and payment options without spending anything. Returns the full 402 requirements including price per chain, accepted assets, and input/output schemas when available.

```
"How much does this API cost?"
→ x402_check("https://x402.dexter.cash/api/v2-test", method: "POST")
→ $0.01 USDC on Solana, $0.01 USDC on Base
```

| Param | Type | Description |
|-------|------|-------------|
| `url` | string | The URL to check |
| `method` | string | `GET` `POST` `PUT` `DELETE` — default `GET` |

---

### `x402_wallet`

Show wallet addresses (Solana + EVM), USDC balances across all supported chains, and deposit instructions. If the wallet has no USDC, returns funding tips.

```json
{
  "address": "2SB3VTnjrct9ayYCsQ4Fi5C5vNVpwL8X8RYUQoaPNZGh",
  "solanaAddress": "2SB3VTnjrct9ayYCsQ4Fi5C5vNVpwL8X8RYUQoaPNZGh",
  "evmAddress": "0x1234...abcd",
  "network": "multichain",
  "chainBalances": {
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": { "available": "940000", "name": "Solana", "tier": "first" },
    "eip155:8453": { "available": "0", "name": "Base", "tier": "first" }
  },
  "balances": { "usdc": 0.94, "fundedAtomic": "940000", "availableAtomic": "940000" },
  "supportedNetworks": ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "eip155:8453", "eip155:137", "eip155:42161", "eip155:10", "eip155:43114"],
  "walletFile": "~/.dexterai-mcp/wallet.json"
}
```

---

### Vanity Wallets

If you want a more recognizable wallet identity, you can mint a vanity address locally:

```bash
# guided presets
npx @dexterai/opendexter wallet --vanity

# direct prefixes
npx @dexterai/opendexter wallet --vanity --solana-prefix Dex
npx @dexterai/opendexter wallet --vanity --evm-prefix 402dd
```

OpenDexter uses the generated wallet for future local payments. This is optional — `setup` stays fast and operational even if you skip vanity generation.

---

## CLI

Every tool is also available as a standalone command:

```bash
npx @dexterai/opendexter wallet
npx @dexterai/opendexter setup
npx @dexterai/opendexter wallet --vanity
npx @dexterai/opendexter search "token analysis"
npx @dexterai/opendexter check "https://x402.dexter.cash/api/v2-test"
npx @dexterai/opendexter access "https://x402.quicknode.com/base-mainnet"
npx @dexterai/opendexter settings --max-amount 2.50
npx @dexterai/opendexter fetch "https://x402.dexter.cash/api/v2-test" --method POST
```

---

## Wallet

A dual Solana + EVM wallet stored at `~/.dexterai-mcp/wallet.json` with `600` permissions. Private keys never leave your machine.

Override with environment variables:

```bash
export DEXTER_PRIVATE_KEY="your-solana-base58-private-key"
export EVM_PRIVATE_KEY="0x-prefixed-hex-private-key"
```

`SOLANA_PRIVATE_KEY` is also accepted for the Solana key. Env vars take priority over the wallet file. Existing Solana-only wallet files are automatically upgraded with an EVM keypair on first load.

---

## Payment Model

`@dexterai/opendexter` is the **local-wallet** OpenDexter surface:

- transport: local stdio MCP server
- signer: dual Solana + EVM wallet file, or `DEXTER_PRIVATE_KEY` / `EVM_PRIVATE_KEY` env vars
- chains: Solana, Base, Polygon, Arbitrum, Optimism, Avalanche
- best for: Cursor, Codex, Claude Code, CLI agents, and local workflows

If you want a no-install hosted flow with session wallets, use `OpenDexter MCP` at `https://open.dexter.cash/mcp`.

## Supported Chains

| Chain | Network ID | Local signing status |
|-------|------------|----------------------|
| Solana | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Local wallet signing + balance queries |
| Base | `eip155:8453` | Local wallet signing + balance queries |
| Polygon | `eip155:137` | Local wallet signing + balance queries |
| Arbitrum | `eip155:42161` | Local wallet signing + balance queries |
| Optimism | `eip155:10` | Local wallet signing + balance queries |
| Avalanche | `eip155:43114` | Local wallet signing + balance queries |

The local wallet generates both a Solana keypair and an EVM private key. `@dexterai/x402` handles chain detection and signing automatically — when a 402 response specifies an EVM chain, the SDK signs with your EVM key; for Solana endpoints, it signs with the Solana keypair.

---

## Spend Controls

OpenDexter supports a persistent default max spend per paid call.

```bash
# read current settings
npx @dexterai/opendexter settings

# set a new default cap
npx @dexterai/opendexter settings --max-amount 2.50

# override for one call only
npx @dexterai/opendexter fetch "https://x402.dexter.cash/api/v2-test" --method POST --max-amount 10
```

If an endpoint requests more than your configured max, OpenDexter rejects the payment before signing and tells you why. It also checks that you have enough balance on a compatible rail before attempting settlement.

---

## Links

- [Dexter Marketplace](https://dexter.cash/opendexter)
- [Dexter Facilitator](https://x402.dexter.cash)
- [@dexterai/x402 SDK](https://www.npmjs.com/package/@dexterai/x402)
- [x402 Protocol](https://x402.org)
- [Twitter](https://twitter.com/dexteraisol)
- [Telegram](https://t.me/dexterdao)
- [Become a Seller](https://dexter.cash/onboard)

## License

MIT
