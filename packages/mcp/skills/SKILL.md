---
name: opendexter
description: "Use @dexterai/opendexter to search, price-check, and pay for any x402 API. Trigger this skill whenever the user wants to find paid APIs, call an x402 endpoint, check pricing, see their wallet balance, or do anything involving x402 payments, paid APIs, USDC payments for APIs, the Dexter marketplace, or agent commerce. Also trigger when the user mentions x402, OpenDexter, paid APIs, or wants to call a paid service."
---

# @dexterai/opendexter — x402 Search Engine for AI Agents

This package gives you a local MCP server connected to the Dexter x402 marketplace. Search paid API endpoints, preview pricing, prove wallet ownership for identity-gated endpoints, and call APIs with automatic USDC settlement on Solana and EVM chains.

Your wallet is local at `~/.dexterai-mcp/wallet.json`. Fund it with USDC and payments happen automatically.

## Tools

### `x402_search` — Find paid APIs
Search the x402 marketplace. Results span Solana and EVM chains, ranked by quality, usage, and reputation.

### `x402_check` — Preview pricing
Probe an endpoint for payment requirements per chain without paying. Shows price, schema, and payTo address.

### `x402_fetch` — Call and pay
Calls any x402 endpoint with automatic settlement from your local wallet. Returns the API response and payment receipt.

### `x402_access` — Access with wallet proof
Use wallet identity instead of immediate payment when an endpoint requires Sign-In-With-X / wallet authentication.

### `x402_wallet` — Check balance
Shows your Solana and EVM wallet addresses with USDC balances across all supported chains (Solana, Base, Polygon, Arbitrum, Optimism, Avalanche). Fund either address with USDC to enable payments.

### `x402_settings` — Spending policy
Read or update your default per-call spending limit before the agent is allowed to settle a paid request.

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

## Fast setup

```bash
npx @dexterai/opendexter setup
```

This:
- creates or loads the wallet
- installs OpenDexter into detected clients
- shows funding rails
- points you at the first real search / check / fetch flow

If you want a more branded wallet identity later:

```bash
npx @dexterai/opendexter wallet --vanity
```

## Tips

- Search is fuzzy. Typos still match.
- Use `verifiedOnly: true` to filter to quality-tested endpoints.
- Most endpoints cost $0.01-$0.10 per call.
- The marketplace spans Solana and EVM chains (Base, Polygon, Arbitrum, Optimism, Avalanche).
- Use `x402_check` before your first paid call to inspect pricing and schema.
- Use `x402_access` when an endpoint requires wallet authentication rather than payment.
- Use `x402_settings` to keep your default spend policy under control.
