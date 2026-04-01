---
name: x402-marketplace
description: "Discover and navigate the Dexter x402 marketplace — quality scores, search patterns, categories, seller reputation, and becoming a seller. Trigger when the user asks about the marketplace, API discovery, quality scoring, how to list their API, or how x402 resources are indexed."
---

# Dexter x402 Marketplace

The Dexter Marketplace indexes 5,000+ paid API endpoints from every major x402 facilitator (Dexter, Coinbase, PayAI, and more), verified with automated quality testing and ranked by a composite score.

Browse at: https://dexter.cash/opendexter

## Marketplace API

```
GET https://x402.dexter.cash/api/facilitator/marketplace/resources
```

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Full-text search across names, descriptions, categories, URLs, sellers |
| `category` | string | Filter by category |
| `network` | string | Filter by payment network |
| `maxPrice` | number | Maximum USDC price per call |
| `verified` | boolean | Only quality-verified endpoints |
| `sort` | string | Sort order (see below) |
| `limit` | number | Max results, 1–50 |

### Sort Options

| Sort | Description |
|------|-------------|
| `marketplace` | Default composite ranking (quality + usage + freshness + reputation) |
| `relevance` | Best match to search query |
| `quality_score` | Highest quality first |
| `settlements` | Most total settlements first |
| `volume` | Highest USDC volume first |
| `recent` | Most recently active first |

### Categories

AI, DeFi, Data, Tools, Games, Creative — and `uncategorized` for unlabeled endpoints.

### Response Shape

Each resource includes:

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | Human-readable name |
| `resourceUrl` | string | The x402 endpoint URL |
| `method` | string | HTTP method (GET, POST, etc.) |
| `priceUsdc` | number | Price per call in USDC |
| `priceNetwork` | string | Settlement chain |
| `qualityScore` | number | 0–100, AI-verified quality |
| `verificationStatus` | string | "pass", "fail", or null (untested) |
| `totalSettlements` | number | Lifetime call count |
| `totalVolumeUsdc` | number | Lifetime USDC volume |
| `category` | string | API category |
| `seller.displayName` | string | Seller name |
| `reputationScore` | number | Seller reputation (0–100) |
| `authRequired` | boolean | Whether provider auth is needed before x402 |
| `authType` | string | "api-key", "oauth", etc. |

## Quality Scoring

Dexter runs automated quality verification on indexed endpoints:

| Score | Rating | Meaning |
|-------|--------|---------|
| 90–100 | Excellent | Verified, returns correct data, well-documented |
| 75–89 | Good | Passed verification, reliable |
| 50–74 | Mediocre | May work but has issues (large responses, inconsistent data) |
| Below 50 | Poor | Untested or failed verification |

The **verified badge** means the endpoint passed automated testing. Unverified endpoints haven't been tested yet — they might work fine, they just haven't been scored.

## Becoming a Seller

List your x402 API on the marketplace:

1. Visit https://dexter.cash/onboard
2. Add `x402Middleware` from `@dexterai/x402/server` to your endpoints
3. Register your resource URL with the facilitator
4. Dexter's quality bot will automatically verify and score your endpoint

## Search Tips

- Search is fuzzy — "juipter" still finds Jupiter
- Use `verifiedOnly: true` to filter to quality-tested only
- Use `network` filter for chain-specific results
- Most endpoints cost $0.01–$0.10 per call
- Sort by `quality_score` when reliability matters most
- Sort by `settlements` to find the most-used (battle-tested) APIs

## Dynamic Tool Discovery

The marketplace catalog powers dynamic tool discovery. MCP servers like ClawDexter can fetch the catalog at runtime and auto-register tools for each resource — no code changes needed when new APIs are added. This is the "app store" model: add an endpoint to the catalog and every connected agent instantly gets access.
