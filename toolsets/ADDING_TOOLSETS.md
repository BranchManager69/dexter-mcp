# Adding MCP Toolsets

This repository groups related MCP tools into *toolsets*. Each toolset exposes one or more tools through `server.registerTool(...)` and is loaded by the shared registry in `toolsets/index.mjs`.

Follow these steps when creating a new toolset:

1. **Create a folder** under `toolsets/` for the group (for example `toolsets/pumpstream/`).
2. **Export a registration helper** from `toolsets/<group>/index.mjs`. The function signature is:
   ```js
   export function register<Group>Toolset(server) {
     server.registerTool('tool_name', meta, async (args, extra) => {
       // handler logic
       return { content: [{ type: 'text', text: JSON.stringify(result) }] };
     });
   }
   ```
   * Use `zod` schemas for `inputSchema`/`outputSchema` where helpful.
   * Return structured JSON as a string inside the `content` array to keep MCP clients happy.
3. **Register the group** in `toolsets/index.mjs` by adding an entry to `TOOLSET_REGISTRY` that points to the new helper. Any toolset listed here is loaded automatically unless `TOKEN_AI_MCP_TOOLSETS` limits the selection.
4. **Restart the MCP server** (`pm2 restart dexter-mcp --update-env`) so the new tools are available.

## Examples

- `toolsets/general/index.mjs` provides the canonical `search`/`fetch` tools used by ChatGPT during connector setup.
- `toolsets/pumpstream/index.mjs` (added in September 2025) demonstrates calling an external API (`https://pump.dexter.cash/api/live`) and returning a trimmed JSON summary.
- `toolsets/wallet/index.mjs` shows how to reuse shared helper utilities (Supabase resolvers) across multiple tools.

Use these examples as templates when stubbing new toolsets: copy one of the files, rename the registration function, replace the tool logic, and hook the group into the registry.
