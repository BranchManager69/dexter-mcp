---
name: opendexter
description: "Use @dexterai/opendexter to search, price-check, and pay for any x402 API. Trigger this skill whenever the user wants to find paid APIs, call an x402 endpoint, check pricing, see their wallet balance, or do anything involving x402 payments, paid APIs, USDC payments for APIs, the Dexter marketplace, or agent commerce. Also trigger when the user mentions x402, OpenDexter, paid APIs, or wants to call a paid service."
---

# OpenDexter — x402 Search Engine for AI Agents

OpenDexter gives you access to the largest marketplace of paid x402 APIs. Search 5,000+ endpoints across Solana and EVM chains, preview pricing, and call any of them with automatic USDC settlement.

Your wallet is local at `~/.dexterai-mcp/wallet.json`. Fund it with USDC and payments happen automatically. Override with `DEXTER_PRIVATE_KEY` or `SOLANA_PRIVATE_KEY` env vars.

## Tools

Use them in this order for the best experience:

### 1. `x402_search` — Find APIs

Always start here. Semantic capability search over the marketplace — pass a natural-language query and get back tiered results (strong matches + related matches) ranked by quality, usage, and reputation.

| Param | Type | Description |
|-------|------|-------------|
| `query` | string | Natural-language description of what you want. e.g. "check wallet balance on Base", "generate an image", "ETH price feed" |
| `limit` | number | Max results across strong + related tiers (1-50, default 20) |
| `unverified` | boolean | Include unverified resources (default false) |
| `testnets` | boolean | Include testnet-only resources (default false) |
| `rerank` | boolean | Cross-encoder LLM rerank of top results (default true). Set false for deterministic order. |

Results include two tiers: `strongResults` (high-confidence capability hits) and `relatedResults` (adjacent services). Each result has: name, URL, price, network, qualityScore (0-100), verified status, host, tier, similarity, why (ranking explanation), and chains[] with every payment option.

Do NOT pre-filter by chain or category — the search layer handles synonym expansion and ranking internally.

### 2. `x402_check` — Preview Pricing

Probes the endpoint and returns payment options per chain without paying. Shows what it'll cost before committing.

| Param | Type | Description |
|-------|------|-------------|
| `url` | string | The URL to check |
| `method` | string | GET, POST, PUT, DELETE (default GET) |

If the endpoint is free (no 402), tell the user. If it returns 401/403, explain the provider requires its own auth first.

### 3. `x402_fetch` — Call and Pay

Calls the endpoint and pays automatically from the local wallet. Returns the API response directly along with a payment receipt (transaction hash, amount, network).

| Param | Type | Description |
|-------|------|-------------|
| `url` | string | The x402 resource URL |
| `method` | string | GET, POST, PUT, DELETE (default GET) |
| `body` | any | Request body for POST/PUT (object or string) |
| `headers` | object | Optional custom request headers |

**If the wallet has no USDC**, the call will fail. Check `x402_wallet` first and tell the user to fund the wallet address with USDC on Solana. Once funded, retry.

After a successful call, link the transaction hash to the appropriate explorer (Solscan for Solana, Basescan for Base).

### 4. `x402_access` — Access with Wallet Proof

Use wallet identity instead of immediate payment when an endpoint requires Sign-In-With-X / wallet authentication.

| Param | Type | Description |
|-------|------|-------------|
| `url` | string | The identity-gated endpoint URL |
| `method` | string | HTTP method (default GET) |

### 5. `x402_wallet` — Check Balance

Shows your Solana and EVM wallet addresses with USDC balances across all supported chains (Solana, Base, Polygon, Arbitrum, Optimism, Avalanche). Use this:
- Before a fetch, to confirm sufficient funds
- When the user asks about their balance
- When a fetch fails due to insufficient funds

If USDC is 0, proactively suggest funding before attempting any fetch.

### 6. `x402_settings` — Spending Policy

Read or update your default per-call spending limit before the agent is allowed to settle a paid request.

### 7. `x402_pay` — Alias for `x402_fetch`

Same as `x402_fetch`. Use whichever name feels more natural in context.

## Workflow Patterns

### "Find me an API for X"
1. `x402_search` with their query
2. Present top results with prices and quality scores
3. Suggest the best one or ask which to try
4. `x402_check` to confirm price
5. `x402_fetch` to call it

### "Call this URL"
1. `x402_check` first to show the price
2. `x402_fetch` to call and pay

### "How much do I have?"
1. `x402_wallet`

### "What is OpenDexter?"
OpenDexter is Dexter's x402 search engine — a public gateway that lets any AI agent search and pay for x402 APIs without an account. It indexes endpoints from every major x402 facilitator (Dexter, Coinbase, PayAI, and more), verifies them with automated quality testing, and ranks them by a composite score. Install with `npx @dexterai/opendexter` or the `@dexterai/opendexter` npm package.

## Quality Scores

- **90-100**: Excellent. Verified, returns correct data.
- **75-89**: Good. Passed verification, reliable.
- **50-74**: Mediocre. May work but has issues.
- **Below 50**: Poor or untested. Use with caution.
- **Verified badge**: Passed Dexter's automated quality testing.

## Quick Start

```bash
npx @dexterai/opendexter
```

Or install globally:

```bash
npm install -g @dexterai/opendexter
opendexter
```

Then add to your MCP client config:

```json
{
  "mcpServers": {
    "opendexter": {
      "command": "npx",
      "args": ["-y", "@dexterai/opendexter"]
    }
  }
}
```

## Tips

- Search is semantic — describe what you want in plain English. The ranker handles synonyms and alternate phrasings internally.
- Most endpoints cost $0.01-$0.10 per call. Creative/compute-heavy ones cost more.
- The marketplace spans Solana and EVM chains (Base, Polygon, Arbitrum, Optimism, Avalanche, SKALE).
- Categories: AI, DeFi, Data, Tools, Games, Creative.
- Use `x402_check` before your first paid call to inspect pricing and schema.
- Use `x402_access` when an endpoint requires wallet authentication rather than payment.
- Use `x402_settings` to keep your default spend policy under control.
- The wallet needs both USDC (for payments) and a tiny amount of SOL (for transaction fees).
- Works with any x402 seller, not just Dexter endpoints.
- The marketplace catalog powers dynamic tool discovery — MCP servers can fetch it at runtime and auto-register tools for each resource, no code changes needed when new APIs are added.

## For API Sellers

List your x402 API on the marketplace:

1. Visit https://dexter.cash/onboard
2. Add `x402Middleware` from `@dexterai/x402/server` to your endpoints
3. Register your resource URL with the facilitator
4. Dexter's quality bot will automatically verify and score your endpoint
