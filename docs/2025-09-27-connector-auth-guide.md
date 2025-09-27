# MCP Connector OAuth Guide (2025-09-27)

This note captures the “golden path” for external clients (Claude, ChatGPT, Alexa skills, etc.) to authenticate with the Dexter MCP stack. It consolidates today’s fixes so the flow can be implemented without spelunking through the codebase.

## 1. Dynamic Client Registration (DCR)

Endpoint: `POST https://dexter.cash/mcp/dcr/register`

```json
{
  "redirect_uris": ["https://<your-app>/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "metadata": {
    "client_name": "dexter-alexa-skill"
  }
}
```

A successful request returns a payload containing:

- `client_id` (e.g. `dcr_cac3070b966115f6f9eb5d61ab9c058b`).
- Echoed redirect URIs and metadata.

Make sure every redirect you intend to use is whitelisted in Supabase → Authentication → URL configuration. The current allow list already contains `https://*.dexter.cash`, plus the Claude / ChatGPT callbacks.

## 2. Authorization URL

Clients launch the authorization UI by visiting:

```
https://dexter.cash/mcp/authorize?response_type=code
  &client_id=<dcr_id>
  &redirect_uri=<https://your-app/callback>
  &code_challenge=<PKCE S256 hash>
  &code_challenge_method=S256
  &scope=wallet.read wallet.trade openid
  &state=<opaque_state>
  &resource=https://dexter.cash/mcp
```

The Next.js page under `dexter-fe/app/connector/auth/page.tsx` handles Supabase login, CSRF, and PKCE. When the user approves access it POSTs to `/api/connector/oauth/exchange` and displays the resulting redirect URL.

## 3. Authorization Code Exchange

You can either copy the redirect URL from the UI or automate the same POST:

```
POST https://dexter.cash/api/connector/oauth/exchange
Content-Type: application/json

{
  "request_id": "auth_...",            // from the authorize response
  "refresh_token": "<supabase refresh token>",
  "access_token": "<supabase access token>",
  "supabase_user_id": "<optional user id>"
}
```

The access token + user id were added today so the backend can fall back if Supabase refuses to mint a new refresh token (the `refresh_token_not_found` errors we saw earlier). The JSON response includes:

- `code` – deterministic authorization code bound to `request_id`.
- `redirect_url` – fully composed redirect back to the client.
- `state` – the original state parameter.

## 4. Token Endpoint

Exchange the code with PKCE verification:

```
POST https://dexter.cash/mcp/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<code_...>
&redirect_uri=https://<your-app>/callback
&code_verifier=<original PKCE secret>
```

Response fields of interest:

- `access_token` – Supabase bearer token (validated by `wallets/resolver`).
- `refresh_token` – reuse to keep the session alive.
- `supabase_user_id` – the Dexter Supabase identity.
- `dexter_mcp_jwt` – HS256 JWT signed with `MCP_JWT_SECRET`. Use this as the Authorization header when calling MCP tools (`Authorization: Bearer <dexter_mcp_jwt>`).
- `wallet_public_key` – user’s default wallet when available.

The API now tolerates Supabase returning `refresh_token_not_found`: it reuses the stored access token and still issues a user-scoped MCP JWT so tools no longer fall back to the shared env wallet.

## 5. Token Refresh

```
POST https://dexter.cash/mcp/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=<previous refresh token>
```

The response mirrors the code exchange schema. We also pre-cache the per-user wallet + MCP JWT inside `dexter-api` to avoid repeated lookups.

## 6. MCP Transport

- Streamable HTTP endpoint: `https://mcp.dexter.cash/mcp`.
- Send the `dexter_mcp_jwt` in the `Authorization` header. If a request arrives without a bearer, the server falls back to the shared env token (`TOKEN_AI_MCP_TOKEN`) and you’ll only see the demo wallet (`source: "env"` in the `auth_info` tool output).
- Wallet resolver (`https://dexter.cash/api/wallets/resolver`) now recognizes both Supabase access tokens and `dexter_mcp_jwt`, so tools report `source: "resolver"` once you’ve authenticated.

## 7. Relevant Code Paths

- `websites/dexter-api/src/routes/connectorOAuth.ts` – handles authorize, exchange, and token endpoints. Today’s patch adds the safe fallback when Supabase refresh tokens are missing.
- `websites/dexter-api/src/utils/supabase.ts` – now decodes our MCP JWT to resolve `supabase_user_id` when the API is called with the per-user token.
- `websites/dexter-fe/app/connector/auth/page.tsx` – Next.js UI; captures the Supabase session and posts the extra context during the exchange.
- `websites/dexter-mcp/toolsets/wallet/index.mjs` – looks at `Authorization`/`X-Authorization`/`X-User-Token` headers and reports the `source` field you see from the `auth_info` MCP tool.

## 8. Environment Variables (server side)

| Name | Purpose |
| ---- | ------- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase tenancy + admin capabilities |
| `MCP_JWT_SECRET` | Signs the per-user MCP JWTs |
| `TOKEN_AI_MCP_TOKEN` | Shared fallback bearer for guest sessions |
| `TOKEN_AI_DEFAULT_WALLET_ADDRESS` | Demo wallet address used when no user token is present |
| `CONNECTOR_ALLOWED_REDIRECTS`, `CONNECTOR_ALLOWED_CLIENT_IDS` | Optional comma-separated overrides for DCR output |

Keep this guide with the ChatGPT forensics note so anyone building a connector (Alexa skill, desktop client, etc.) can plug into the flow without reverse-engineering the logs again.
