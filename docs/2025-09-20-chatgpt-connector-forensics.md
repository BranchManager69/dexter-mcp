# 2025-09-20 ChatGPT Connector Forensics

## Why This Snapshot Matters
- This is the only confirmed window where the ChatGPT MCP connector successfully authenticated and pulled tool metadata from dexter.cash.
- The configuration below is reconstructed from server/PM2/nginx logs so we can reproduce the working conditions or diff them against the current setup.

## Primary Evidence
- `~/.pm2/logs/dexter-mcp-out-50.log:2077` – Supabase-issued token accepted, session `0c1a5418-1e65-4284-bdd6-0639e9ee737f` created for user `e505d522-52f4-4ba0-b716-88828d9982db`.
- `~/.pm2/logs/dexter-mcp-out-50.log:2095-2107` – ChatGPT UA fetches both protected-resource and 8414 discovery docs (200 responses) and server advertises issuer `https://dexter.cash/mcp`, client `cid_a859560609a6448aa2f3a1c29f6ab496`.
- `~/.pm2/logs/dexter-mcp-out-67__2025-09-25_00-00-00.log:452` (+ multiple later hits) – service banner shows ChatGPT client `app_X8zY6vW2pQ9tR3dE7nK1jL5gH` still configured when the hosted server restarts.
- `sudo zgrep "ChatGPT-User" /var/log/nginx/dexter-access.log.7.gz` – confirms Cloudflare IPs 172.69.x.x fetching 8414 and protected-resource endpoints at 19:59, 20:01, 20:15 UTC on 2025‑09‑20.

## Environment at the Time (masked values)
Source: `websites/dexter-mcp/.env` (current file still matches historical values) and `pm2 env 6`.

| Key | Value (masked) | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | `https://qdgumpoqnthrjfmqziwm.supabase.co` | Issuer also appeared in PM2 log |
| `SUPABASE_ANON_KEY` | `eyJhbG…rOI_AE` | Needed for Supabase OIDC fallback |
| `TOKEN_AI_OIDC_ISSUER` | `https://qdgumpoqnthrjfmqziwm.supabase.co` | Mirrors Supabase issuer |
| `TOKEN_AI_OIDC_CLIENT_ID` | `cid_a859560609a6448aa2f3a1c29f6ab496` | Only client ID the server now advertises |
| `TOKEN_AI_OIDC_CLIENT_ID_CHATGPT` | `app_X8zY6vW2pQ9tR3dE7nK1jL5gH` | Legacy ChatGPT registration ID (no longer used by `resolveClientId`) |
| `TOKEN_AI_OIDC_AUTHORIZATION_ENDPOINT` | `https://dexter.cash/mcp/authorize` | Enabled “external OIDC” branch |
| `TOKEN_AI_OIDC_TOKEN_ENDPOINT` | `https://dexter.cash/mcp/token` | |
| `TOKEN_AI_OIDC_USERINFO` | `https://dexter.cash/mcp/userinfo` | |
| `TOKEN_AI_MCP_PUBLIC_URL` | `https://dexter.cash/mcp` | Used to compute discovery URLs |
| `TOKEN_AI_MCP_PORT` | `3930` | Local MCP HTTP listener |
| `TOKEN_AI_MCP_TOKEN` | `ff6011…b22c4b` | Shared bearer used by Codex bridge + inspector |
| `MCP_JWT_SECRET` | `MVFfPP…5kGyx8` | Enables HS256 session JWT validation |

## Nginx Routing Configuration (current file matches 20 Sep)
Relevant blocks from `/etc/nginx/sites-available/dexter.cash`:

```nginx
location = /.well-known/oauth-authorization-server/mcp {
    proxy_pass http://127.0.0.1:3930/.well-known/oauth-authorization-server/mcp;
    ...
}
location ^~ /.well-known/oauth-authorization-server {
    proxy_pass http://127.0.0.1:3930$request_uri;
    ...
}
location = /.well-known/oauth-protected-resource/mcp {
    proxy_pass http://127.0.0.1:3930/mcp/.well-known/oauth-protected-resource;
    ...
}
location ^~ /.well-known/oauth-protected-resource {
    proxy_pass http://127.0.0.1:3930$request_uri;
    ...
}
```

These routes eliminated the earlier 302 redirect that stripped `registration_endpoint` from the path-aware 8414 document.

## What’s Different Today
- Curling the path-aware 8414 currently returns `"mcp.client_id": null`, despite `TOKEN_AI_OIDC_CLIENT_ID` being set. (`curl -sS https://dexter.cash/.well-known/oauth-authorization-server/mcp | jq '."mcp.client_id"'`)
- `resolveClientId` in `http-server-oauth.mjs` now always returns `TOKEN_AI_OIDC_CLIENT_ID`, so the `app_*` value is ignored. The metadata writer likely needs to be refreshed to include the cid_* client again.
- `/tmp/dexter-mcp-proxy.log` shows the stdio proxy repeatedly reconnecting with `TypeError: terminated` as soon as Codex starts; the working log from 20 Sep did not include these errors (the proxy wasn’t in use yet).

## Recreating the Working Setup
1. **Advertise the client ID again**
   - Inspect the metadata generator in `http-server-oauth.mjs` (search `mcp.client_id`). Make sure the JSON served at `/.well-known/oauth-authorization-server/mcp` embeds `cid_a859…6ab496`.
   - Verify with `curl` after restart.
2. **Clean the MCP env**
   - Remove `TOKEN_AI_OIDC_CLIENT_ID_CHATGPT` and the explicit `TOKEN_AI_OIDC_*_ENDPOINT` overrides if we want to stay on the Supabase defaults; otherwise confirm the endpoints match what ChatGPT successfully used on 20 Sep.
   - Restart PM2: `pm2 restart dexter-mcp && pm2 save`.
3. **Manual bridge test**
   - `cd ~/websites/dexter-mcp`
   - `node dexter-mcp-stdio-bridge.mjs --url https://mcp.dexter.cash/mcp --bearer ff6011…b22c4b --verbose`
   - Tail `/tmp/dexter-mcp-proxy.log` – ensure the SSE stream stays connected (no immediate “TypeError: terminated”).
4. **Codex end-to-end**
   - Re-enable `[mcp_servers.dexter]` in `~/.codex/config.toml`.
   - Launch Codex and confirm tool listing succeeds; capture fresh logs if disconnections persist.

## Log References
- PM2: `~/.pm2/logs/dexter-mcp-out-50.log:2077-2108`
- PM2 (later banners): `~/.pm2/logs/dexter-mcp-out-67__2025-09-25_00-00-00.log:452`, `...-67__2025-09-26_00-00-00.log:1131`
- Nginx access: `/var/log/nginx/dexter-access.log.7.gz:2650-2695`
- Current proxy errors: `/tmp/dexter-mcp-proxy.log` (post rotation marker `*** restart 2025-09-27T07:05:…`)

Keep this document updated as new evidence surfaces; it’s the anchor for reproducing the one successful ChatGPT session to date.
