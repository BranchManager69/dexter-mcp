---
name: opendexter
description: "Use @dexterai/opendexter to search, price-check, and pay for any x402 API. Trigger this skill whenever the user wants to find paid APIs, call an x402 endpoint, check pricing, see their wallet balance, or do anything involving x402 payments, paid APIs, USDC payments for APIs, the x402 marketplace, or agent commerce."
---

# @dexterai/opendexter — x402 Search Engine for AI Agents

This package gives you a local MCP server connected to the x402 marketplace. Search 5,000+ paid API endpoints, preview pricing, and call them with automatic USDC payment on Solana and EVM chains.

Your wallet is local at `~/.dexterai-mcp/wallet.json`. Fund it with USDC and payments happen automatically.

## Tools

### `x402_search` — Find paid APIs
Search the x402 marketplace. Results span Solana and EVM chains, ranked by quality, usage, and reputation.

### `x402_check` — Preview pricing
Probe an endpoint for payment requirements per chain without paying. Shows price, schema, and payTo address.

### `x402_fetch` — Call and pay
Calls any x402 endpoint with automatic settlement from your local wallet. Returns the API response and payment receipt.

### `x402_wallet` — Check balance
Shows your wallet address and USDC balance. Fund this address with USDC on Solana to enable payments.

### `x402_pay` — Alias for `x402_fetch`

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

- Search is fuzzy. Typos still match.
- Use `verifiedOnly: true` to filter to quality-tested endpoints.
- Most endpoints cost $0.01-$0.10 per call.
- The marketplace spans Solana and EVM chains (Base, Polygon, Arbitrum, Optimism, Avalanche).
