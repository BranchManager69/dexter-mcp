---
name: opendexter
description: "Use OpenDexter to search, price-check, and pay for any x402 API on behalf of the user. Trigger this skill whenever the user wants to find paid APIs, call an x402 endpoint, check pricing on a service, see their wallet balance, or do anything involving x402 payments, paid APIs, or the x402 marketplace. Also trigger when the user mentions OpenDexter, x402, paid APIs, USDC payments for APIs, or agent commerce."
---

# OpenDexter — The x402 Search Engine

OpenDexter gives you access to the x402 marketplace — 5,000+ paid API endpoints across Solana and EVM chains (Base, Polygon, Arbitrum, Optimism, Avalanche). Search, preview pricing, and call any endpoint with automatic payment. No account needed.

Every session creates both a Solana wallet and an EVM wallet. Fund either or both — the system checks all chain balances and auto-selects the best funded chain for each payment.

## Your Tools

### 1. `x402_search` — Find APIs

Always start here. Results span multiple chains and are ranked by a composite score (quality, usage, freshness, reputation, reliability).

Results include: name, price (USDC), network (Solana, Base, etc.), qualityScore (0-100), verified status, seller, and call count.

When presenting results, highlight verified ones (qualityScore 75+) and mention the chain.

### 2. `x402_check` — Preview Pricing

Probes an endpoint for payment requirements without paying. Returns pricing options per chain, input/output schema, and the payTo address for each chain. Use this before spending money so the user knows what it costs.

### 3. `x402_fetch` — Call and Pay

The action tool. Calls the endpoint and handles payment automatically from the session. The system checks USDC balances across all funded chains (Solana, Base, Polygon, Arbitrum, Optimism, Avalanche) and picks the best-funded chain that the endpoint accepts. No chain parameter needed.

If the session has no funds on any accepted chain, it returns a funding flow with both deposit addresses.

After a successful call, the response includes the API data, payment receipt with transaction hash, and updated per-chain balances.

### 4. `x402_wallet` — Session Dashboard

Creates or resumes a multi-chain session. Each session has:
- A **Solana** wallet address (with Solana Pay QR for mobile funding)
- An **EVM** wallet address (same address on Base, Polygon, Arbitrum, Optimism, Avalanche)
- Per-chain USDC balances

The user can fund either or both addresses on any supported chain. When showing the wallet to the user:
- Show both addresses with copy buttons
- Show per-chain balances (Solana and Base always visible, others when funded)
- Show the total available USDC across all chains
- Mention that the EVM address works on all supported EVM chains

Pass `sessionToken` to resume a previous session. Sessions persist for 30 days.

### 5. `x402_pay` — Alias for `x402_fetch`

Same as `x402_fetch`. Exists for backward compatibility.

## Workflow Patterns

### "Find me an API for X"
1. `x402_search` with their query
2. Present top results with prices, quality scores, and chains
3. `x402_check` on their chosen endpoint
4. Show the price per chain
5. `x402_fetch` to call it (payment is automatic)

### "Call this URL"
1. `x402_check` first to show the price
2. `x402_fetch` to call and pay

### "How much do I have?"
1. `x402_wallet` — shows per-chain balances and total

### Funding a Session
When the user needs to fund:
1. Show the Solana address for Solana USDC deposits
2. Show the EVM address for Base/Polygon/Arbitrum/Optimism/Avalanche USDC deposits
3. Mention that the EVM address is the same across all EVM chains
4. After funding, any `x402_fetch` call will detect the balance automatically

## Quality Scores

- **90-100**: Excellent. Verified, correct data, well-documented.
- **75-89**: Good. Passed verification, reliable.
- **50-74**: Mediocre. May work but has issues.
- **Below 50**: Poor or untested. Use with caution.

## Tips

- Search is fuzzy. Typos still find results.
- The marketplace spans Solana and EVM chains. Use the `network` filter if the user cares about a specific chain.
- Use `verifiedOnly: true` to filter to quality-tested endpoints.
- Most endpoints cost $0.01-$0.10 per call.
- Sessions persist for 30 days. Resume with `sessionToken`.
- The system auto-selects the cheapest/best-funded chain at payment time. The user never needs to specify which chain to pay on.
