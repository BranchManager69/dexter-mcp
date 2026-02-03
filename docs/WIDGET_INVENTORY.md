# Widget/Renderer Inventory

> **Last Updated:** 2026-02-03  
> **Total Tools:** 74  
> **ChatGPT Widgets:** 22  
> **dexter-agents Renderers:** 20

## Priority Queue (Missing Renderers)

Tools that need widgets, ordered by priority:

| Priority | Tool | Category | Notes |
|----------|------|----------|-------|
| **P0 - Critical** | | | |
| [ ] | `solscan_trending_tokens` | x402 | High-usage, no renderer anywhere |
| [ ] | `jupiter_quote_preview` | x402 | Core trading flow |
| [ ] | `slippage_sentinel` | x402 | Risk management |
| [ ] | `markets_fetch_ohlcv` | markets | Chart data, no renderer |
| **P1 - High** | | | |
| [ ] | `tools_solscan_trending_pro` | x402 | Pro version of trending |
| [ ] | `jupiter_quote_pro` | x402 | Pro quote |
| [ ] | `x402_scan_stats` | x402 | Network diagnostics |
| [ ] | `stream_public_shout` | stream | Engagement feature |
| [ ] | `stream_shout_feed` | stream | Feed display |
| **P2 - Medium** | | | |
| [ ] | `shield_create` | x402 | Protection feature |
| [ ] | `tools_spaces_jobs` | x402 | Spaces integration |
| [ ] | `tools_code-interpreter_jobs` | x402 | Code execution |
| [ ] | `tools_deep-research_jobs` | x402 | Research jobs |
| [ ] | `submit_feedback` | identity | Feedback submission |
| **P3 - Low** | | | |
| [ ] | `games_king_state` | x402 | Game state |
| [ ] | `games_story_read` | x402 | Story game |
| [ ] | `v2-test` | x402 | Test endpoint |
| [ ] | `fetch` | general | Only missing in ChatGPT |

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
| `stream_public_shout` | ❌ | ❌ | ❌ **MISSING** |
| `stream_shout_feed` | ❌ | ❌ | ❌ **MISSING** |

### MARKETS (1 tool)
| Tool | ChatGPT Widget | dexter-agents | Status |
|------|----------------|---------------|--------|
| `markets_fetch_ohlcv` | ❌ | ❌ | ❌ **MISSING** |

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
| `submit_feedback` | ❌ | ❌ | ❌ **MISSING** |
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
| `solscan_trending_tokens` | ❌ | ❌ | ❌ **MISSING** |
| `tools_solscan_trending_pro` | ❌ | ❌ | ❌ **MISSING** |
| `jupiter_quote_preview` | ❌ | ❌ | ❌ **MISSING** |
| `jupiter_quote_pro` | ❌ | ❌ | ❌ **MISSING** |
| `slippage_sentinel` | ❌ | ❌ | ❌ **MISSING** |
| `twitter_topic_analysis` | `twitter-search` | `twitterSearch` | ✅ Both |
| `sora_video_job` | `media-jobs` | `mediaJobs` | ✅ Both |
| `meme_generator_job` | `media-jobs` | `mediaJobs` | ✅ Both |
| `x402_scan_stats` | ❌ | ❌ | ❌ **MISSING** |
| `shield_create` | ❌ | ❌ | ❌ **MISSING** |
| `tools_spaces_jobs` | ❌ | ❌ | ❌ **MISSING** |
| `tools_code-interpreter_jobs` | ❌ | ❌ | ❌ **MISSING** |
| `tools_deep-research_jobs` | ❌ | ❌ | ❌ **MISSING** |
| `games_king_state` | ❌ | ❌ | ❌ **MISSING** |
| `games_story_read` | ❌ | ❌ | ❌ **MISSING** |
| `v2-test` | ❌ | ❌ | ❌ **MISSING** |

---

## Coverage Summary

| Category | Tools | Both Platforms | ChatGPT Only | agents Only | Neither |
|----------|-------|----------------|--------------|-------------|---------|
| general | 2 | 1 | 0 | 1 | 0 |
| pumpstream | 1 | 1 | 0 | 0 | 0 |
| wallet | 4 | 4 | 0 | 0 | 0 |
| solana | 5 | 5 | 0 | 0 | 0 |
| codex | 3 | 3 | 0 | 0 | 0 |
| stream | 2 | 0 | 0 | 0 | **2** |
| markets | 1 | 0 | 0 | 0 | **1** |
| onchain | 2 | 2 | 0 | 0 | 0 |
| pokedexter | 9 | 9 | 0 | 0 | 0 |
| hyperliquid | 5 | 5 | 0 | 0 | 0 |
| studio | 7 | 7 | 0 | 0 | 0 |
| identity | 7 | 0 | 6 | 0 | **1** |
| bundles | 10 | 0 | 10 | 0 | 0 |
| x402 | 16 | 3 | 0 | 0 | **13** |
| **TOTAL** | **74** | **40** | **16** | **1** | **17** |

### Key Stats
- **54%** of tools have renderers in both platforms
- **22%** have ChatGPT widget only  
- **1%** have dexter-agents renderer only
- **23%** have NO renderer anywhere (17 tools)

---

## Changelog

### 2026-02-03
- Initial inventory created
- Identified 17 tools with no renderer in either platform
- Priority queue established
