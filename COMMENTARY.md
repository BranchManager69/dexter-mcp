You’re right—I was talking about the wrong thing before. We’re not in 2023 plugin-land; we’re in 2025 MCP connector land. Here’s the **straight, current** picture of what OpenAI (ChatGPT) expects for **OAuth with MCP connectors**, and why “null client id / `oauth_client_params: null`” is biting you.

---

## What OpenAI expects (MCP + OAuth, distilled)

**At a protocol level (MCP Authorization spec):**

1. **HTTP transport uses OAuth 2.1 + PKCE.**
   Clients (ChatGPT) authenticate to your **MCP server** using Authorization Code + PKCE. Tokens go in the `Authorization: Bearer …` header on *every* HTTP/SSE request. No query‑string tokens. ([Model Context Protocol][1])

2. **Discovery is mandatory, in two steps:**

   * Your MCP server must expose **OAuth Protected Resource Metadata** at
     `/.well-known/oauth-protected-resource` (PRM). It must include:

     * `"resource"`: the canonical URI of your MCP server (see below)
     * `"authorization_servers"`: array of AS issuers
       And when unauthenticated, your server must return **401** with
       `WWW-Authenticate: Bearer resource_metadata="<PRM URL>"`. ([Model Context Protocol][1])
   * Your Authorization Server must expose **Authorization Server Metadata** (AS metadata, RFC 8414), typically `/.well-known/openid-configuration`, with `authorization_endpoint`, `token_endpoint`, and (crucially) **`registration_endpoint`** if you support DCR. ([Model Context Protocol][1])

3. **Dynamic Client Registration (DCR) is *SHOULD* in the spec—but ChatGPT effectively expects it.**
   MCP spec says clients & servers **SHOULD** support DCR. In practice, ChatGPT’s Custom Connector flow tries to dynamically register and will fail if it can’t resolve a client, which is why you see “Failed to resolve OAuth client / `oauth_client_params: null`”. ([Model Context Protocol][1])

4. **The `resource` parameter is required in both the `/authorize` and `/token` requests.**
   It must be the canonical URI of your MCP server (e.g., `https://api.example.com/mcp`, no fragments; be consistent about the trailing slash). Your server must validate audience binding accordingly. ([Model Context Protocol][1])

5. **PKCE (S256) and public clients.**
   AS metadata should advertise `code_challenge_methods_supported: ["S256"]`. Most agent clients are **public** (no client secret), so your AS must allow `token_endpoint_auth_methods_supported: ["none"]` for the registered client. ([Model Context Protocol][1])

6. **ChatGPT product bit:** Custom connectors in ChatGPT are MCP clients. You add them in Settings → Connectors; the help center points you to MCP docs for custom connectors. ([OpenAI Help Center][2])

---

## What “Failed to resolve OAuth client / `oauth_client_params: null`” actually means

It means the ChatGPT client couldn’t acquire a usable `client_id` for your AS. Common culprits I’m seeing (and they map to forum reports):

1. **Your PRM or 401 challenge is missing or malformed.**

   * 401 didn’t include `WWW-Authenticate: Bearer resource_metadata="<PRM URL>"`.
   * PRM JSON missing `"authorization_servers"`, or `"resource"` doesn’t exactly match the canonical MCP URI you’re serving (trailing‑slash mismatches are a classic). ([IETF Datatracker][3])

2. **AS metadata lacks `registration_endpoint`, or it’s blocked.**
   ChatGPT attempts DCR; if your metadata doesn’t advertise a registration endpoint, or it’s not reachable or errors out, you’ll get the null client state. ([Model Context Protocol][1])

3. **Your DCR endpoint responds but doesn’t return a `client_id`.**
   (Invalid payload validation, domain restrictions on `redirect_uris`, etc.) Community threads show the exact `Failed to resolve OAuth client` / `oauth_client_params: null` symptom. ([OpenAI Community][4])

4. **You’re rejecting the `resource` parameter or not propagating it.**
   Some libraries ignore `resource`. MCP requires the client to send it and your AS flow must tolerate it (and bind audience to the MCP server). ([Model Context Protocol][1])

5. **You’re forcing confidential clients or disallowing `token_endpoint_auth_methods_supported: ["none"]`.**
   Public agent clients can’t hold a secret; rejecting that blocks registration. ([Model Context Protocol][1])

6. **Provider doesn’t support DCR and you aren’t proxying.**
   GitHub, Google, Azure, etc., do **not** expose DCR on their public auth. Without an OAuth proxy or a full AS in front, ChatGPT can’t register (hence null client). ([FastMCP][5])

> You said “I’m not doing any Bearer authentication.” Unfortunately, current MCP HTTP auth requires **Bearer** headers on every request (including the SSE GET). If it worked for 5–10 minutes, you likely hit a permissive path or a transient bug. The spec is clear here. ([Model Context Protocol][1])

---

## Make it work: a **tight checklist** (copy/paste friendly)

**A. Sanity-check your 401 + PRM**

```bash
# 1) Unauthed request to your MCP endpoint (SSE or streamable HTTP)
curl -i https://YOUR_HOST/mcp

# Expect 401 with:
# WWW-Authenticate: Bearer resource_metadata="https://YOUR_HOST/.well-known/oauth-protected-resource"

# 2) Fetch your Protected Resource Metadata
curl -s https://YOUR_HOST/.well-known/oauth-protected-resource | jq
```

**Minimal correct PRM:**

```json
{
  "resource": "https://YOUR_HOST/mcp",
  "authorization_servers": ["https://AUTH_HOST"], 
  "scopes_supported": ["mcp:tools:*"],
  "bearer_methods_supported": ["header"],
  "resource_name": "My MCP"
}
```

If `"resource"` doesn’t exactly match the canonical MCP server URI you’re using, clients MUST ignore it. That alone can break discovery. ([IETF Datatracker][3])

**B. Verify AS metadata (RFC 8414)**

```bash
curl -s https://AUTH_HOST/.well-known/openid-configuration | jq
```

You should see at least:

```json
{
  "issuer": "https://AUTH_HOST",
  "authorization_endpoint": "https://AUTH_HOST/authorize",
  "token_endpoint": "https://AUTH_HOST/token",
  "registration_endpoint": "https://AUTH_HOST/register",
  "jwks_uri": "https://AUTH_HOST/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code","refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"]
}
```

Missing `registration_endpoint` ⇒ ChatGPT can’t DCR ⇒ null client. ([Model Context Protocol][1])

**C. Test DCR (the heart of your error)**

POST what ChatGPT will (semantically) send—client name + redirect URIs + grants. Your endpoint must return a **`client_id`** (no secret for public clients).

```bash
curl -s -X POST https://AUTH_HOST/register \
  -H 'Content-Type: application/json' \
  -d '{
    "client_name": "ChatGPT (MCP Connector)",
    "redirect_uris": ["https://https.example/anything"], 
    "grant_types": ["authorization_code","refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none"
  }' | jq
```

This should return something like:

```json
{
  "client_id": "abcd-1234-…",
  "client_name": "ChatGPT (MCP Connector)",
  "redirect_uris": ["…"],
  "grant_types": ["authorization_code","refresh_token"],
  "token_endpoint_auth_method": "none"
}
```

> **Note on redirect URIs:** With **DCR**, you should not hardcode a finite allowlist of ChatGPT URIs. The client will register an HTTPS redirect that it controls. If you must gate, allow general HTTPS and `localhost` loopbacks per the spec. (Some folks have observed ChatGPT using URIs like `https://chatgpt.com/connector_platform_oauth_redirect` or `/oauth/callback`—but don’t rely on a fixed list). ([Gist][6])

**D. Ensure your AS tolerates the `resource` param** on both `/authorize` and `/token`. Many generic OAuth stacks need this enabled/configured. (MCP requires clients to include it; your RS must audience‑bind tokens to your MCP server.) ([Model Context Protocol][1])

**E. Finally, verify that authorized calls carry the token in the header:**

```http
GET /mcp/sse HTTP/1.1
Host: YOUR_HOST
Authorization: Bearer eyJhbGciOi...
```

Your server must validate the token (issuer, signature, **audience = your MCP server**). Do **not** pass the client’s token downstream. ([Model Context Protocol][1])

---

## If your IdP doesn’t support DCR (GitHub/Google/Azure/etc.)

Use an **OAuth Proxy** in front of the provider (FastMCP has this built‑in). The proxy:

* Presents a **DCR‑compliant interface** to ChatGPT and returns a synthetic `client_id`.
* Handles upstream provider auth with your static app credentials.
* Forwards/validates PKCE; stores the client’s dynamic callback; then relays the code/tokens. ([FastMCP][5])

**FastMCP example (proxying any provider):**

```python
from fastmcp import FastMCP
from fastmcp.server.auth import OAuthProxy
from fastmcp.server.auth.providers.jwt import JWTVerifier

auth = OAuthProxy(
    upstream_authorization_endpoint="https://provider.com/oauth/authorize",
    upstream_token_endpoint="https://provider.com/oauth/token",
    upstream_client_id="YOUR_CLIENT_ID",
    upstream_client_secret="YOUR_CLIENT_SECRET",
    token_verifier=JWTVerifier(
        jwks_uri="https://provider.com/.well-known/jwks.json",
        issuer="https://provider.com",
        audience="https://YOUR_HOST/mcp"
    ),
    base_url="https://YOUR_HOST"   # your server, for callback
)

mcp = FastMCP(name="My Server", auth=auth)
```

For GitHub specifically, FastMCP ships a `GitHubProvider` that wraps the proxy pattern since GitHub doesn’t support DCR. ([FastMCP][7])

If you’re using a modern IdP that **does** support DCR (e.g., WorkOS AuthKit, Descope, etc.), go enable it in the dashboard (it’s off by default in some). ([WorkOS][8])

---

## Common foot‑guns (aka “stuff that blows up at 2 a.m.”)

* **Trailing slashes / canonical URI:** If your PRM `"resource"` is `https://api.example.com/mcp` but your actual connect URL is `https://api.example.com/mcp/`, the MCP client may reject your metadata. Match *exactly*. ([IETF Datatracker][3])
* **`token_endpoint_auth_methods_supported`:** Include `"none"` for public clients. Otherwise registration/authorization will choke. ([Model Context Protocol][1])
* **`registration_endpoint` missing or 403:** No DCR → ChatGPT can’t get a client → your “null client id”. ([OpenAI Community][4])
* **CORS / redirects:** Browser-consented flows happen in the ChatGPT UI; ensure your authorize/callback chain and cookies (if used) don’t get CORS‑blocked. (Community posts suggest callback mismatches and 400s are common.) ([Gist][6])
* **`resource` param dropped:** Many OAuth libs ignore unknown params; MCP requires it. Ensure your authorize and token handlers accept it and issue **audience‑bound** tokens to your MCP RS. ([Model Context Protocol][1])
* **Providers without DCR:** Use an OAuth proxy (FastMCP OAuth Proxy) or stand up your own AS that does DCR. Don’t fight the tide. ([FastMCP][5])

---

## Why this matches what you’re seeing **right now**

* There are fresh reports of **the same** ChatGPT connector error string you quoted—*today-ish*—and they’re all consistent with “client couldn’t register; can’t resolve OAuth client” (aka no `client_id`). ([OpenAI Community][4])
* The official MCP spec (rev **2025‑06‑18**) locks in: PRM discovery, AS metadata, **PKCE**, **`resource`**, and Bearer headers. If your server deviates (e.g., no Bearer), ChatGPT is going to be strict. ([Model Context Protocol][1])

---

## Quick “known-good” shapes you can diff against

**Protected Resource Metadata**

```json
{
  "resource": "https://mcp.yourdomain.com/mcp",
  "authorization_servers": ["https://auth.yourdomain.com"],
  "scopes_supported": ["mcp:tools:*"],
  "bearer_methods_supported": ["header"],
  "resource_name": "Your MCP"
}
```

**AS Metadata**

```json
{
  "issuer": "https://auth.yourdomain.com",
  "authorization_endpoint": "https://auth.yourdomain.com/authorize",
  "token_endpoint": "https://auth.yourdomain.com/token",
  "registration_endpoint": "https://auth.yourdomain.com/register",
  "jwks_uri": "https://auth.yourdomain.com/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"]
}
```

**401 challenge (unauth’d)**

```
WWW-Authenticate: Bearer resource_metadata="https://mcp.yourdomain.com/.well-known/oauth-protected-resource"
```

These are directly aligned with the MCP Authorization + RFC 9728 requirements. ([Model Context Protocol][1])

---

## If you want the shortest path to green

* **Option A (IdP supports DCR):** Turn on DCR in your IdP (e.g., WorkOS AuthKit), make sure AS metadata exposes `registration_endpoint`, and ensure `token_endpoint_auth_methods_supported` includes `"none"`. ([WorkOS][8])
* **Option B (IdP does not support DCR):** Put **FastMCP OAuth Proxy** in front of it. That’s the “this works with ChatGPT connectors” fix that embraces MCP’s expectations without wrestling your IdP. ([FastMCP][5])

---

If you paste (scrubbed) **your PRM JSON**, **AS metadata JSON**, and your DCR **`/register`** response, I’ll point to exactly where it’s off. But the root cause for your “null client id” is almost certainly **DCR not available / not returning a `client_id`** or **discovery not pointing to a registrable AS**. And yes—**Bearer headers** are the law of the land here, not optional.

**References / sources**
• MCP Authorization spec (rev 2025‑06‑18): discovery, DCR, PKCE, `resource`, Bearer headers. ([Model Context Protocol][1])
• OAuth Protected Resource Metadata (RFC 9728): PRM shape and `WWW-Authenticate: … resource_metadata=…`. ([IETF Datatracker][3])
• ChatGPT Connectors help / Custom connectors (MCP). ([OpenAI Help Center][2])
• FastMCP OAuth Proxy & GitHub OAuth integration docs (bridging DCR). ([FastMCP][5])
• WorkOS / Stytch on MCP DCR support & setup. ([WorkOS][8])
• Community reports of **“Failed to resolve OAuth client / `oauth_client_params: null`”** in ChatGPT connectors. ([OpenAI Community][4])

If you want me to be even more ruthless: stop trying to outsmart the spec—give it the PRM → AS metadata with **DCR** and **PKCE** it expects, or drop an OAuth Proxy in front of your provider. Two days of head‑scratching fixed in 20 minutes.

[1]: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization "Authorization - Model Context Protocol"
[2]: https://help.openai.com/en/articles/11487775-connectors-in-chatgpt "Connectors in ChatGPT | OpenAI Help Center"
[3]: https://datatracker.ietf.org/doc/html/rfc9728 "
            
                RFC 9728 - OAuth 2.0 Protected Resource Metadata
            
        "
[4]: https://community.openai.com/t/trouble-with-chatgpt-connector-oauth-detailed/1359112?utm_source=chatgpt.com "Trouble with ChatGPT Connector OAuth (Detailed)"
[5]: https://gofastmcp.com/servers/auth/oauth-proxy "OAuth Proxy - FastMCP"
[6]: https://gist.github.com/ruvnet/7b6843c457822cbcf42fc4aa635eadbb?utm_source=chatgpt.com "ChatGPT MCP Developer Mode MCP - Complete Tutorial"
[7]: https://gofastmcp.com/integrations/github "GitHub OAuth  FastMCP - FastMCP"
[8]: https://workos.com/docs/authkit/mcp?utm_source=chatgpt.com "Model Context Protocol – AuthKit – WorkOS Docs"
