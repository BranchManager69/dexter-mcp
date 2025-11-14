# Dexter MCP Toolset Buckets (Nov 14 2025)

## Bucket 1 – Remove Tonight

1. **didi_message** (`toolsets/didi/index.mjs:58`)
2. **didi_end_session** (`toolsets/didi/index.mjs:107`)
3. **kolscan_leaderboard** (`toolsets/kolscan/index.mjs:64`)
4. **kolscan_resolve_wallet** (`toolsets/kolscan/index.mjs:64`)
5. **kolscan_wallet_detail** (`toolsets/kolscan/index.mjs:64`)
6. **kolscan_trending_tokens** (`toolsets/kolscan/index.mjs:64`)
7. **kolscan_token_detail** (`toolsets/kolscan/index.mjs:64`)
8. **gmgn_fetch_token_snapshot** (`toolsets/gmgn/index.mjs:64`)

## Bucket 2 – Oddly Duplicated / Needs Consolidation

1. **stream_get_scene** (`toolsets/stream/index.mjs:70`)
2. **stream_set_scene** (`toolsets/stream/index.mjs:80`)
3. **stream_public_shout** (`toolsets/stream/index.mjs:98`)
4. **stream_shout_feed** (`toolsets/stream/index.mjs:132`)
5. **x402_api_dexter_cash_api_slippage_sentinel_solana** (logged in `~/.pm2/logs/dexter-mcp-out-67.log`)
6. **x402_api_dexter_cash_onchain_activity_solana**
7. **x402_api_dexter_cash_api_payments_x402_access_gmgn_solana**
8. **x402_api_dexter_cash_stream_shout_solana**
9. **x402_api_dexter_cash_onchain_entity_solana**
10. **x402_127_0_0_1_46297_stream_shout_solana**
11. **x402_127_0_0_1_39867_stream_shout_solana**
12. **x402_127_0_0_1_43033_stream_shout_solana**

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
12. **twitter_search** (`toolsets/twitter/index.mjs:1`)

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
