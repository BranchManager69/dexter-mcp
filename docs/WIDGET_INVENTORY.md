# Widget/Renderer Inventory

> **Last Updated:** 2026-02-04  
> **Total Tools:** 74  
> **ChatGPT Widgets:** 32 (+10 new)  
> **dexter-agents Renderers:** 20

## Priority Queue (Missing Renderers)

Tools that need widgets, ordered by priority:

| Priority | Tool | Category | Notes |
|----------|------|----------|-------|
| **P0 - Critical** | | | |
| [x] | `solscan_trending_tokens` | x402 | ✅ `solscan-trending` |
| [x] | `jupiter_quote_preview` | x402 | ✅ `jupiter-quote` |
| [x] | `slippage_sentinel` | x402 | ✅ `slippage-sentinel` |
| [x] | `markets_fetch_ohlcv` | markets | ✅ `ohlcv` |
| **P1 - High** | | | |
| [x] | `tools_solscan_trending_pro` | x402 | ✅ Uses `solscan-trending` |
| [x] | `jupiter_quote_pro` | x402 | ✅ Uses `jupiter-quote` |
| [x] | `x402_scan_stats` | x402 | ✅ `x402-stats` |
| [x] | `stream_public_shout` | stream | ✅ `stream-shout` |
| [x] | `stream_shout_feed` | stream | ✅ `stream-shout` |
| **P2 - Medium** | | | |
| [x] | `shield_create` | x402 | ✅ `shield` |
| [x] | `tools_spaces_jobs` | x402 | ✅ `async-job` |
| [x] | `tools_code-interpreter_jobs` | x402 | ✅ `async-job` |
| [x] | `tools_deep-research_jobs` | x402 | ✅ `async-job` |
| [x] | `submit_feedback` | identity | ✅ `feedback` |
| **P3 - Low (Stubs)** | | | |
| [x] | `games_king_state` | x402 | ✅ `game-state` (stub) |
| [x] | `games_story_read` | x402 | ✅ `game-state` (stub) |
| [~] | `v2-test` | x402 | Test endpoint, no widget needed |
| [ ] | `fetch` | general | Only missing in ChatGPT (low priority) |

---

## Complete Tool → Renderer Mapping

### GENERAL (2 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `search` | `search` | `search` | ✅ Both |
| `fetch` | ❌ | `fetch` | ⚠️ ChatGPT missing |

### PUMPSTREAM (1 tool)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `pumpstream_live_summary` | `pumpstream` | `pumpstream` | ✅ Both |

### WALLET (4 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `resolve_wallet` | `resolve-wallet` | `walletResolve` | ✅ Both |
| `list_my_wallets` | `wallet-list` | `walletList` | ✅ Both |
| `set_session_wallet_override` | `wallet-override` | `walletOverride` | ✅ Both |
| `auth_info` | `wallet-auth` | `walletAuth` | ✅ Both |

### SOLANA (5 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `solana_resolve_token` | `solana-token-lookup` | `solanaToken` | ✅ Both |
| `solana_list_balances` | `solana-balances` | `solanaBalances` | ✅ Both |
| `solana_send` | `solana-send` | `solanaSend` | ✅ Both |
| `solana_swap_preview` | `solana-swap-preview` | `solanaSwap` | ✅ Both |
| `solana_swap_execute` | `solana-swap-execute` | `solanaSwap` | ✅ Both |

### CODEX (3 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `codex_start` | `codex` | `codex` | ✅ Both |
| `codex_reply` | `codex` | `codex` | ✅ Both |
| `codex_exec` | `codex` | `codex` | ✅ Both |

### STREAM (2 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `stream_public_shout` | `stream-shout` ✨ | ❌ | ⚠️ agents missing |
| `stream_shout_feed` | `stream-shout` ✨ | ❌ | ⚠️ agents missing |

### MARKETS (1 tool)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `markets_fetch_ohlcv` | `ohlcv` ✨ | ❌ | ⚠️ agents missing |

### ONCHAIN (2 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `onchain_activity_overview` | `onchain-activity` | `onchain` | ✅ Both |
| `onchain_entity_insight` | `onchain-activity` | `onchain` | ✅ Both |

### POKEDEXTER (9 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `pokedexter_list_challenges` | `pokedexter` | `pokedexter` | ✅ Both |
| `pokedexter_get_battle_state` | `pokedexter` | `pokedexter` | ✅ Both |
| `pokedexter_make_move` | `pokedexter` | `pokedexter` | ✅ Both |
| `pokedexter_get_active_wager` | `pokedexter` | `pokedexter` | ✅ Both |
| `pokedexter_get_wager_status` | `pokedexter` | `pokedexter` | ✅ Both |
| `pokedexter_create_challenge` | `pokedexter` | `pokedexter` | ✅ Both |
| `pokedexter_accept_challenge` | `pokedexter` | `pokedexter` | ✅ Both |
| `pokedexter_join_queue` | `pokedexter` | `pokedexter` | ✅ Both |
| `pokedexter_queue_status` | `pokedexter` | `pokedexter` | ✅ Both |

### HYPERLIQUID (5 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `hyperliquid_markets` | `hyperliquid` | `hyperliquid` | ✅ Both |
| `hyperliquid_opt_in` | `hyperliquid` | `hyperliquid` | ✅ Both |
| `hyperliquid_fund` | `hyperliquid` | `hyperliquid` | ✅ Both |
| `hyperliquid_bridge_deposit` | `hyperliquid` | `hyperliquid` | ✅ Both |
| `hyperliquid_perp_trade` | `hyperliquid` | `hyperliquid` | ✅ Both |

### STUDIO (7 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `studio_create` | `studio` | `studio` | ✅ Both |
| `studio_status` | `studio` | `studio` | ✅ Both |
| `studio_cancel` | `studio` | `studio` | ✅ Both |
| `studio_inspect` | `studio` | `studio` | ✅ Both |
| `studio_list` | `studio` | `studio` | ✅ Both |
| `studio_breaking_news` | `studio` | `studio` | ✅ Both |
| `studio_news_status` | `studio` | `studio` | ✅ Both |

### IDENTITY (7 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `check_identity` | `identity-status` | ❌ | ⚠️ agents missing |
| `get_my_identity` | `identity-status` | ❌ | ⚠️ agents missing |
| `mint_identity` | `identity-status` | ❌ | ⚠️ agents missing |
| `get_agent_reputation` | `reputation-badge` | ❌ | ⚠️ agents missing |
| `get_reputation_leaderboard` | `reputation-badge` | ❌ | ⚠️ agents missing |
| `submit_feedback` | `feedback` ✨ | ❌ | ⚠️ agents missing |
| `get_identity_stats` | `identity-status` | ❌ | ⚠️ agents missing |

### BUNDLES (10 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `list_bundles` | `bundle-card` | ❌ | ⚠️ agents missing |
| `get_bundle` | `bundle-card` | ❌ | ⚠️ agents missing |
| `get_my_bundles` | `bundle-card` | ❌ | ⚠️ agents missing |
| `create_bundle` | `bundle-card` | ❌ | ⚠️ agents missing |
| `update_bundle` | `bundle-card` | ❌ | ⚠️ agents missing |
| `publish_bundle` | `bundle-card` | ❌ | ⚠️ agents missing |
| `add_bundle_item` | `bundle-card` | ❌ | ⚠️ agents missing |
| `remove_bundle_item` | `bundle-card` | ❌ | ⚠️ agents missing |
| `check_bundle_access` | `bundle-card` | ❌ | ⚠️ agents missing |
| `get_my_purchases` | `bundle-card` | ❌ | ⚠️ agents missing |

### X402 DYNAMIC (16 tools)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `solscan_trending_tokens` | `solscan-trending` ✨ | ❌ | ⚠️ agents missing |
| `tools_solscan_trending_pro` | `solscan-trending` ✨ | ❌ | ⚠️ agents missing |
| `jupiter_quote_preview` | `jupiter-quote` ✨ | ❌ | ⚠️ agents missing |
| `jupiter_quote_pro` | `jupiter-quote` ✨ | ❌ | ⚠️ agents missing |
| `slippage_sentinel` | `slippage-sentinel` ✨ | ❌ | ⚠️ agents missing |
| `twitter_topic_analysis` | `twitter-search` | `twitterSearch` | ✅ Both |
| `sora_video_job` | `media-jobs` | `mediaJobs` | ✅ Both |
| `meme_generator_job` | `media-jobs` | `mediaJobs` | ✅ Both |
| `x402_scan_stats` | `x402-stats` ✨ | ❌ | ⚠️ agents missing |
| `shield_create` | `shield` ✨ | ❌ | ⚠️ agents missing |
| `tools_spaces_jobs` | `async-job` ✨ | ❌ | ⚠️ agents missing |
| `tools_code-interpreter_jobs` | `async-job` ✨ | ❌ | ⚠️ agents missing |
| `tools_deep-research_jobs` | `async-job` ✨ | ❌ | ⚠️ agents missing |
| `games_king_state` | `game-state` ✨ (stub) | ❌ | ⚠️ stub only |
| `games_story_read` | `game-state` ✨ (stub) | ❌ | ⚠️ stub only |
| `v2-test` | — | — | Test endpoint |

---

## Coverage Summary

| Category | Tools | Both Platforms | ChatGPT Only | agents Only | Neither |
|----------|-------|----------------|--------------|-------------|---------|
| general | 2 | 1 | 0 | 1 | 0 |
| pumpstream | 1 | 1 | 0 | 0 | 0 |
| wallet | 4 | 4 | 0 | 0 | 0 |
| solana | 5 | 5 | 0 | 0 | 0 |
| codex | 3 | 3 | 0 | 0 | 0 |
| stream | 2 | 0 | **2** ✨ | 0 | 0 |
| markets | 1 | 0 | **1** ✨ | 0 | 0 |
| onchain | 2 | 2 | 0 | 0 | 0 |
| pokedexter | 9 | 9 | 0 | 0 | 0 |
| hyperliquid | 5 | 5 | 0 | 0 | 0 |
| studio | 7 | 7 | 0 | 0 | 0 |
| identity | 7 | 0 | **7** ✨ | 0 | 0 |
| bundles | 10 | 0 | 10 | 0 | 0 |
| x402 | 16 | 3 | **12** ✨ | 0 | **1** (test) |
| **TOTAL** | **74** | **40** | **32** | **1** | **1** |

### Key Stats (Updated)
- **54%** of tools have renderers in both platforms
- **43%** have ChatGPT widget only (+21% from previous)
- **1%** have dexter-agents renderer only
- **1%** have no renderer (v2-test only, intentionally)

---

## New Widgets Added (2026-02-04)

| Widget | File | Tools Covered |
|--------|------|---------------|
| `solscan-trending` | solscan-trending.tsx | `solscan_trending_tokens`, `tools_solscan_trending_pro` |
| `jupiter-quote` | jupiter-quote.tsx | `jupiter_quote_preview`, `jupiter_quote_pro` |
| `slippage-sentinel` | slippage-sentinel.tsx | `slippage_sentinel` |
| `ohlcv` | ohlcv.tsx | `markets_fetch_ohlcv` |
| `x402-stats` | x402-stats.tsx | `x402_scan_stats` |
| `stream-shout` | stream-shout.tsx | `stream_public_shout`, `stream_shout_feed` |
| `shield` | shield.tsx | `shield_create` |
| `async-job` | async-job.tsx | `tools_spaces_jobs`, `tools_code-interpreter_jobs`, `tools_deep-research_jobs` |
| `feedback` | feedback.tsx | `submit_feedback` |
| `game-state` | game-state.tsx | `games_king_state`, `games_story_read` (stub) |

---

## Changelog

### 2026-02-04
- Added 10 new ChatGPT widgets covering P0, P1, P2, and P3 tools
- P0: `solscan-trending`, `jupiter-quote`, `slippage-sentinel`, `ohlcv`
- P1: `x402-stats`, `stream-shout`
- P2: `shield`, `async-job`, `feedback`
- P3: `game-state` (stub)
- ChatGPT widget count: 22 → 32
- Tools with no renderer: 17 → 1 (only `v2-test` test endpoint)

### 2026-02-03
- Initial inventory created
- Identified 17 tools with no renderer in either platform
- Priority queue established
