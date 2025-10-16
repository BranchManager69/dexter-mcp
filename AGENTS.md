# Dexter MCP Agents

## Toolset Overview
- **general** – `search` performs realtime web queries via Tavily (supports `max_results`, depth, answer summaries); `fetch` extracts full page content for a given URL. Requires `TAVILY_API_KEY` (`toolsets/general/index.mjs`).
- **pumpstream** – `pumpstream_live_summary` queries `https://pump.dexter.cash/api/live` and returns a condensed, paged stream snapshot. Schema supports `pageSize`/`offset`/`page`, search, symbol & mint filters, sort, status, min viewer / USD market-cap thresholds, plus optional spotlight data.
- **wallet** – Session-aware wallet helpers (`resolve_wallet`, `list_my_wallets`, `set_session_wallet_override`, `auth_info`) backed by `/api/wallets/resolver`. Session overrides are stored in-memory and keyed by the MCP session header.
- **solana** – Managed Solana trading utilities (`solana_resolve_token`, balance listings, swap preview/execute) proxied through Dexter API.
- **markets** – `markets_fetch_ohlcv` uses Birdeye’s v3 pair endpoint; provide a pair address or let it auto-pick the top-liquidity pair for a mint (`toolsets/markets/index.mjs`).
- **twitter** – `twitter_search` runs Playwright against X search using the shared session (`toolsets/twitter/index.mjs`). Supports multi-query/ticker presets, optional language/reply filters, media-only + verified-only toggles, and enriched author metadata.
- **codex** – Conversational (`codex_start`, `codex_reply`) and exec-mode (`codex_exec`) bridges to the Codex CLI. Exec mode supports optional JSON schemas for structured output.
- **stream** – DexterVision scene controls (`stream_get_scene`, `stream_set_scene`) for monitoring and switching OBS overlay states.
- **gmgn** – `gmgn_fetch_token_snapshot` launches a stealth headless browser, clears Cloudflare, and returns the token page’s aggregated stats/trades/candles for a supplied Solana mint.

All toolsets register through `toolsets/index.mjs`. If `TOKEN_AI_MCP_TOOLSETS` is unset, every registered group loads; set the variable (comma-separated keys or `all`) to control selection.

## Harness Operations
- **Location** – `../dexter-agents/scripts/runHarness.js` with CLI entry `scripts/dexchat.js` (npm script `dexchat`). Append `--guest` to skip stored auth and test the anonymous path—the API leg still uses the shared demo bearer (`TOKEN_AI_MCP_TOKEN`).
- **Standard run** –
  ```bash
  npm run dexchat -- --prompt "<prompt>" --wait 15000
  ```
- **From this repo** – `npm run test:pumpstream -- --mode both --prompt "List pump streams"` (UI + API). Use `--mode ui` or `--mode api` for single-path runs.
- **Artifacts** – Saved under `dexter-agents/harness-results/` unless `--no-artifact` is provided. Each JSON artifact records prompt, console logs, rendered transcript bubbles, and the structured event payloads from the app.
- **Monitoring** – Review console output for schema warnings (e.g., Zod `.optional()` without `.nullable()`) and treat them as regressions to be cleared before release.

### Session Maintenance

```
Turnstile + Supabase login (desktop helper)
           │  generates encoded cookie + state.json
           ▼
HARNESS_COOKIE in repos (.env)
           │  injected into Playwright runs
           ▼
Dexchat / pumpstream harness executions
```

- Use `dexchat refresh` (in `dexter-agents`) whenever you obtain a new encoded cookie string. It updates both `.env` files and regenerates `~/websites/dexter-mcp/state.json` locally.
- When `dexchat refresh` starts failing due to auth, run the desktop helper `refresh-supabase-session.ps1` to rebuild the Supabase session via SOCKS + Chrome. It will print a fresh cookie; rerun `dexchat refresh` with that value.
- Storage state only changes when the harness runs with `--storage`, which the helper handles automatically.
- Add `--guest` to upcoming runs when you want to ignore stored auth without clearing env files; the API portion will continue to use the demo bearer so regressions surface consistently.
- The cookie helper emits a warning if the pasted value lacks `sb-…-refresh-token`; in that case per-user MCP tokens can’t be minted.

See `dexter-agents/scripts/README.md` for concrete commands and troubleshooting tips.

## Operating Notes
- Keep this document evergreen: update tool descriptions when schemas, endpoints, or behaviors change.
- When adding tools, follow the conventions in `toolsets/ADDING_TOOLSETS.md` and document the new capabilities here.
- Harness artifacts provide the source of truth for recent behavioral checks; store long-lived analyses elsewhere so this guide remains an operating manual rather than a task list.
- **Tool guidance split:** Public-facing tool descriptions/metadata belong in the MCP specs; detailed usage patterns (multi-step orchestration, guardrails, etc.) stay inside our private realtime agent prompts/config so clients only see the high-level contract.
- **Wallet provisioning:** New Dexter users now receive a managed wallet during account creation, so resolver-backed tools should report `source:"resolver"` immediately; the env fallback (`TOKEN_AI_DEFAULT_WALLET_ADDRESS`) remains a guest-only safety net.
- **Access tiers:** `_meta.access` tags map to user experience — `guest` (shared demo bearer with live trading), `member` (authenticated Supabase wallet features like session overrides), `pro` (role-gated stream controls), `dev` (superadmin-only), and `internal` (diagnostics/logging).
