import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VERSION } from "../config.js";
import { registerSearchTool } from "../tools/search.js";
import { registerFetchTool } from "../tools/fetch.js";
import { registerAccessTool } from "../tools/access.js";
import { registerCheckTool } from "../tools/check.js";
import { registerSettingsTool } from "../tools/settings.js";
import { registerWalletTool } from "../tools/wallet-tool.js";
import { loadOrCreateWallet } from "../wallet/index.js";
import { registerWidgetResources } from "../resources/widgets.js";

export interface ServerOptions {
  transport: "stdio" | "http";
  dev: boolean;
}

export async function startServer(opts: ServerOptions): Promise<void> {
  let wallet;
  try {
    wallet = await loadOrCreateWallet();
  } catch (err: any) {
    console.error(`[dexter-mcp] Wallet initialization failed: ${err.message}`);
    console.error("[dexter-mcp] Starting in search-only mode. Set DEXTER_PRIVATE_KEY or fix ~/.dexterai-mcp/wallet.json to enable payments.");
    wallet = null;
  }

  const server = new McpServer({
    name: "Dexter x402 Gateway",
    version: VERSION,
  });

  registerSearchTool(server, opts);
  registerFetchTool(server, wallet, opts);
  registerAccessTool(server, wallet, opts);
  registerCheckTool(server, opts);
  registerSettingsTool(server);
  registerWalletTool(server, wallet, opts);
  registerWidgetResources(server);

  if (opts.transport !== "stdio") {
    console.error("HTTP transport not yet implemented. Use --transport=stdio");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
