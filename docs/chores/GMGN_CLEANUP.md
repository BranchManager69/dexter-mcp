# GMGN Cleanup Inventory

> **Status (Nov 17 2025):** The standalone MCP GMGN bundle was removed; paid access now flows through the auto-registered `x402` tool `gmgn_snapshot_access`. Use the reference list below to finish retiring or migrating concierge prompt slugs, x402 configs, and Supabase records outside dexter-mcp.

Comprehensive references to the GMGN snapshot toolset across the `~/websites` monorepo and Supabase prompt modules (query date: 2025-11-02, agent session).

## dexter-mcp
- `README.md:122,148` – documents GMGN tool availability and default loading behavior.
- `AGENTS.md:12` – agent-facing description of the `gmgn_fetch_token_snapshot` tool.
- `toolsets/index.mjs` – previously imported `registerGmgnToolset`; entry removed Nov 17 2025.
- `toolsets/gmgn/index.mjs` – (removed Nov 17 2025) legacy MCP implementation; reference retained for context.
- `integrations/gmgn.mjs` – (removed Nov 17 2025) legacy headless integration retained in git history only.

## dexter-agents
- `src/app/hooks/usePromptProfiles.ts` – maps `gmgn_fetch_token_snapshot` to its concierge prompt slug.
- `src/app/agentConfigs/customerServiceRetail/promptProfile.ts` – prompt metadata (slug + fallback) for the GMGN tool.
- `src/app/agentConfigs/customerServiceRetail/tools.ts` – tool definition, argument schema, and MCP call wrapper for GMGN.

## dexter-api
- `src/promptProfiles.ts` – concierge prompt slug registration for GMGN.
- `src/routes/payments.ts:390-391` – exposes `/api/payments/x402/access/gmgn` route used by the MCP toolset for payments.
- `scripts/x402-loop.js` & `scripts/x402-loop.config.json` – automated GMGN snapshot cycle configuration/aliases.
- `scripts/pay-solana-test.mjs` – test harness that invokes GMGN snapshot fetches (includes `X402_TEST_GMGN_MINT`).
- `.env` / `.env.example` – `X402_ROUTE_CONFIG` entries include GMGN access pricing.

## Supabase Prompt Modules
Query: `SELECT slug FROM public.prompt_modules WHERE slug LIKE '%gmgn%';`
- `agent.concierge.tool.gmgn_fetch_token_snapshot`

This module must be removed or replaced if GMGN support is deprecated.

## Additional Notes
- No GMGN references detected in `dexter-fe`, `dexter-mcp-api`, or other sibling projects under `~/websites`.
- Retiring GMGN entails removing the MCP integration, updating concierge prompts, pruning the x402 payment route/config, and deleting the prompt module above.
- Supabase cleanup command: `DELETE FROM public.prompt_modules WHERE slug = 'agent.concierge.tool.gmgn_fetch_token_snapshot';`
