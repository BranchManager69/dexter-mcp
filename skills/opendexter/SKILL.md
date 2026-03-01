---
name: opendexter
description: "Use OpenDexter to search, price-check, and pay for any x402 API on behalf of the user. Trigger this skill whenever the user wants to find paid APIs, call an x402 endpoint, check pricing on a service, see their wallet balance, or do anything involving x402 payments, paid APIs, or the Dexter marketplace. Also trigger when the user mentions OpenDexter, x402, paid APIs, USDC payments for APIs, or agent commerce."
---

# OpenDexter — The x402 Search Engine

OpenDexter gives you access to the largest marketplace of paid x402 APIs. You can search 5,000+ endpoints, preview pricing, and call any of them with automatic payment — all without the user needing an account.

## Your Tools

You have five tools. Use them in this order for the best experience:

### 1. `x402_search` — Find APIs

Always start here. The user says "find me an image API" or "what token analysis tools are available" — search first.

The marketplace returns results ranked by a composite score (quality, usage, freshness, reputation, reliability). Results include:
- **name**: What the endpoint does
- **price**: Cost per call in USDC
- **network**: Which blockchain settles the payment (Solana, Base, etc.)
- **qualityScore**: 0-100, AI-verified. 75+ means it passed automated testing.
- **verified**: True if it passed quality verification
- **seller**: Who operates the endpoint
- **totalCalls**: How many times it's been used across the ecosystem

When presenting results to the user, highlight the verified ones and mention quality scores. If the user asks about a specific domain (like "image generation"), search for it rather than guessing at URLs.

### 2. `x402_check` — Preview Pricing

Before spending money, check the price. This probes the endpoint and returns payment options per chain without making a payment. Show the user:
- The price on each available chain
- Which chain is cheapest (the "best route")
- The payTo address

This helps the user decide before committing. If the endpoint returns "free" (no 402), tell them — it costs nothing.

If the endpoint returns 401/403 ("auth required"), explain that this particular API requires the provider's own authentication before the x402 payment flow. Not all endpoints are fully open.

### 3. `x402_fetch` — Call and Pay

This is the action tool. It calls the endpoint and handles payment automatically using the session wallet. The user gets the API response directly.

**Important**: Payment requires a funded wallet. If the wallet has no USDC, `x402_fetch` will return a session funding flow instead of the API response. When this happens:
- Show the user the deposit wallet address
- Tell them how much USDC to send
- If a Solana Pay URL is provided, mention they can scan it with Phantom or Solflare
- Once funded, retry the same `x402_fetch` call

After a successful paid call, the response includes:
- The API data
- Payment receipt (transaction hash, network, amount paid)

Link the transaction hash to the appropriate block explorer (Solscan for Solana, Basescan for Base, etc.).

### 4. `x402_wallet` — Check Balance

Shows the session wallet address, balance, and status. Accepts an optional sessionToken to resume a previous session. Use this when:
- The user asks "how much do I have"
- Before a fetch, to confirm they have enough funds
- After a fetch, to see the remaining balance

If the wallet has 0 USDC, proactively suggest funding it before trying to fetch.

### 5. `x402_pay` — Manual Payment Flow

This is the lower-level version of `x402_fetch`. It exposes the two-phase x402 flow: first call returns payment requirements, then the user signs and calls again. Most users should use `x402_fetch` instead — `x402_pay` exists for agents or systems that manage their own wallet signing.

## Workflow Patterns

### "Find me an API for X"
1. `x402_search` with their query
2. Present the top results with prices and quality scores
3. Ask which one they want to try, or suggest the best one
4. `x402_check` on their chosen endpoint
5. Show the price, ask to proceed
6. `x402_fetch` to call it

### "Call this URL"
1. `x402_check` first to show them the price
2. `x402_fetch` to call it

### "How much do I have?"
1. `x402_wallet`

### "What is OpenDexter?"
OpenDexter is Dexter's x402 search engine — a public gateway that lets any AI agent search and pay for x402 APIs without an account. It indexes endpoints from every major x402 facilitator (Dexter, Coinbase, PayAI, and more), verifies them with automated quality testing, and ranks them by a composite score. Three access methods: this MCP connection, the `@dexterai/opendexter` npm package, or the authenticated Dexter MCP at mcp.dexter.cash.

## Understanding Quality Scores

- **90-100**: Excellent. Verified, returns correct data, well-documented.
- **75-89**: Good. Passed verification, reliable.
- **50-74**: Mediocre. May work but has issues (large responses, inconsistent data, partial failures).
- **Below 50**: Poor or untested. Use with caution.
- **Verified badge**: Means the endpoint passed Dexter's automated quality testing. Unverified endpoints haven't been tested yet — they might work fine, they just haven't been scored.

## Tips

- Search is fuzzy. "juipter" will still find Jupiter. Searches match against names, descriptions, categories, URLs, and seller names.
- The marketplace has endpoints across multiple chains. If the user cares about a specific chain, use the `network` filter.
- If search returns too many results, use `verifiedOnly: true` to filter down to quality-tested endpoints.
- Price is per call. Most endpoints cost $0.01-$0.10. Some creative/compute-heavy ones cost more.
- The session wallet is ephemeral. Funds deposited are for this session's use.
