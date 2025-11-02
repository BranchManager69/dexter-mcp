# Kolscan Cleanup Inventory

Comprehensive references to the Kolscan toolset across the `~/websites` monorepo and Supabase prompt modules (query date: 2025-11-02, agent session).

## dexter-mcp
- `README.md:123,148` – documents Kolscan toolset availability and default loading behavior.
- `AGENTS.md:13` – agent-facing description of Kolscan tools.
- `toolsets/index.mjs` – imports and registers `registerKolscanToolset` in `TOOLSET_REGISTRY`.
- `toolsets/kolscan/index.mjs` – full Kolscan MCP implementation (fetch helper, tool registration, logging, error handling).

## dexter-agents
- `src/app/hooks/usePromptProfiles.ts` – maps Kolscan MCP tool names to concierge prompt slugs.
- `src/app/agentConfigs/customerServiceRetail/promptProfile.ts` – prompt metadata (slug + fallback) for Kolscan tools.
- `src/app/agentConfigs/customerServiceRetail/tools.ts` – MCP tool definitions (descriptions, `callMcp` wrappers) for Kolscan.

## dexter-api
- `src/app.ts` – registers HTTP routes via `registerKolscanRoutes`.
- `src/promptProfiles.ts` – concierge prompt slug definitions for Kolscan tools.
- `src/routes/kolscan.ts` – REST endpoints backing the Kolscan toolset.
- `src/utils/kolscan.ts` – data fetch/scraping helpers (e.g., leaderboard extraction).
- `src/utils/kolscanSupabase.ts` – Supabase-backed resolver helper; requires `KOLSCAN_SUPABASE_*` env vars.
- `src/env.ts` – declares `KOLSCAN_SUPABASE_URL` / `KOLSCAN_SUPABASE_ANON_KEY` in the typed env loader.
- `.env.example` – provides sample values for the Kolscan Supabase credentials.
- `docs/kolscan-data-integration.md` & `docs/kolscan-leaderboard-api.md` – internal documentation of Kolscan endpoints.
- `kolscan-kol.html` – static HTML snapshot for Kolscan UI reference/testing.
- `tests/kolscan.test.ts` – unit/integration tests covering Kolscan aggregation helpers.
- `tests/twitterBanterReply.test.ts`, `tests/twitterMentionTriage.test.ts` – mock env fixtures referencing Kolscan Supabase vars.

## Supabase Prompt Modules
Query: `SELECT slug FROM public.prompt_modules WHERE slug LIKE '%kolscan%';`
- `agent.concierge.tool.kolscan_leaderboard`
- `agent.concierge.tool.kolscan_wallet_detail`
- `agent.concierge.tool.kolscan_trending_tokens`
- `agent.concierge.tool.kolscan_token_detail`
- `agent.concierge.tool.kolscan_resolve_wallet`

These modules need to be deleted or migrated if the Kolscan toolset is removed.

## Additional Notes
- No references detected in `dexter-fe`, `dexter-mcp-api`, or other sibling projects under `~/websites`.
- Removing Kolscan will require: deleting MCP toolset code, unregistering routes, cleaning env entries, dropping prompt modules, pruning docs/tests, and updating agent configs to avoid dangling tool wrappers.
- Supabase removal can be performed via `DELETE FROM public.prompt_modules WHERE slug LIKE 'agent.concierge.tool.kolscan_%';` once code paths are cleared.
