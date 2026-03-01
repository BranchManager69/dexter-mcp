---
name: opendexter
description: "Use @dexterai/opendexter to search, price-check, and pay for any x402 API. Trigger this skill whenever the user wants to find paid APIs, call an x402 endpoint, check pricing, see their wallet balance, or do anything involving x402 payments, paid APIs, USDC payments for APIs, the Dexter marketplace, or agent commerce. Also trigger when the user mentions x402, OpenDexter, paid APIs, or wants to monetize or call a paid service."
---

# @dexterai/opendexter — x402 Search Engine for AI Agents

This package gives you access to the Dexter x402 marketplace — the largest directory of paid APIs that agents can search, price-check, and call with automatic USDC payment.

Your wallet is local at `~/.dexterai-mcp/wallet.json`. Fund it with USDC on Solana and payments happen automatically.

## Your Tools

Use them in this order for the best experience:

### 1. `x402_search` — Find APIs

Always start here when the user wants to find a paid API. The marketplace has 5,000+ endpoints ranked by quality, usage, freshness, and reputation.

Results include:
- **name**: What the endpoint does
- **price**: Cost per call in USDC
- **network**: Which blockchain settles payment (Solana, Base, etc.)
- **qualityScore**: 0-100, AI-verified. 75+ means it passed automated testing.
- **verified**: True if it passed quality verification
- **seller**: Who operates the endpoint
- **totalCalls**: Usage volume across the ecosystem

Highlight verified endpoints and quality scores when presenting results.

### 2. `x402_check` — Preview Pricing

Probes the endpoint and returns payment options per chain without paying. Shows the user what it'll cost before committing. If the endpoint is free, tell them. If it returns 401/403, explain the provider requires its own auth first.

### 3. `x402_fetch` — Call and Pay

Calls the endpoint and pays automatically from the local wallet. The user gets the API response directly along with a payment receipt (transaction hash, amount, network).

**If the wallet has no USDC**, the call will fail. Check `x402_wallet` first and tell the user to fund it:
- Show the wallet address from `x402_wallet`
- Tell them to send USDC on Solana to that address
- Once funded, retry

### 4. `x402_wallet` — Check Balance

Shows the local wallet address and USDC/SOL balances. Use this:
- Before a fetch, to confirm sufficient funds
- When the user asks about their balance
- When a fetch fails due to insufficient funds

If USDC is 0, proactively suggest funding the wallet address shown.

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

### "What is this?"
This is @dexterai/opendexter — a local x402 gateway that connects your AI agent to the Dexter marketplace. It searches 5,000+ paid APIs from every major x402 facilitator (Dexter, Coinbase, PayAI, and more), all verified and quality-ranked. Your wallet stays on your machine — no account needed, no custodial risk.

## Quality Scores

- **90-100**: Excellent. Verified, returns correct data.
- **75-89**: Good. Passed verification, reliable.
- **50-74**: Mediocre. May work but has issues.
- **Below 50**: Poor or untested. Use with caution.
- **Verified badge**: Passed Dexter's automated quality testing.

## Tips

- Search is fuzzy — typos still match. Searches across names, descriptions, categories, URLs, seller names.
- Use `verifiedOnly: true` to filter to quality-tested endpoints only.
- Use `network` filter if the user cares about a specific chain.
- Most endpoints cost $0.01-$0.10 per call. Creative/compute-heavy ones cost more.
- The wallet needs both USDC (for payments) and a tiny amount of SOL (for transaction fees).
