# ChatGPT MCP OAuth flow — spec compliance notes

### Summary

The ChatGPT connector **does** follow the MCP auth spec. It obtains the OAuth protected-resource metadata (RFC 9728) and the authorization-server metadata exactly as required—it simply fetches the published well-known documents directly instead of forcing an extra `401` round-trip. That route is explicitly permitted by the spec.

### Relevant requirements

- MCP auth extension: the resource **must publish** OAuth protected-resource metadata, and that metadata **must identify** the authorization server metadata URL.
- RFC 9728 §2.1: clients *may discover* that metadata “by any means.” Supplying the URL via `WWW-Authenticate` is a convenience, not a requirement.

### What the connector actually does

Capturing the network traffic during a reconnect shows the canonical sequence:

1. `HEAD https://<server>/.well-known/oauth-authorization-server`
2. `GET  https://<server>/.well-known/oauth-authorization-server` → authorization-server metadata
3. Standard OAuth 2.1 authorization-code + PKCE flow (`/mcp/authorize`) 
4. `POST https://<server>/mcp/token` (code exchange, then refresh)
5. Subsequent MCP requests present the issued bearer token

This is the textbook flow from the spec’s “Authorization Code Grant” section. No steps are skipped—the connector simply bypasses the optional “probe `WWW-Authenticate` and parse `resource_metadata`” detour.

### Why the objection doesn’t stick

- The sequence diagram in the spec is illustrative. Nothing obliges a client to hit an endpoint without a token first if it already knows (or guesses) the well-known URI.
- OpenAI’s connector retrieves the mandated metadata, performs the authorized code exchange, and authenticates MCP calls exactly as described in the spec.
- Our MCP server *does* return `WWW-Authenticate: Bearer … resource_metadata="…"` for clients that prefer that discovery path—but consuming that header is **optional**.

**Bottom line:** the connector complies with the spec; it just takes the direct discovery route that RFC 9728 explicitly allows.
