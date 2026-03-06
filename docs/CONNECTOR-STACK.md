# Dexter Connector Stack Overview

> Updated: 2025-11-06 06:33:11 UTC  
> Scope: production behaviour only (no forward-looking plans)

## Repository Roles

| Repo | Visibility | Current responsibility |
|------|------------|------------------------|
| `dexter-api` | **Private** | Supabase auth integration, concierge prompt storage (`prompt_modules`, `user_profiles`, `user_memories`), OAuth handlers for ChatGPT/Claude, MCP JWT issuance, tool/job orchestration, Twitter mention worker. |
| `dexter-agents` | Public | Voice + web concierge surface. Calls `/prompt-profiles` and runtime session APIs in `dexter-api`. Only user-facing persona editor today. |
| `dexter-mcp` | Public | MCP bridge (HTTP + stdio) for ChatGPT & Claude. Authenticates users via the OAuth/JWT flow supplied by `dexter-api` and forwards tool calls back to the API. |

## Authentication & Token Issuers

- **Supabase session check**  
  - `dexter-api/.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`.  
  - `dexter-mcp/.env`: mirrors `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` for direct validation when falling back to Supabase OAuth.
- **Dexter MCP JWTs**  
  - Minted in `dexter-api` using `MCP_JWT_SECRET`; sent to clients like the Twitter worker and MCP server.  
  - `dexter-mcp` trusts those JWTs via its own `MCP_JWT_SECRET`.
- **External OAuth (ChatGPT & Claude)**  
  - `dexter-api`: `TOKEN_AI_OIDC_CLIENT_ID`, `TOKEN_AI_OIDC_CLIENT_ID_CHATGPT`, connector redirects baked into `connectorOAuth.ts`. Anthropic (Claude) support defaults to `cid_59e99d1247b444bca4631382ecff3e36` when `CONNECTOR_CLAUDE_CLIENT_ID` is unset.  
  - `dexter-mcp`: `TOKEN_AI_OIDC_CLIENT_ID(_CHATGPT)`, `TOKEN_AI_OIDC_AUTHORIZATION_ENDPOINT`, `TOKEN_AI_OIDC_TOKEN_ENDPOINT`, `TOKEN_AI_OIDC_USERINFO`, plus `TOKEN_AI_MCP_PUBLIC_URL` so metadata points to the published host.

## Persona & Memory Storage (live counts)

- `prompt_modules`: 50 active segments (latest edit: `agent.concierge.tool.solana_send` on 2025‑11‑03).  
- `user_prompt_profiles`: **0** rows (no per-user personas defined yet).  
- `user_memories`: 138 rows (recent entries capture Twitter context and concierge recaps).  
- `user_subscriptions`: 2 active Pro users (IDs prefix `e505d522`, `test-x40`).  
- `user_profiles`: Populated for authenticated users; includes `metadata` + `dossier` JSON (see Postgres for details).  
- Because `user_prompt_profiles` is empty, every transport resolves the default concierge profile today.

## PM2 Transport Processes

| Process | Repo / cwd | Script path | Transport served | Notes |
|---------|------------|-------------|------------------|-------|
| `dexter-api` | `/home/branchmanager/websites/dexter-api` | `dist/server.js` | REST API, OAuth issuer, MCP JWT minting | Feeds every other transport. |
| `dexter-mcp` | `/home/branchmanager/websites/dexter-mcp` | `http-server-oauth.mjs` | ChatGPT & Claude MCP over HTTPS | Uses `MCP_JWT_SECRET` + OIDC env to verify tokens. |
| `dexter-agents` | `/home/branchmanager/websites/dexter-agents` | `npm start -- --hostname 0.0.0.0 --port 3210` | Voice concierge UI | Calls `/prompt-profiles` + session endpoints. |
| `twitter-mention-bot` | `/home/branchmanager/websites/dexter-api` | `npm run twitter:mention-bot` | X/Twitter mentions & DMs | Hits `/internal/twitter/mentions/execute`, relies on concierge profile + memories. |

*(Full PM2 inventory available via `pm2 list`; only connector-relevant entries shown above.)*

## Data Flow Snapshot

```
Supabase (auth) ──┐
                  │  validate session / mint MCP JWT
                  ▼
             dexter-api ──┬─> dexter-agents (voice concierge)
                           ├─> twitter-mention-bot worker
                           └─> dexter-mcp (ChatGPT / Claude MCP)
```

- **Authentication:** Supabase issues sessions; `dexter-api` validates and, when needed, mints Dexter MCP JWTs that downstream transports present to `dexter-mcp`.
- **Persona & Prompts:** `dexter-api` resolves the default concierge profile (because no per-user overrides exist) and supplies transport-specific segments.
- **Tools & Wallets:** Every transport calls back into `dexter-api` for wallet assignment, trading helpers, search, and memory writes.
- **Telemetry:** Completed conversations, memories, tool jobs, and subscriptions all land in the shared Postgres instance managed by `dexter-api`.

## Baseline Metrics (captured 2025-11-06 06:30 UTC)

| Table / Metric | Value |
|----------------|-------|
| `prompt_modules` total | 50 |
| `user_prompt_profiles` total | 0 |
| `user_memories` total | 138 |
| `user_subscriptions` total | 2 (both `pro`, status `active`) |
| `tool_jobs` by status | `completed`: 6, `running`: 18 |
| `tool_jobs` missing `started_at` | 24 rows |
| `tool_jobs` missing `supabase_user_id` | 24 rows |
| Latest `tool_job_artifacts` | `report.html`, `report.md`, `response.json` for jobs `6d5c0b7b-…`, etc. |

*SQL used:* see `psql` queries executed from the `dexter-api` production connection (`DATABASE_URL`).

Keep this document current whenever connectors move or new transports come online. For future work, persona UX / additional transports should reference this snapshot before changing state.***
