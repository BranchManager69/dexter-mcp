# Token‑AI MCP Servers (Unified /mcp)

This folder contains the Model Context Protocol (MCP) servers for Token‑AI. The unified public endpoint lives at `/mcp` using the official Streamable HTTP transport. OAuth is supported for user-facing connectors (Claude). A static bearer token is also supported for backend/API usage (OpenAI Responses, Node SDK, UI proxy) when OAuth is disabled.

- HTTP server (OAuth‑capable): `mcp/http-server-oauth.mjs` (also supports bearer‑only when `TOKEN_AI_MCP_OAUTH=false`)
- Stdio server (optional/local): `mcp/server.mjs`
- Shared tool registration: `mcp/common.mjs`

Legacy note: The old ChatGPT-specific SSE server (`mcp/http-server-chatgpt.mjs`) is archived under `mcp/_archive/` and no longer used in Dexter.

## Toolset Scoping (Reduce Context Size)

By default, the MCP server exposed all tool groups, which can bloat model context. You can now scope tools globally, per session (HTTP), or per process (stdio).

- Global (env):
  - `TOKEN_AI_MCP_TOOLSETS=all` (default)
  - Or a CSV of groups: `wallet,program,runs,reports,voice,web,trading`
  - Example: `TOKEN_AI_MCP_TOOLSETS=reports,web` for a lightweight research setup

- Per-session (HTTP):
  - Initialize with `POST /mcp?tools=trading,wallet,reports`
  - Subsequent requests reuse the same session with that toolset; no need to repeat the param

- Per-process (STDIO):
  - Start with `node alpha/dexter-mcp/server.mjs --tools=trading,wallet,reports`
  - Same group names as HTTP; effect lasts for the lifetime of the process

- Trading tools: advanced only. We keep preview/execute/unified tools and remove deprecated helpers over time.

Nothing changes unless you set these flags; defaults preserve existing behavior and tests.

## Quick Start

- Install deps once in this repo: `npm install`
- Stdio MCP (spawned by client): `npm run mcp`
- HTTP MCP (listens on a port): `npm run mcp:http`
- Smoke tests:
  - Stdio: `npm run test:mcp`
  - HTTP: `npm run test:mcp:http`
  - Predictions (stdio): `node token-ai/scripts/test-predictions.mjs --tweet=1956196249452916913 [--mint=<SOL_MINT>] [--minutes=1440]`
    - Env: set `BIRDEYE_API_KEY` to enable price verification; DB must contain the tweet for non-scraping tools.

PM2 (production):
- Apps (ecosystem): `dexter-api`, `dexter-fe`, `dexter-mcp`
- Common commands:
  - Start: `pm2 start alpha/ecosystem.config.cjs --only dexter-mcp`
  - Status: `pm2 describe dexter-mcp`
  - Live logs: `pm2 logs dexter-mcp`
  - Restart: `pm2 restart dexter-mcp && pm2 save`

## Endpoints and Transports

### Stdio
- Typical for local tools: MCP client spawns `node /abs/path/to/alpha/dexter-mcp/server.mjs`
- No port or network; lifecycle bound to client process

### HTTP (Streamable HTTP)
- URL: `http://localhost:${TOKEN_AI_MCP_PORT:-3930}/mcp`
- Auth: Bearer token via `TOKEN_AI_MCP_TOKEN` or OAuth bearer (when OAuth enabled)
- CORS: `TOKEN_AI_MCP_CORS` (default `*`) and `Mcp-Session-Id` exposed
- Implementation: `mcp/http-server-oauth.mjs` using `StreamableHTTPServerTransport`
  - Per-session scoping: `POST /mcp?tools=...` as described above
  - Through the UI proxy: `POST /mcp-proxy?tools=...&userToken=...`

### HTTP (OAuth variant)

- Start: `npm run mcp:http:oauth`
- Metadata endpoints (when `TOKEN_AI_MCP_OAUTH=true`):
  - `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration`
- Provider: Generic OIDC. Configure your own identity provider (Auth0/Okta/Google/Keycloak/etc.) via env vars below. GitHub is supported only if explicitly configured and is no longer the default.
- Client flow:
  1. ChatGPT (or another MCP client) performs OAuth Authorization Code + PKCE with your OIDC provider.
  2. Initialize: POST to `/mcp` with `Authorization: Bearer <token>`.
     - Server returns `Mcp-Session-Id` header.
  3. Subsequent POST/GET: include `Mcp-Session-Id: <id>`; Authorization may be omitted (session reuse).
  4. Optional: `MCP-Protocol-Version: 2025-06-18` header per spec.
- Backwards-compatible: stdio flow unchanged. For bearer‑only behavior, run `http-server-oauth.mjs` with `TOKEN_AI_MCP_OAUTH=false` and set `TOKEN_AI_MCP_TOKEN`.

#### Claude/ChatGPT Connector Setup

Connect Claude/ChatGPT directly to this MCP server:

- Direct: `Server URL: https://your.host/mcp`.
  - Env on the OAuth server:
    - `TOKEN_AI_MCP_OAUTH=true`
    - `TOKEN_AI_MCP_PUBLIC_URL=https://your.host/mcp`
    - OIDC provider config (choose one):
      - Auth0/Okta/Keycloak/etc.: set `TOKEN_AI_OIDC_AUTHORIZATION_ENDPOINT`, `TOKEN_AI_OIDC_TOKEN_ENDPOINT`, `TOKEN_AI_OIDC_USERINFO`, and optionally `TOKEN_AI_OIDC_ISSUER`, `TOKEN_AI_OIDC_JWKS_URI`, `TOKEN_AI_OIDC_SCOPES` (default `openid profile email`), `TOKEN_AI_OIDC_CLIENT_ID`, `TOKEN_AI_OIDC_IDENTITY_CLAIM` (e.g., `email`), `TOKEN_AI_OIDC_ALLOWED_USERS` (CSV allowlist, optional).
      - GitHub (legacy): set `TOKEN_AI_MCP_GITHUB_CLIENT_ID`/`TOKEN_AI_MCP_GITHUB_CLIENT_SECRET` only if using GitHub.
  - OAuth discovery is served at both:
    - `https://your.host/.well-known/oauth-authorization-server`
    - `https://your.host/.well-known/openid-configuration`
  - Callback accepted at `/callback` and `/mcp/callback`.

Notes:
- ChatGPT currently exposes only two canonical tools by design: `search` and `fetch`. We provide both with the exact shape it expects (content[0].type="text" with JSON string payloads).
- Do not point ChatGPT to `/mcp-proxy`.

Note: `/mcp-proxy` is designed for the browser UI (it requires a short‑lived `userToken` query param). ChatGPT cannot supply that param, so do not use `/mcp-proxy` as the ChatGPT Server URL.

Identity → wallet mapping
- With OAuth, the server maps an identity claim from your OIDC provider (default `sub`, configurable via `TOKEN_AI_OIDC_IDENTITY_CLAIM`, e.g., `email`) into `X-User-Token` so tools like `resolve_wallet` and `auth_info` work per user.
- If you prefer static mapping, set `TOKEN_AI_MCP_BEARER_MAP_JSON` or `TOKEN_AI_MCP_BEARER_MAP` on the MCP server.


## Environment Variables

- `TOKEN_AI_MCP_PORT` (default: `3930`): HTTP port
- `TOKEN_AI_MCP_TOKEN` (optional): Bearer token required if set
- `TOKEN_AI_MCP_CORS` (default: `*`): Allowed origin(s)
- `TOKEN_AI_MCP_OAUTH` (default: `false`): Enable OAuth mode (http-server-oauth)
- `TOKEN_AI_MCP_PUBLIC_URL`: Public base URL for `.well-known` + callback (e.g., `https://example.com/mcp`)
- `TOKEN_AI_MCP_TOOLSETS` (default: `all`): CSV of toolsets to enable globally (`wallet,program,runs,reports,voice,web,trading`)
- `TOKEN_AI_DEMO_MODE` (default: `0`): When `1`, allows the server‑injected bearer from `/mcp-proxy` without contacting an external IdP. Intended for demo/browser UI flows.
- `MCP_USER_JWT_SECRET`: HS256 secret used by the UI server to mint short‑lived per‑user tokens (`/mcp-user-token`). Required for `/mcp-proxy`.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`: For UI magic‑link login; used by `/auth/config` and `/mcp-user-token`.

OIDC provider (recommended for ChatGPT Connectors):
- `TOKEN_AI_OIDC_ISSUER` (optional): Issuer string for metadata
- `TOKEN_AI_OIDC_AUTHORIZATION_ENDPOINT`: OAuth authorization endpoint
- `TOKEN_AI_OIDC_TOKEN_ENDPOINT`: OAuth token endpoint
- `TOKEN_AI_OIDC_USERINFO`: OIDC userinfo endpoint (used for token validation)
- `TOKEN_AI_OIDC_REGISTRATION_ENDPOINT` (optional): Dynamic Client Registration endpoint (RFC 7591)
- `TOKEN_AI_OIDC_JWKS_URI` (optional): JWKS URI (for future JWT validation)
- `TOKEN_AI_OIDC_SCOPES` (default: `openid profile email`): Requested scopes
- `TOKEN_AI_OIDC_CLIENT_ID`: OAuth client ID registered with your IdP
- `TOKEN_AI_OIDC_IDENTITY_CLAIM` (default: `sub`): Claim to use as identity (e.g., `email`)
- `TOKEN_AI_OIDC_ALLOWED_USERS` (optional CSV): Allowlist of identities (matching the identity claim)

Legacy GitHub (only if explicitly configured):
- `TOKEN_AI_MCP_GITHUB_CLIENT_ID` / `TOKEN_AI_MCP_GITHUB_CLIENT_SECRET`
- `TOKEN_AI_MCP_GITHUB_ALLOWED_USERS` (optional CSV)

Dev/testing:
- `TOKEN_AI_MCP_OAUTH_ALLOW_ANY=1` to accept any Bearer token without calling an IdP (NOT for production). When `TOKEN_AI_DEMO_MODE=1`, allow‑any behavior is implied for the server‑injected bearer only; arbitrary public tokens are still denied.

OpenAI Responses API (critical):
- The MCP tool definition must include both the full `server_url` path and an `authorization` value on every request. Example curl:

```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "o4-mini-deep-research",
    "input": [{"role":"user","content":[{"type":"input_text","text":"find latest DUEL analysis"}]}],
    "tools": [
      {
        "type": "mcp",
        "server_label": "clanka",
        "server_url": "https://your.host/mcp",
        "authorization": "'$TOKEN_AI_MCP_TOKEN'",
        "allowed_tools": ["search","fetch"],
        "require_approval": "never"
      }
    ]
  }'
```

Browser UI integration (served by token-ai/server.js):

Browser UI integration (served by token-ai/server.js):
- `GET /auth/config` → exposes Supabase URL and anon key to the browser
- `GET /mcp-user-token` → mints short‑lived per‑user JWT (uses Supabase session when available; falls back to `demo` when `TOKEN_AI_DEMO_MODE=1`)
- `ALL /mcp-proxy` → enforces `?userToken=…` and injects backend bearer to MCP; normalizes Accept and preserves `Mcp-Session-Id`.

- `TOKEN_AI_MAX_CONCURRENCY` (default: `3`): Max concurrent analyzer runs
- `TOKEN_AI_CHILD_MAX_MB` (default: `1024`): Memory cap for analyzer/subprocesses
- `TOKEN_AI_LOGS_PER_RUN_LIMIT` (default: `200`): Per‑run log ring buffer length

## Routing and Discovery

Public base: `https://<host>/mcp`
- GET/POST `/mcp` → Streamable HTTP transport
- `/mcp/*` → OAuth endpoints and resources (authorize, token, userinfo, callback, well‑known)
- Root discovery mirrors:
  - `/.well-known/oauth-authorization-server`
  - `/.well-known/openid-configuration`

Nginx tips
- `location = /mcp` → `proxy_pass http://127.0.0.1:3930/mcp`
- `location ^~ /mcp/` → `proxy_pass http://127.0.0.1:3930$request_uri`
- Expose/allow `Mcp-Session-Id` in CORS/headers; disable buffering for long streams

## Tools

All tools are registered in `mcp/common.mjs` using `@modelcontextprotocol/sdk`.

### Predictions & Foundation (New)

- `get_twitter_history({ mint_address, limit?, include_replies?, include_retweets?, include_deleted?, include_snapshots?, snapshots_limit?, since_time?, since_days?, author? })`
  - Returns `{ mint_address, count, tweets, snapshots }`
  - Errors (structured): `{ error: 'db_unavailable' }`

- `get_media_from_tweet({ tweet_id, include_metadata? })`
  - Returns `{ tweet_id, media: { image_urls[], video_urls[], card_previews[] }, media_count, metadata? }`
  - Errors: `{ error: 'db_unavailable' }`, `{ error: 'tweet_not_found', tweet_id }`

- `get_prediction_history({ token_address?, author_handle?, limit?, min_accuracy?, prediction_type?, order_by? })`
  - Returns `{ count, predictions[], author_statistics? }`
  - Errors: `{ error: 'db_unavailable' }`, or `{ error: 'not_found', count: 0 }`

- `verify_tweet_prediction({ tweet_id, minutes_after?, prediction_type?, mint_address?, claims?, prediction_details? })`
  - Returns scoring summary with `{ accuracy_score, verdict, price_data, saved_to_database }`
  - Errors: `{ error: 'db_unavailable' }`, `{ error: 'tweet_not_found', tweet_id }`, `{ error: 'missing_birdeye_api_key' }`, `{ error: 'no_ohlcv_data', ... }`, `{ error: 'verify_failed', message }`

- `verify_relative_prediction({ tweet_id, window_minutes?, claim?, targets?, target_kind?, chain_id?, primary_index?, against_index?, threshold_pct? })`
  - Returns ranking and verdict for relative performance
  - Errors: `{ error: 'db_unavailable' }`, `{ error: 'tweet_not_found', tweet_id }`, `{ error: 'missing_birdeye_api_key' }`, `{ error: 'verify_relative_failed', message }`

- `ensure_token_activated({ mint_address })`, `ensure_token_enriched({ mint_address, timeout_sec?, poll? })`, `get_token_links_from_db({ mint_address })`
  - Thin wrappers over foundation helpers; return underlying structured content

### Wallet Extras (New)

- `get_wallet_holdings({ wallet_address })`
  - Returns `{ success, wallet_address, sol_balance, total_value_usd, tokens[], token_count }`
  - Uses `API_BASE_URL` to reach the UI API server.

### Required Env for Predictions

- `BIRDEYE_API_KEY` (Birdeye v3 OHLCV). Without this, OHLCV-dependent verifiers return `{ error: 'missing_birdeye_api_key' }`.


ChatGPT canonical
- `search(query: string)` → returns `content: [{ type: "text", text: "{\"results\":[{id,title,url}]}" }]`
- `fetch(id: string)` → returns `content: [{ type: "text", text: "{\"id\",\"title\",\"text\",\"url\",\"metadata\":{...}}" }]`

- `list_reports_page(limit?, cursor?)`:
  - Purpose: Paginate through all reports; returns opaque `nextCursor` for the next page
  - Input: `{ limit?: number, cursor?: string }` (default limit 24)
  - Output: `{ uris: string[], nextCursor?: string }`

- `list_resource_uris(limit?)`:
  - Purpose: Quickly browse recent report URIs (report:// scheme)
  - Input: `{ limit?: number }` (default 24)
  - Output: `{ uris: string[] }`

- `list_recent_analyses(limit?)`:
  - Purpose: Summarize recent saved analyses from `reports/ai-token-analyses/`
  - Output: `{ items: { mint, branchScore, riskScore, duration_ms, file, mtime }[] }`

- `get_report(filename?, mint?)`:
  - Purpose: Fetch one report by filename or by token mint (best recent match)
  - Output: `{ file, mtime, data }`

- `get_latest_analysis()`:
  - Purpose: Latest report JSON
  - Output: `{ file, mtime, data }`

- `read_report_uri(uri)`:
  - Purpose: Read one report via its `report://` URI
  - Input: `{ uri: string }`
  - Output: `{ file, mtime, data }`

- `run_agent(mint, flags?)`:
  - Purpose: Spawn `node index.js <mint> [flags...]`
  - Inputs (reasoning knobs supported): `reasoning_level?`, `reasoning_policy?`, `initial_reasoning?`, `refine_reasoning?`, `finalize_reasoning?`
  - Output: `{ pid, startedAt }` (de‑dups if same mint already running)

- `run_socials(mint, steps?, x_concurrency?)`:
  - Purpose: Spawn `node socials/orchestrator.js <mint> [--steps=…] [--x-concurrency=…]`
  - Output: `{ pid, startedAt }`

- `list_runs()`:
  - Purpose: List active child processes started by these tools
  - Output: `{ active: { pid, mint, kind, startedAt }[] }`

- `get_run_logs(pid, limit?)`:
  - Purpose: Tail recent logs for a PID (ring‑buffered)
  - Output: `{ pid, mint, logs: { stream, line, at }[] }`

- `kill_run(pid)`:
  - Purpose: Terminate a running child; SIGTERM then SIGKILL fallback
  - Output: `{ ok: boolean }`

### Trading Tools

- `list_wallet_token_balances(wallet_id, min_ui?, limit?)`:
  - Purpose: Enumerate wallet balances (native SOL and SPL token accounts) to plan sells.
  - Output: `{ items: [{ mint, ata, decimals, amount_ui, amount_raw }] }` sorted by `amount_ui`.
    - SOL appears with `mint=So1111…12` and `ata="native"`.

- `execute_buy_preview(token_mint, sol_amount, slippage_bps?)` → expected tokens and price impact
- `execute_sell_preview(token_mint, token_amount, slippage_bps?, output_mint?)` → expected SOL/out and impact
- `execute_buy(wallet_id?, token_mint, sol_amount, slippage_bps?, priority_lamports?)` → on‑chain buy
- `execute_sell(wallet_id?, token_mint, token_amount, slippage_bps?, priority_lamports?, output_mint?)` → on‑chain sell
- `execute_sell_all(wallet_id?, token_mint, slippage_bps?, priority_lamports?)` → sell full balance

## Resources

- URI Templates:
  - `report://ai-token-analyses/{file}` (JSON reports, by filename)
  - `report://ai-token-analyses/by-mint/{mint}` (resolve most recent report for a mint)
- List: MCP `resources/list` returns recent reports as resource links
- Read: MCP `resources/read` returns `{ contents: [{ uri, mimeType: 'application/json', text }] }`
- Related tool: `list_resource_uris` returns the same URIs as plain strings for quick browse or LLM planning

## Using With MCP Clients

- Stdio‑mode clients (spawn the server): configure the command to `node /abs/path/to/alpha/dexter-mcp/server.mjs`
- HTTP‑mode clients: point to `http://host:3930/mcp`, add `Authorization: Bearer <TOKEN_AI_MCP_TOKEN>` if set
- Capabilities: tools, resources, prompts (no prompts registered currently), logging

### Agent Reasoning Controls (MCP Quick Ref)

Tools that accept reasoning knobs: `run_agent`, `run_agent_quick`.

- Inputs (knobs):
  - `reasoning_level`: `low|medium|high`
  - `reasoning_policy`: `quick|balanced|thorough`
  - `initial_reasoning`, `refine_reasoning`, `finalize_reasoning`: per‑phase overrides
- Precedence: per‑phase > global (`reasoning_level`) > policy > dynamic/default.

Examples
- Balanced policy:
  - name: `run_agent`
  - args: `{ mint: "<MINT>", reasoning_policy: "balanced" }`
- Fast iteration:
  - name: `run_agent_quick`
  - args: `{ mint: "<MINT>", reasoning_level: "low" }`
- High finalize only:
  - name: `run_agent`
  - args: `{ mint: "<MINT>", initial_reasoning: "low", refine_reasoning: "low", finalize_reasoning: "high" }`

### CLI Usage (no Codex required)

Run trading tools via npm scripts that wrap the MCP stdio server, auto‑loading env from the monorepo `.env`.

- List balances
  - `npm run mcp:balances -- <WALLET_ID> --min-ui=0.000001 --limit=10`

- Buy (ExactIn)
  - `npm run mcp:buy -- <WALLET_ID> <MINT> --sol=0.0005 --slippage=150,250,300`

- Sell
  - `npm run mcp:sell -- <WALLET_ID> <MINT> --amount=0.1 --output=SOL --slippage=200`

### Trading Quick Start

- List balances for a wallet:
  - name: `list_wallet_token_balances`
  - args: `{ wallet_id: "<WALLET_ID>", min_ui: 0.000001, limit: 10 }`

- Preview buy:
  - name: `execute_buy_preview`
  - args: `{ token_mint: "<MINT>", sol_amount: 0.0005, slippage_bps: 150 }`

- Execute buy:
  - name: `execute_buy`
  - args: `{ wallet_id: "<WALLET_ID>", token_mint: "<MINT>", sol_amount: 0.0005, slippage_bps: 150 }`

- Preview sell:
  - name: `execute_sell_preview`
  - args: `{ token_mint: "<MINT>", token_amount: 0.1, slippage_bps: 200, output_mint: "So1111…12" }`

- Execute sell:
  - name: `execute_sell`
  - args: `{ wallet_id: "<WALLET_ID>", token_mint: "<MINT>", token_amount: 0.1, slippage_bps: 200, output_mint: "So1111…12" }`

## Deep Research

Build research reports via search, fetch/crawl, notes, and report finalization.

### Tools

- `web_search(query, topN?, timeRange?)` → organic results
- `fetch_url(url, mode?)` → readability text, links, meta (or raw html)
- `fetch_url_rendered(url, wait_ms?, scroll_steps?, scroll_delay_ms?)` → headless-rendered extraction (Playwright)
- `smart_fetch(url, min_len?, rendered_wait_ms?, rendered_scroll_steps?, rendered_scroll_delay_ms?)` → fallback to rendered if static too short
- `crawl_site(root_url, max_pages?, depth?, same_origin?, delay_ms?)` → pages
- `crawl_urls(urls[], concurrency?, delay_ms?)` → pages
- `write_note(text, source_uri?, tags?)`, `list_notes(query?, limit?)`, `read_note(id)`, `delete_note(id)`
- `finalize_report(title, outline?, include_notes?, extra_context?)` → research://deep-research/{file}.json
- `run_agent_quick(mint)` → fast local analysis (web-search + ohlcv)
- `wait_for_report_by_mint(mint, timeout_sec?, poll_ms?)` → block until new ai-token-analyses report appears

### Example Flow

1) Search → Fetch/Crawl
   - `npm run mcp:search -- "solana jupiter aggregator" --topN=8`
   - `npm run mcp:fetch -- https://docs.jup.ag/`
   - `npm run mcp:crawl:site -- https://docs.jup.ag --max=6 --depth=1`

2) Capture Highlights as Notes
   - `npm run mcp:note:write -- "Jupiter supports ExactOut quoting." --source=https://docs.jup.ag/ --tags=jupiter,exactout`
   - `npm run mcp:note:list -- --query=jupiter --limit=10`

3) Optional: Trigger Local Quick Analysis for a Mint
   - `npm run mcp:run:quick -- <MINT>`
   - `npm run mcp:wait:mint -- <MINT> --timeout=600 --poll=1500`

4) Finalize Report
   - `npm run mcp:finalize -- "Deep Research: <Topic>" --outline=Overview|Risks --include=<noteId1>,<noteId2> --extra="Focus on sell routes."`

### Webhooks (Optional)

Enable push notifications from MCP research actions:
- Set `RESEARCH_WEBHOOK_URL` and optional `RESEARCH_WEBHOOK_TOKEN` in env.
- Events emitted: `analysis:run_started`, `analysis:report_ready`, `research:report_finalized`.

To ingest OpenAI Background Mode webhooks from the OpenAI platform:
- Configure your project webhook to `POST /openai/webhook`.
- Set `OPENAI_WEBHOOK_SECRET` (or `OPENAI_WEBHOOK_KEY`) in env.
- The server verifies signatures and broadcasts events to Live UI WS (subtype `openai_webhook`).

## Security Notes

- Always set `TOKEN_AI_MCP_TOKEN` before exposing HTTP MCP beyond localhost
- Consider proxy‑side auth and IP allowlists; set `TOKEN_AI_MCP_CORS` to a strict origin
- The server spawns local processes for `run_agent`/`run_socials`; do not expose publicly without controls
- Toggle run tools: set `TOKEN_AI_MCP_ENABLE_RUN_TOOLS=0` to hide run/kill tools (read‑only mode)

## Troubleshooting

- Tool schema errors: SDK validates inputs/outputs; messages like “Invalid structured content …” suggest a mismatch—open an issue with the tool name and payload
- Concurrency limit: If you see `concurrency_limit (N)`, reduce running jobs or increase `TOKEN_AI_MAX_CONCURRENCY`
- Memory cap: Child processes inherit `--max-old-space-size=${TOKEN_AI_CHILD_MAX_MB}`; raise if you see OOMs
- HTTP auth failures: Ensure `Authorization: Bearer <TOKEN_AI_MCP_TOKEN>` header is present if token is set
- SSE not used: HTTP GET `/mcp` SSE stream is optional; clients may operate without it

## Development

- Edit `mcp/common.mjs` to add or change tools/resources
- Run `npm run test:mcp` and `npm run test:mcp:http` to verify
- Restart services after changes (production):
  - `pm2 restart dexter-mcp && pm2 save`
  - If UI routes changed: `pm2 restart dexter-api dexter-fe && pm2 save`

## License

This project is part of the Token‑AI toolset; see the repo’s main license and guidelines.
- `run_agent_quick(mint, extra_flags?)`:
  - Purpose: Quick agent run (web-search + OHLCV fast path) for faster iterations
  - Inputs: `extra_flags?`, reasoning knobs (`reasoning_level?`, `reasoning_policy?`, `initial_reasoning?`, `refine_reasoning?`, `finalize_reasoning?`)
  - Output: `{ pid, startedAt }`

- `run_socials_step(mint, step)` and convenience wrappers `run_socials_market|website|telegram|x`:
  - Purpose: Run a single socials step to avoid the full orchestrate when not needed
  - Inputs: `step in [market, website, telegram, x]`, `x_concurrency?`
  - Output: `{ pid, startedAt, step }`
### Reasoning Controls (Agent)

- Global override: `reasoning_level=low|medium|high`
- Per‑phase: `initial_reasoning`, `refine_reasoning`, `finalize_reasoning`
- Policy: `reasoning_policy=quick|balanced|thorough`
- Precedence: per‑phase > global > policy > dynamic/default.
