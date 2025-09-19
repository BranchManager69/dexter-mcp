# Dexter MCP

Minimal MCP server that exposes the Supabase-backed wallet tools used by Dexter connectors. OAuth is delegated to an external OIDC provider (Dexter API or Supabase); this service no longer ships a built-in issuer.

## Features
- `resolve_wallet`, `list_my_wallets`, `auth_info`, `set_session_wallet_override`
- Supabase bearer validation (via `/api/wallets/resolver`)
- Optional local bearer override for testing

## Setup
```
npm install
cp .env.example .env
```
Populate at least:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`
- `DEXTER_API_BASE_URL` (e.g. `http://127.0.0.1:3030`)
- `TOKEN_AI_MCP_PUBLIC_URL` (public HTTPS URL) and `TOKEN_AI_MCP_PORT`
- `TOKEN_AI_OIDC_CLIENT_ID` and accompanying `TOKEN_AI_OIDC_*` endpoints that point at the Dexter API (or Supabase) for connector OAuth

## Development
```
npm start # runs http-server-oauth.mjs (defaults to port 3930)
```
Visit `http://localhost:3930/mcp` to confirm the HTTP transport responds.

## Environment Variables
See `.env.example` for the minimal list. In addition, you can set:
- `TOKEN_AI_MCP_TOOLSETS` to control which toolsets load by default (comma-separated keys; default is every registered toolset)
- `TOKEN_AI_MCP_TOKEN` to require a static bearer in addition to OAuth tokens
- `TOKEN_AI_MCP_CORS` to control cross-origin requests (default `*`)

## Toolsets
- Active MCP tools live under `toolsets/`, one directory per domain (currently only `wallet/`).
- Override the loaded set at runtime with CLI flags (`node server.mjs --tools=wallet,trading`) or HTTP query params (`/mcp?tools=wallet`).
- Per-instance defaults fall back to loading every registered toolset; define `TOKEN_AI_MCP_TOOLSETS` only when you need to narrow the set.

## Notes
- The runtime server only ships wallet tools. Legacy Token-AI modules (trading, socials, reports, etc.) are preserved under `legacy-tools/` for reference but are not loaded.
- All Supabase access goes through Dexter API endpoints; the MCP no longer reaches Prisma directly.
