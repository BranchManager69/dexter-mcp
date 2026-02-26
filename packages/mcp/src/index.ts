import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
  await yargs(hideBin(process.argv))
    .scriptName("@dexterai/mcp")
    .usage("$0 [command] [options]")
    .option("dev", {
      type: "boolean",
      description: "Use localhost endpoints instead of production",
      default: false,
    })
    .command(
      ["$0", "server"],
      "Start the MCP server (default)",
      (y) =>
        y.option("transport", {
          choices: ["stdio", "http"] as const,
          default: "stdio" as const,
          description: "Transport mode",
        }),
      async (args) => {
        const { startServer } = await import("./server/index.js");
        await startServer({
          transport: args.transport,
          dev: args.dev,
        });
      },
    )
    .command(
      "install",
      "Install Dexter MCP into an AI client (Cursor, Claude, Codex, etc.)",
      (y) =>
        y
          .option("client", {
            type: "string",
            description: "Client to install into",
          })
          .option("yes", {
            alias: "y",
            type: "boolean",
            description: "Skip prompts",
            default: false,
          }),
      async (args) => {
        const { runInstall } = await import("./cli/install/index.js");
        await runInstall({ client: args.client, yes: args.yes, dev: args.dev });
      },
    )
    .command(
      "wallet",
      "Show wallet address and balances",
      () => {},
      async (args) => {
        const { showWalletInfo } = await import("./wallet/index.js");
        await showWalletInfo({ dev: args.dev });
      },
    )
    .command(
      "search <query>",
      "Search the Dexter x402 marketplace",
      (y) =>
        y.positional("query", { type: "string", demandOption: true }),
      async (args) => {
        const { cliSearch } = await import("./tools/search.js");
        await cliSearch(args.query!, { dev: args.dev });
      },
    )
    .command(
      "fetch <url>",
      "Fetch an x402-protected resource with automatic payment",
      (y) =>
        y
          .positional("url", { type: "string", demandOption: true })
          .option("method", {
            choices: ["GET", "POST", "PUT", "DELETE"] as const,
            default: "GET" as const,
          })
          .option("body", { type: "string", description: "JSON request body" }),
      async (args) => {
        const { cliFetch } = await import("./tools/fetch.js");
        await cliFetch(args.url!, {
          method: args.method,
          body: args.body,
          dev: args.dev,
        });
      },
    )
    .strict()
    .help()
    .parseAsync();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
