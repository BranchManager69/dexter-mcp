import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadOrCreateWallet } from "../../wallet/index.js";
import { getClientConfig, CLIENTS, type ClientId } from "./clients.js";

interface InstallOpts {
  client?: string;
  yes: boolean;
  dev: boolean;
}

export async function runInstall(opts: InstallOpts): Promise<void> {
  // Step 1: ensure wallet exists
  console.log("Setting up wallet...");
  const wallet = await loadOrCreateWallet();
  if (!wallet) {
    console.error("Failed to create wallet. Exiting.");
    process.exit(1);
  }
  console.log(`Solana: ${wallet.info.solanaAddress}`);
  if (wallet.info.evmAddress) console.log(`EVM:    ${wallet.info.evmAddress}`);
  console.log();

  // Step 2: pick client
  let clientId = opts.client as ClientId | undefined;

  if (!clientId) {
    if (opts.yes) {
      console.error("--client is required when using --yes");
      process.exit(1);
    }

    console.log("Select an AI client to install into:\n");
    const ids = Object.keys(CLIENTS) as ClientId[];
    ids.forEach((id, i) => console.log(`  ${i + 1}. ${CLIENTS[id].name}`));
    console.log();

    const readline = await import("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question("Choice (number): ", resolve);
    });
    rl.close();

    const idx = parseInt(answer, 10) - 1;
    if (idx < 0 || idx >= ids.length) {
      console.error("Invalid choice.");
      process.exit(1);
    }
    clientId = ids[idx];
  }

  if (!CLIENTS[clientId]) {
    console.error(`Unknown client: ${clientId}`);
    console.error(`Available: ${Object.keys(CLIENTS).join(", ")}`);
    process.exit(1);
  }

  // Step 3: write config
  const config = getClientConfig(clientId, opts.dev);

  if (config.manual) {
    console.log(`\n${CLIENTS[clientId].name} requires manual configuration.\n`);
    console.log("Add this to your MCP config:\n");
    console.log(JSON.stringify(config.entry, null, 2));
    console.log(`\nConfig file: ${config.configPath}`);
    return;
  }

  console.log(`\nInstalling into ${CLIENTS[clientId].name}...`);

  mkdirSync(dirname(config.configPath), { recursive: true });

  let existing: Record<string, unknown> = {};
  if (existsSync(config.configPath)) {
    const raw = readFileSync(config.configPath, "utf-8");
    try {
      existing = JSON.parse(raw);
    } catch {
      console.error(`Warning: ${config.configPath} contains invalid JSON. Backing up and creating fresh.`);
      copyFileSync(config.configPath, config.configPath + ".bak");
      existing = {};
    }
    // Back up valid configs too
    if (Object.keys(existing).length > 0) {
      copyFileSync(config.configPath, config.configPath + ".bak");
    }
  }

  const section = (existing[config.sectionKey] as Record<string, unknown>) || {};
  section["dexter-x402"] = config.entry;
  existing[config.sectionKey] = section;

  writeFileSync(config.configPath, JSON.stringify(existing, null, 2) + "\n");

  console.log(`Written to ${config.configPath}`);
  console.log(`\nDexter x402 Gateway installed for ${CLIENTS[clientId].name}.`);
  console.log(`Solana: ${wallet.info.solanaAddress}`);
  if (wallet.info.evmAddress) console.log(`EVM:    ${wallet.info.evmAddress}`);
  console.log(`\nDeposit USDC on Solana or any supported EVM chain to start paying for x402 APIs.`);
}
