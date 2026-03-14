import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
  await yargs(hideBin(process.argv))
    .scriptName("opendexter")
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
          })
          .option("all", {
            type: "boolean",
            description: "Install into all auto-detected supported clients",
            default: false,
          }),
      async (args) => {
        const { runInstall } = await import("./cli/install/index.js");
        await runInstall({ client: args.client, yes: args.yes, all: args.all, dev: args.dev });
      },
    )
    .command(
      "setup",
      "Set up wallet, install into detected clients, and show the fastest path to first use",
      (y) =>
        y.option("yes", {
          alias: "y",
          type: "boolean",
          description: "Skip prompts where possible",
          default: false,
        }),
      async (args) => {
        const { runSetup } = await import("./cli/onboard.js");
        await runSetup({ yes: args.yes, dev: args.dev });
      },
    )
    .command(
      "access <url>",
      "Access an identity-gated endpoint using wallet proof instead of payment",
      (y) =>
        y
          .positional("url", { type: "string", demandOption: true })
          .option("method", {
            choices: ["GET", "POST", "PUT", "DELETE"] as const,
            default: "GET" as const,
          })
          .option("body", { type: "string", description: "JSON request body" })
          .option("network", { type: "string", description: "Optional preferred auth network" }),
      async (args) => {
        const { cliAccess } = await import("./tools/access.js");
        await cliAccess(args.url!, {
          method: args.method,
          body: args.body,
          network: args.network,
          dev: args.dev,
        });
      },
    )
    .command(
      "check <url>",
      "Inspect an endpoint's x402 pricing and requirements without paying",
      (y) =>
        y
          .positional("url", { type: "string", demandOption: true })
          .option("method", {
            choices: ["GET", "POST", "PUT", "DELETE"] as const,
            default: "GET" as const,
          }),
      async (args) => {
        const { cliCheck } = await import("./tools/check.js");
        await cliCheck(args.url!, {
          method: args.method,
          dev: args.dev,
        });
      },
    )
    .command(
      "settings",
      "Read or update OpenDexter spending policy",
      (y) =>
        y.option("max-amount", {
          type: "number",
          description: "Set the default max amount allowed per paid call (USDC)",
        }),
      async (args) => {
        const { cliSettings } = await import("./tools/settings.js");
        await cliSettings({
          maxAmountUsdc: args["max-amount"],
        });
      },
    )
    .command(
      "wallet",
      "Show wallet address and balances",
      (y) =>
        y
          .option("vanity", {
            type: "boolean",
            description: "Generate a vanity wallet address",
            default: false,
          })
          .option("solana-prefix", {
            type: "string",
            description: "Desired Solana prefix (example: Dex)",
          })
          .option("evm-prefix", {
            type: "string",
            description: "Desired EVM prefix after 0x (example: 402dd)",
          })
          .option("case-sensitive", {
            type: "boolean",
            description: "Treat vanity prefixes as case-sensitive",
            default: false,
          })
          .option("yes", {
            alias: "y",
            type: "boolean",
            description: "Skip prompts where possible",
            default: false,
          }),
      async (args) => {
        if (args.vanity) {
          const { runVanityFlow } = await import("./wallet/vanity-flow.js");
          await runVanityFlow({
            dev: args.dev,
            solanaPrefix: args["solana-prefix"],
            evmPrefix: args["evm-prefix"],
            caseSensitive: args["case-sensitive"],
            yes: args.yes,
          });
          return;
        }

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
          .option("max-amount", {
            type: "number",
            description: "Optional per-call spend cap override in USDC",
          })
          .option("body", { type: "string", description: "JSON request body" }),
      async (args) => {
        const { cliFetch } = await import("./tools/fetch.js");
        await cliFetch(args.url!, {
          method: args.method,
          body: args.body,
          maxAmountUsdc: args["max-amount"],
          dev: args.dev,
        });
      },
    )
    .command(
      "pay <url>",
      "Alias of fetch for clients that want an explicit payment verb",
      (y) =>
        y
          .positional("url", { type: "string", demandOption: true })
          .option("method", {
            choices: ["GET", "POST", "PUT", "DELETE"] as const,
            default: "GET" as const,
          })
          .option("max-amount", {
            type: "number",
            description: "Optional per-call spend cap override in USDC",
          })
          .option("body", { type: "string", description: "JSON request body" }),
      async (args) => {
        const { cliFetch } = await import("./tools/fetch.js");
        await cliFetch(args.url!, {
          method: args.method,
          body: args.body,
          maxAmountUsdc: args["max-amount"],
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
