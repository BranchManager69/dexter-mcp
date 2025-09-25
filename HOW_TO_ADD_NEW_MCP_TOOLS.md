# HOW TO ADD NEW MCP TOOLS

This checklist codifies the pattern we use across Dexter MCP. Follow it start-to-finish every time you introduce a new tool group ("toolset") or individual tool.

## 1. Prep & naming conventions
- **Folder layout**: each toolset lives under `toolsets/<group>/index.mjs`. Keep the folder name lowercase with dashes only if absolutely necessary.
- **Register function**: export `register<Group>Toolset(server)` so the loader can import it cleanly.
- **Shared helpers**: re-use utilities from `common.mjs` (logging, auth propagation, error wrappers) instead of re-implementing.

## 2. Build the toolset module
1. Create `toolsets/<group>/index.mjs` (copy a small existing one like `toolsets/general/index.mjs` as a starter).
2. Import anything you need (e.g., HTTP clients, validation via `zod`/`schema` helpers, `wrapToolHandler` from `common.mjs`).
3. Inside `register<Group>Toolset(server)`, call `server.registerTool('tool_name', definition, handler)` for each tool:
   - **definition** must include `title`, `description`, and `inputSchema` (plain JSON schema object). Keep descriptions actionable.
   - **_meta**: always add `{ category, access, tags }`. Categories fuel the tools site grouping; tags help client filtering. Re-use existing category strings if possible.
   - **handler** should validate inputs (e.g., via `z.object(...)`) and return `{ content, structuredContent?, metadata? }` like the other toolsets. Wrap risky work in our `wrapped()` helper so we get consistent error logging.
4. Export a default object if the pattern requires it (see Codex and Solana examples) but the essential export is the register function.

## 3. Register the toolset with the loader
- Open `toolsets/index.mjs`.
- Add an import: `import { register<Group>Toolset } from './<group>/index.mjs';`
- Add an entry to the `AVAILABLE_TOOLSETS` map: `group: register<Group>Toolset,`
- This makes it respect `TOKEN_AI_MCP_TOOLSETS` filters and auto-load when unset.

## 4. Update docs and metadata
- Add a bullet for the new group in `AGENTS.md` so other agents know it exists.
- If the frontend consumes categories or tags, make sure your `_meta` values match the naming they already render.
- When the toolset backs a public feature (e.g., wallet actions), notify the owning team so they can refresh any downstream prompt guidance.

## 5. Test locally
- Run the MCP server locally (`npm run dev` or your PM2 instance) and hit the tools list:
  ```bash
  TOKEN_AI_MCP_TOKEN=$(grep TOKEN_AI_MCP_TOKEN .env | cut -d= -f2-)
  node scripts/test-tools-list.mjs   # or curl the HTTP transport directly
  ```
- Call the new tool through the client library or the inspector CLI. Example:
  ```bash
  TOKEN_AI_MCP_TOKEN=... node - <<'NODE'
  import { Client } from '@modelcontextprotocol/sdk/client/index.js';
  import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
  const transport = new StreamableHTTPClientTransport('http://127.0.0.1:3930/mcp', {
    requestInit: { headers: { Authorization: `Bearer ${process.env.TOKEN_AI_MCP_TOKEN}` } }
  });
  const client = new Client({ name: 'smoke', version: '1.0.0' });
  await client.connect(transport);
  console.log(await client.listTools({}));
  console.log(await client.callTool({ name: '<tool_name>', arguments: { /* ... */ } }));
  NODE
  ```
- Clean up any temporary files your tool writes (follow the pattern in `codex-bridge.mjs`).

## 6. Deploy & verify
1. Commit your changes and push.
2. Restart MCP and the API proxy so `/tools` reflects the new definitions:
   ```bash
   pm2 restart dexter-mcp
   pm2 restart dexter-api
   ```
3. `curl https://api.dexter.cash/tools | jq '.tools[] | select(.name=="<tool_name>")'` to confirm the new entry is live.
4. Ping the frontend/agents teams once verified so they can exercise it via the harness.

## 7. Best practices & pitfalls
- **Schema discipline**: keep schemas tight. Required fields should be enforced to avoid partial requests from LLMs.
- **Sensitive data**: never echo secrets in error strings or metadata. Use structured fields and redact logs.
- **Access tags**: choose `_meta.access` (`public`, `managed`, `restricted`, etc.) to mirror who can run the tool. Make sure the backing API enforces the same policy.
- **Metadata hygiene**: consistent categories unlock automatic grouping in the UI. For one-off experiments, prefix tags (e.g., `experimental`).
- **Error handling**: surface clear error codes (`throw new Error('wallet_not_linked')`) so the voice agent can react.
- **Cleanup**: if a tool writes temp files (reports, schemas), remove them before returning.
- **Testing**: run the realtime harness if the tool is meant for voice use so you catch token/authorization issues early.

Stick to this list and every new toolset will feel identical to maintain, deploy, and document.
