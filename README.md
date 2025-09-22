<p align="center">
  <img src="https://docs.dexter.cash/previews/dexter-stack-wordmark.svg" alt="Dexter Stack wordmark" width="360">
</p>

<p align="center">
  <a href="https://github.com/BranchManager69/dexter-api">Dexter API</a>
  · <a href="https://github.com/BranchManager69/dexter-fe">Dexter FE</a>
  · <strong>Dexter MCP</strong>
  · <a href="https://github.com/BranchManager69/dexter-ops">Dexter Ops</a>
  · <a href="https://github.com/BranchManager69/pumpstreams">PumpStreams</a>
</p>

<h1 align="center">Dexter MCP</h1>

<p align="center">
  <a href="https://nodejs.org/en/download"><img src="https://img.shields.io/badge/node-%3E=20.0-green.svg" alt="Node >= 20"></a>
  <a href="https://mcp.dexter.cash/mcp"><img src="https://img.shields.io/badge/MCP-https%3A%2F%2Fmcp.dexter.cash%2Fmcp-blue.svg" alt="MCP endpoint"></a>
  <a href="https://dexter.cash"><img src="https://img.shields.io/badge/stack-Dexter%20Connectors-purple.svg" alt="Dexter connectors"></a>
</p>

Fully managed Model Context Protocol (MCP) bridge for Dexter. The service exposes a curated set of connector tools (wallet resolution, diagnostics, session overrides) over both stdio and HTTPS, reusing the Dexter OAuth infrastructure for user-level access control.

---

## Highlights

- **Production-ready HTTP transport** – OAuth2/OIDC, bearer fallback, SSE streaming, and metadata endpoints compatible with Claude & ChatGPT connectors.
- **Wallet-first toolset** – `resolve_wallet`, `list_my_wallets`, `auth_info`, `set_session_wallet_override`, plus per-session overrides backed by Supabase.
- **Composable tool registry** – drop new bundles into `toolsets/`, enable them via env, CLI flags, or `?tools=` query parameters.
- **Dual-runtime** – stdio entrypoint for local agents & Codex, HTTPS entrypoint for public connectors (proxied at `https://dexter.cash/mcp` and `https://mcp.dexter.cash/mcp`).
- **Supabase-native auth** – validates incoming tokens through Dexter API/Supabase resolver, injects identity headers for downstream tools, and preserves token caching to limit IdP calls.

---

## Dexter Stack

| Repo | Role |
|------|------|
| [`dexter-api`](https://github.com/BranchManager69/dexter-api) | Issues realtime tokens, proxies MCP, x402 billing |
| [`dexter-fe`](https://github.com/BranchManager69/dexter-fe) | Next.js frontend for voice/chat surfaces |
| [`dexter-ops`](https://github.com/BranchManager69/dexter-ops) | Shared operations scripts, PM2 config, nginx templates |
| [`pumpstreams`](https://github.com/BranchManager69/pumpstreams) | Pump.fun analytics suite (adjacent tooling) |

---

## Quick Start

```bash
git clone https://github.com/BranchManager69/dexter-mcp.git
cd dexter-mcp
npm install
cp .env.example .env

# populate .env with Supabase + OAuth settings (see Configuration)

# HTTPS transport (port 3930)
npm start

# or stdio transport for local tools
node server.mjs --tools=wallet
```

Verify the HTTP transport:

```bash
curl -sS http://localhost:3930/mcp/health | jq
```

With the public proxy in place you can also query:

```bash
curl -H "Authorization: Bearer <TOKEN_AI_MCP_TOKEN>" \
     https://mcp.dexter.cash/mcp/health
```

---

## Authentication

| Mode | When to use | How |
|------|-------------|-----|
| **OAuth2 / OIDC** | Claude, ChatGPT, hosted connectors | Set `TOKEN_AI_MCP_OAUTH=true` and supply `TOKEN_AI_OIDC_*` (or Supabase) endpoints. Users sign in via the Dexter IdP; tokens are validated on every session. |
| **Bearer token** | Service-to-service calls, Codex, Cursor | Define `TOKEN_AI_MCP_TOKEN`. Any request presenting the matching `Authorization: Bearer …` header is accepted without hitting the IdP. |
| **Allow-any (demo)** | Local demos only | Set `TOKEN_AI_MCP_OAUTH_ALLOW_ANY=1`. Skips verification—**never enable in production**. |

Metadata endpoints (for connector discovery) are exposed at:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`
- `/.well-known/openid-configuration`

These routes are proxied on both `dexter.cash` and `mcp.dexter.cash`, so connectors can follow the same issuer regardless of which hostname they use.

---

## Toolsets

Tool bundles live under `toolsets/<name>/index.mjs` and register themselves through the manifest in `toolsets/index.mjs`.

Currently shipped:

- **general** – Static `search` / `fetch` helpers that surface curated Dexter OAuth + connector docs.
- **pumpstream** – `pumpstream_live_summary` wrapper for `https://pump.dexter.cash/api/live` with paging, search, and filter controls.
- **wallet** – Supabase-backed wallet resolution, diagnostics, and per-session overrides (used by all Dexter connectors).

Selection options:

- **Environment default:** leave `TOKEN_AI_MCP_TOOLSETS` unset to load every registered bundle (`general,pumpstream,wallet`). Set it (comma-separated) to restrict the selection, e.g. `TOKEN_AI_MCP_TOOLSETS=wallet`.
- **CLI/stdio:** `node server.mjs --tools=wallet`.
- **HTTP query:** `POST /mcp?tools=wallet`.
- **Codex:** set `TOKEN_AI_MCP_TOOLSETS` in the env before launching, or add `includeToolsets` when invoking `buildMcpServer` manually.

Legacy Token-AI bundles remain in `legacy-tools/` for reference. They are not registered by default but can be migrated into `toolsets/` as they are modernized.

---

## Configuration Reference

Populate `.env` (or inject via process manager) with at least:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` | Supabase project credentials used by the wallet resolver. |
| `DEXTER_API_BASE_URL` | Dexter API base URL (e.g. `https://api.dexter.cash`). Wallet resolver requests are routed through this API. |
| `TOKEN_AI_MCP_PUBLIC_URL`, `TOKEN_AI_MCP_PORT` | Public HTTPS URL + bind port for the HTTP transport. |
| `TOKEN_AI_OIDC_*` | External IdP endpoints when `TOKEN_AI_MCP_OAUTH=true` (authorization, token, userinfo, issuer, JWKS, scopes, client ID). |
| `TOKEN_AI_MCP_TOKEN` | Optional static bearer for service-to-service access. |
| `TOKEN_AI_MCP_TOOLSETS` | Comma-separated list of toolsets to auto-load. Defaults to all registered sets. |
| `TOKEN_AI_MCP_CORS` | Allowed origin(s) for HTTP transport (default `*`). |

StdIO launches also load environment files from the repo root and `token-ai/.env`, so shared secrets can be stored once and reused across services.

---

## Development & PM2

Run locally:

```bash
# HTTP transport with auto-reload (e.g. via nodemon)
TOKEN_AI_MCP_PORT=3930 npm start

# Stdio session for quick manual tests
node server.mjs --tools=wallet

# Connect with Codex (bearer token example)
# ~/.codex/config.toml
# [mcp_servers.dexter]
# transport = "http"
# url = "https://mcp.dexter.cash/mcp"
# headers = { Authorization = "Bearer <TOKEN_AI_MCP_TOKEN>" }
```

### Harness smoke (UI + API)

The helper script can exercise the new pagination either through the Playwright UI flow or directly via the MCP API:

```bash
# UI + API (default)
export HARNESS_COOKIE='cf_clearance=...; sb-xyz-auth-token=...; sb-xyz-refresh-token=...'
npm run test:pumpstream -- --prompt "Give me a pumpstream summary with page size 5 and show the next page."

# UI only
npm run test:pumpstream -- --mode ui --headful --prompt "List pump streams"

# API only (no browser)
export HARNESS_MCP_TOKEN='Bearer <mcp bearer>'   # if session response redacts the header
export HARNESS_SESSION_URL='https://api.dexter.cash/realtime/sessions'  # optional override
npm run test:pumpstream -- --mode api --page-size 10 --json --no-artifact
```

The harness auto-loads `.env`, so you can keep `HARNESS_COOKIE`, `HARNESS_AUTHORIZATION`, `HARNESS_MCP_TOKEN`, and other overrides there instead of exporting them per run (see `.env.example`). When running `--mode both`, the script will still execute API mode even if UI credentials are missing or the Playwright run fails—it logs the UI error and continues.

Flags (`--prompt`, `--url`, `--wait`, `--headful`, `--no-artifact`, `--json`, `--mode`, `--page-size`) are forwarded to the underlying runners. UI mode requires a fresh Supabase session (`HARNESS_COOKIE` or `HARNESS_AUTHORIZATION`). API mode falls back to guest sessions but can reuse the same cookies/headers to hop past Cloudflare; if the session payload redacts the MCP header, provide `HARNESS_MCP_TOKEN` (or reuse `TOKEN_AI_MCP_TOKEN`).

For production, PM2 is managed through `dexter-ops/ops/ecosystem.config.cjs`. The config already forwards `TOKEN_AI_MCP_OAUTH=true` and supporting variables; restart via:

```bash
pm2 restart dexter-mcp
pm2 logs dexter-mcp
```

---

## Architecture Notes

- **`common.mjs`** – builds the MCP server, normalizes Zod schemas, wraps tool registration with logging.
- **`toolsets/`** – declarative manifest of tool bundles plus the wallet toolset implementation.
- **Toolset authoring guide:** see `toolsets/ADDING_TOOLSETS.md` for step-by-step instructions and examples (including the `pumpstream` toolset).
- **`server.mjs`** – stdio entrypoint (used by local agents and Codex); respects `--tools=` flags.
- **`http-server-oauth.mjs`** – HTTPS transport with OAuth/OIDC, session caching, and metadata routes (still contains a Prisma-backed fallback to seed per-session wallet overrides).
- **`legacy-tools/`** – archived Token-AI tools kept for reference during migration.

Supabase interactions flow through Dexter API helpers for consistent auth enforcement. The only remaining Prisma access is the wallet-override seeding noted above; retire it when the resolver exposes a "default wallet" flag.

---

## Related Repositories

- [dexter-api](../dexter-api) – OAuth issuer, wallet resolver, and connector orchestration.
- [dexter-fe](../dexter-fe) – Web frontend (Claude/ChatGPT connector auth, realtime demos).
- [pumpstreams](../pumpstreams) – Monitoring suite that inspired this README structure.

---

## License

Private – internal Dexter connector infrastructure.
