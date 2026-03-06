# Dexter MCP Toolset Buckets (Nov 17 2025)

## Bucket 1 – Completed Removals (Nov 17)

Removed from `toolsets/` and the runtime registry:

1. **didi_message** / **didi_end_session** (`toolsets/didi`)
2. **kolscan_* tools** (`toolsets/kolscan`)
3. **gmgn_fetch_token_snapshot** (`toolsets/gmgn`)
4. **twitter_search** (`toolsets/twitter`)
5. **stream_get_scene** / **stream_set_scene** (`toolsets/stream`)

## Bucket 2 – Auto-registered (x402) Follow-ups

These now ship solely via the `x402` bundle. Next step is to document prompt slugs + migrate concierge callers off the legacy wrappers:

1. **slippage_sentinel** (paid risk diagnostics)
2. **jupiter_quote_preview**
3. **twitter_topic_analysis** (supersedes the removed `twitter_search` bundle)
4. **solscan_trending_tokens**
5. **sora_video_job**
6. **meme_generator_job**
7. **gmgn_snapshot_access**
8. **x402_scan_stats** (new catalog slug; document scope + prompt slug before wiring)

## Bucket 3 – (none)

_No active entries; candidates moved to other buckets._

## Bucket 4 – Keep, Plan Upgrades

1. **hyperliquid_markets** (`toolsets/hyperliquid/index.mjs:29`)
2. **hyperliquid_opt_in** (`toolsets/hyperliquid/index.mjs:69`)
3. **hyperliquid_perp_trade** (`toolsets/hyperliquid/index.mjs:106`)
4. **onchain_activity_overview** (`toolsets/onchain/index.mjs`)
5. **onchain_entity_insight** (`toolsets/onchain/index.mjs`)
6. **resolve_wallet** (`toolsets/wallet/index.mjs:104`)
7. **list_my_wallets** (`toolsets/wallet/index.mjs:160`)
8. **set_session_wallet_override** (`toolsets/wallet/index.mjs:222`)
9. **auth_info** (`toolsets/wallet/index.mjs:269`)
10. **solana_send** (`toolsets/solana/index.mjs:264`)
11. **markets_fetch_ohlcv** (`toolsets/markets/index.mjs:1`)

## Bucket 5 – Love / Core Keepers

1. **search** (`toolsets/general/index.mjs:9`)
2. **fetch** (`toolsets/general/index.mjs:44`)
3. **pumpstream_live_summary** (`toolsets/pumpstream/index.mjs:6`)
4. **solana_resolve_token** (`toolsets/solana/index.mjs:10`)
5. **solana_list_balances** (`toolsets/solana/index.mjs:139`)
6. **solana_swap_preview** (`toolsets/solana/index.mjs:356`)
7. **solana_swap_execute** (`toolsets/solana/index.mjs:420`)

## Bucket 6 – Watch List / Needs Clear Owner

1. **codex_start** (`toolsets/codex/index.mjs:12`)
2. **codex_reply** (`toolsets/codex/index.mjs:68`)
3. **codex_exec** (`toolsets/codex/index.mjs:126`)
