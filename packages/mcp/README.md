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

**Claude Code:**

```bash
claude mcp add dexter-x402 -- npx -y @dexterai/opendexter@latest
```

**Codex** — `~/.codex/config.toml`:

```toml
[mcp_servers.dexter-x402]
command = "npx"
args = ["-y", "@dexterai/opendexter@latest"]
```

---

## Tools

### `x402_search`

Search the [Dexter Marketplace](https://dexter.cash/opendexter) for paid API resources. Returns pricing, quality scores, verification status, seller reputation, and call volume.

```
"Find image generation APIs under $0.10"
→ x402_search(query: "image generation", maxPriceUsdc: 0.10)

"What DeFi tools are available on Solana?"
→ x402_search(category: "DeFi", network: "solana")
```

| Param | Type | Description |
|-------|------|-------------|
| `query` | string | Search term |
| `category` | string | `"AI"`, `"DeFi"`, `"Data"`, `"Tools"`, `"Games"`, `"Creative"` |
| `network` | string | `"solana"`, `"base"`, `"polygon"` |
| `maxPriceUsdc` | number | Maximum price per call |
| `verifiedOnly` | boolean | Only quality-checked endpoints |
| `sort` | string | `"marketplace"` (default) `"relevance"` `"quality_score"` `"settlements"` `"volume"` `"recent"` |
| `limit` | number | 1–50, default 20 |

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

## CLI

Every tool is also available as a standalone command:

```bash
npx @dexterai/opendexter wallet
npx @dexterai/opendexter search "token analysis"
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
