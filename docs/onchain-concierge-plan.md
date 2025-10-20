## On-Chain Concierge Blueprint

### Mission

Give Dexter agents a single toolset that can answer natural-language questions about on-chain activity in near real time—“Who just aped DEXTER?”, “Did anyone dump in the last 5 minutes?”, “Is that buyer a mercenary bot or a long-term holder?”

### High-Value Use Cases

1. **Recent activity on a token**
   - Biggest buys/sells in the last *N* minutes/hours
   - Count and size distribution of trades
   - Surge detection (price or volume spikes)
2. **Wallet sleuthing**
   - Summaries of recent trades across tokens
   - Behavioral tags (diamond hands vs. mercenary vs. MEV bot)
   - Portfolio breakdown, cost basis, PnL snapshots
3. **Cross-token intelligence**
   - “Did any notable wallets rotate from Token A into Token B?”
   - “Show me whales who bought Token X after selling Token Y”
4. **Alert-style questions**
   - “Who just tanked the price?”
   - “Did any top-10 holders move in the last hour?”

### Data Sources / APIs

| Purpose | Candidate providers |
| --- | --- |
| Real-time token trades | Helius transactions API, Birdeye trade feed, Jupiter price feed, Pump.fun stream (if relevant) |
| Wallet portfolio + history | Helius, SolanaFM, Tensor APIs |
| Token metadata (market cap, liquidity) | Birdeye, Jupiter, Step |
| Name/social resolution | Kolscan roster, internal labels, on-chain NFDs |
| Price/PnL reference | Jupiter price history, Birdeye OHLCV |

### Proposed Architecture

1. **Ingestion & buffering layer**
   - Worker (Node/TypeScript) polling Helius or subscribing to webhooks for selected mints.
   - Normalize trades into a common schema (signature, timestamp, wallet, tokenMint, side, solAmount, tokenAmount, priceUsd, dex, source).
   - Optional caching in Redis/Supabase for 24–48 h to support lookbacks without hammering upstream APIs.

2. **Analysis modules**
   - Burst detector: abnormal volume/price changes over a sliding window.
  - Wallet profiler: metrics (trade frequency, hold duration, PnL buckets, diversification) with behavioral labels.
   - Relationship finder: join with Kolscan roster, internal tags, social handles.

3. **MCP tool surfaces**
   - `onchain_recent_trades` (token scoped, limit/timeframe filters, optional min size).
   - `onchain_wallet_profile` (wallet scoped, behavior summary + notable positions).
   - `onchain_token_whales` (top N buyers/sellers, with wallet metadata + behavior tags).
   - `onchain_alerts` (detect + describe last surge/dump event).

4. **Prompt modules**
   - Versioned instructions describing how the agent should chain these tools (e.g., use `onchain_recent_trades` first, then drill into wallets with `onchain_wallet_profile`, cite handles, etc.).

5. **Concierge integration**
   - Update dexter-agents renderers to stringify payloads, highlight whales, surface social handles.
   - DM/voice prompting so the concierge answers concisely (“Dexter: 3 wallets bought 120 SOL of DEXTER in the last 5 minutes; largest was …”).

### Implementation Roadmap

| Phase | Goals | Key Tasks |
| --- | --- | --- |
| **0. Discovery (1–2 days)** | Confirm token list, desired latency, rate-limit budgets. | Catalog must-have questions, finalize API providers, decide on caching vs. live calls. |
| **1. Ingestion MVP (3–4 days)** | Collect & normalize trades for one mint (DEXTER) in real time. | Build Helius polling worker, normalize schema, cache in Redis, expose `GET /onchain/trades?mint=DEXTER`. |
| **2. Analysis primitives (4–5 days)** | Add wallet profiling + burst detection. | Implement heuristics for “mercenary” vs. “long-term”, store short-term aggregates. |
| **3. MCP tools + prompt modules (2–3 days)** | Wire data into Dexter MCP. | Define tool schemas, register in `toolsets/onchain`, write Supabase prompt modules v1, update concierge instructions. |
| **4. Agent QA & UX polish (2–3 days)** | Validate prompts and responses. | Craft test prompts, adjust formatting, ensure citations/social handles surface. |
| **5. Expansion (ongoing)** | Multi-token support, clustering, alerts. | Parameterize mint list, add clustering heuristics, integrate alerting as needed. |

### Testing

- **Unit**: trade normalization, classification heuristics, burst detection math.
- **Integration**: mock API responses to ensure tool outputs stable JSON.
- **Agent acceptance**: harness prompts like “Who just aped DEXTER?” and “Is that wallet a mercenary?”.
- **Load**: verify rate limits, especially when monitoring multiple mints.

### Decisions & Follow-Ups (updated October 20, 2025)

- **Token coverage:** Build the ingestion MVP against DEXTER first, but keep the architecture token-agnostic—no hard-coded allowlists beyond whatever is needed for smoke tests.
- **Data providers:** Paid Birdeye access is active and Helius keys remain available in `../dexter-api/.env`; use both from day one.
- **Persistence:** Skip bespoke caches for now; all insights should come directly from live API calls/tools the agent can invoke.
- **Latency target:** No hard SLA yet; revisit after prototypes tell us the real end-to-end timing (rough expectation: ≤3 minutes feels acceptable).
- **Documentation location:** Keep this blueprint right here at `docs/onchain-concierge-plan.md`.
