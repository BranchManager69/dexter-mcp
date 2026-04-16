import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { intro, outro, log, select, spinner } from "@clack/prompts";
import chalk from "chalk";
import { loadOrCreateWallet } from "../../wallet/index.js";
import { getClientConfig, CLIENTS, detectInstalledClients, type ClientId } from "./clients.js";

interface InstallOpts {
  client?: string;
  yes: boolean;
  dev: boolean;
  all?: boolean;
  skipWalletSetup?: boolean;
}

function writeClientConfig(clientId: ClientId, dev: boolean): { ok: boolean; message: string } {
  const config = getClientConfig(clientId, dev);

  if (config.manual) {
    return {
      ok: false,
      message: `${CLIENTS[clientId].name} requires manual configuration at ${config.configPath}`,
    };
  }

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

  return {
    ok: true,
    message: `Installed into ${CLIENTS[clientId].name} (${config.configPath})`,
  };
}

// ---------------------------------------------------------------------------
// Claude Code plugin installation via CC CLI
// ---------------------------------------------------------------------------

const MARKETPLACE_REPO = "Dexter-DAO/opendexter-ide";
const PLUGIN_ID = "opendexter";

async function tryExec(cmd: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  const { execFile } = await import("node:child_process");
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, output: (stderr || stdout || err.message).trim() });
      } else {
        resolve({ ok: true, output: (stdout || "").trim() });
      }
    });
  });
}

async function installClaudeCodePlugin(): Promise<{ ok: boolean; message: string }> {
  // Try shelling out to the CC CLI — works non-interactively
  const addResult = await tryExec("claude", ["plugins", "marketplace", "add", MARKETPLACE_REPO]);

  if (!addResult.ok) {
    // claude CLI not on PATH or command failed — fall back to instructions
    return {
      ok: false,
      message: [
        "Could not run the Claude Code CLI automatically.",
        "",
        "Run these commands manually to install the OpenDexter plugin:",
        "",
        `  claude plugins marketplace add ${MARKETPLACE_REPO}`,
        `  claude plugins install ${PLUGIN_ID}`,
        "",
        "Then restart Claude Code.",
      ].join("\n"),
    };
  }

  const installResult = await tryExec("claude", ["plugins", "install", PLUGIN_ID]);

  if (!installResult.ok) {
    return {
      ok: false,
      message: [
        `Marketplace added, but plugin install failed: ${installResult.output}`,
        "",
        "Try running manually:",
        `  claude plugins install ${PLUGIN_ID}`,
      ].join("\n"),
    };
  }

  return {
    ok: true,
    message: `Plugin installed via Claude Code CLI (marketplace: ${MARKETPLACE_REPO})`,
  };
}

async function promptForClient(): Promise<ClientId> {
  const ids = Object.keys(CLIENTS) as ClientId[];
  const answer = await select({
    message: "Choose a client to install OpenDexter into",
    options: ids.map((id) => ({
      value: id,
      label: CLIENTS[id].name,
      hint: CLIENTS[id].description,
    })),
  });
  if (typeof answer !== "string" || !CLIENTS[answer as ClientId]) {
    throw new Error("No client selected.");
  }
  return answer as ClientId;
}

export async function runInstall(opts: InstallOpts): Promise<void> {
  // Step 1: ensure wallet exists
  let wallet = null;
  if (!opts.skipWalletSetup) {
    intro(chalk.bold("OpenDexter install"));
    const s = spinner();
    s.start("Activating wallet");
    wallet = await loadOrCreateWallet({ quiet: true });
    if (!wallet) {
      s.stop("Wallet activation failed");
      process.exit(1);
    }
    const statusMessage =
      wallet.status === "created"
        ? "New wallet activated"
        : wallet.status === "migrated"
          ? "Wallet upgraded for multichain use"
          : wallet.status === "env"
            ? "Wallet loaded from environment"
            : "Wallet online";
    s.stop(statusMessage);
    log.info(`Solana rail: ${wallet.info.solanaAddress}`);
    if (wallet.info.evmAddress) log.info(`EVM rail:    ${wallet.info.evmAddress}`);
  } else {
    wallet = await loadOrCreateWallet({ quiet: true });
    if (!wallet) {
      console.error("Failed to load wallet. Exiting.");
      process.exit(1);
    }
  }

  let targetClients: ClientId[] = [];

  if (opts.all) {
    targetClients = detectInstalledClients();
    if (targetClients.length === 0) {
      console.error("No supported AI clients were auto-detected on this machine.");
      process.exit(1);
    }
    log.step(`Detected clients: ${targetClients.map((id) => CLIENTS[id].name).join(", ")}`);
  } else {
    let clientId = opts.client as ClientId | undefined;

    if (!clientId) {
      if (opts.yes) {
        console.error("--client is required when using --yes, unless you pass --all");
        process.exit(1);
      }
      clientId = await promptForClient();
    }

    if (!CLIENTS[clientId]) {
      console.error(`Unknown client: ${clientId}`);
      console.error(`Available: ${Object.keys(CLIENTS).join(", ")}`);
      process.exit(1);
    }

    targetClients = [clientId];
  }

  const successes: string[] = [];
  const failures: string[] = [];

  for (const clientId of targetClients) {
    if (clientId === "claude-code") {
      // CC uses its own plugin system — don't write to ~/.claude.json MCP config.
      // Instead, use the CC CLI to add the marketplace and install the plugin.
      const ps = spinner();
      ps.start("Installing OpenDexter plugin via Claude Code CLI");
      const pluginResult = await installClaudeCodePlugin();
      if (pluginResult.ok) {
        ps.stop("Plugin installed via Claude Code CLI");
        successes.push(pluginResult.message);
      } else {
        ps.stop("Automatic plugin install unavailable");
        failures.push(pluginResult.message);
      }
    } else {
      // All other clients: write MCP server entry to their config file
      const s = spinner();
      s.start(`Installing into ${CLIENTS[clientId].name}`);
      const result = writeClientConfig(clientId, opts.dev);
      if (result.ok) {
        s.stop(`${CLIENTS[clientId].name} installed`);
        successes.push(result.message);
      } else {
        s.stop(`${CLIENTS[clientId].name} needs manual setup`);
        failures.push(result.message);
      }
    }
  }

  log.step("Install summary");
  for (const line of successes) log.success(line);
  for (const line of failures) log.warn(line);

  if (!opts.skipWalletSetup) {
    outro("OpenDexter is wired in. Fund your rails when you're ready to settle your first paid call.");
  }
}
