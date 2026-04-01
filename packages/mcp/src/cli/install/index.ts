import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { intro, outro, log, select, spinner } from "@clack/prompts";
import chalk from "chalk";
import { loadOrCreateWallet } from "../../wallet/index.js";
import { getClientConfig, CLIENTS, detectInstalledClients, type ClientId } from "./clients.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
// Claude Code plugin installation (skills, manifest, registry)
// ---------------------------------------------------------------------------

const PLUGIN_NAME = "opendexter";
const PLUGIN_DISPLAY = "OpenDexter x402";

function getPackageRoot(): string {
  // Walk up from dist/cli/install/ or src/cli/install/ to package root
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "skills"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error("Could not locate opendexter package root (skills/ directory not found)");
}

function getPackageVersion(): string {
  const pkgRoot = getPackageRoot();
  const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf-8"));
  return pkg.version || "unknown";
}

function installClaudeCodePlugin(): { ok: boolean; message: string } {
  const version = getPackageVersion();
  const pkgRoot = getPackageRoot();
  const skillsSrc = join(pkgRoot, "skills");

  if (!existsSync(skillsSrc)) {
    return { ok: false, message: "Skills directory not found in package — cannot install plugin" };
  }

  const home = homedir();
  const marketplaceName = "opendexter";
  const pluginKey = `${PLUGIN_NAME}@${marketplaceName}`;

  // Paths matching Claude Code's marketplace plugin layout
  const marketplaceDir = join(home, ".claude", "plugins", "marketplaces", marketplaceName);
  const marketplacePluginDir = join(marketplaceDir, "plugins", PLUGIN_NAME);
  const marketplaceSkillsDir = join(marketplacePluginDir, "skills");
  const cacheDir = join(home, ".claude", "plugins", "cache", marketplaceName, PLUGIN_NAME, version);
  const cacheSkillsDir = join(cacheDir, "skills");
  const knownMarketplacesPath = join(home, ".claude", "plugins", "known_marketplaces.json");
  const pluginsJsonPath = join(home, ".claude", "plugins", "installed_plugins.json");
  const settingsPath = join(home, ".claude", "settings.json");

  const skillDirs = readdirSync(skillsSrc, { withFileTypes: true }).filter((d) => d.isDirectory());

  // 1. Write skills into marketplace plugin directory (source of truth)
  for (const dir of skillDirs) {
    const destDir = join(marketplaceSkillsDir, dir.name);
    mkdirSync(destDir, { recursive: true });
    const srcFile = join(skillsSrc, dir.name, "SKILL.md");
    if (existsSync(srcFile)) {
      copyFileSync(srcFile, join(destDir, "SKILL.md"));
    }
  }

  // Write README.md at marketplace plugin level
  writeFileSync(
    join(marketplacePluginDir, "README.md"),
    `# OpenDexter x402\n\nSearch, pay, and build with x402. Installed by @dexterai/opendexter v${version}.\n`,
  );

  // Write .claude-plugin/marketplace.json at marketplace root (required for Claude Code discovery)
  const marketplaceManifestDir = join(marketplaceDir, ".claude-plugin");
  mkdirSync(marketplaceManifestDir, { recursive: true });
  const marketplaceManifest = {
    name: marketplaceName,
    description: "OpenDexter x402 payment skills for AI agents",
    owner: { name: "Dexter", email: "dev@dexter.cash" },
    plugins: [
      {
        name: PLUGIN_NAME,
        description:
          "Search, pay, and build with x402 — the open protocol for machine-to-machine payments.",
        author: { name: "Dexter", email: "dev@dexter.cash" },
        source: `./plugins/${PLUGIN_NAME}`,
        category: "development",
        homepage: "https://dexter.cash/opendexter",
      },
    ],
  };
  writeFileSync(
    join(marketplaceManifestDir, "marketplace.json"),
    JSON.stringify(marketplaceManifest, null, 2) + "\n",
  );

  // 2. Write skills into plugin cache (where Claude Code loads from)
  for (const dir of skillDirs) {
    const destDir = join(cacheSkillsDir, dir.name);
    mkdirSync(destDir, { recursive: true });
    const srcFile = join(skillsSrc, dir.name, "SKILL.md");
    if (existsSync(srcFile)) {
      copyFileSync(srcFile, join(destDir, "SKILL.md"));
    }
  }

  // 3. Register the marketplace in known_marketplaces.json
  mkdirSync(dirname(knownMarketplacesPath), { recursive: true });
  let knownMarketplaces: Record<string, unknown> = {};
  if (existsSync(knownMarketplacesPath)) {
    try {
      knownMarketplaces = JSON.parse(readFileSync(knownMarketplacesPath, "utf-8"));
    } catch {
      // Corrupted — start fresh
    }
  }

  knownMarketplaces[marketplaceName] = {
    source: {
      source: "local",
      path: marketplaceDir,
    },
    installLocation: marketplaceDir,
    lastUpdated: new Date().toISOString(),
  };
  writeFileSync(knownMarketplacesPath, JSON.stringify(knownMarketplaces, null, 2) + "\n");

  // 4. Register in installed_plugins.json
  let pluginsJson: Record<string, unknown> = { version: 2, plugins: {} };
  if (existsSync(pluginsJsonPath)) {
    try {
      pluginsJson = JSON.parse(readFileSync(pluginsJsonPath, "utf-8"));
    } catch {
      // Corrupted — start fresh
    }
  }

  const plugins = (pluginsJson.plugins as Record<string, unknown[]>) || {};

  // Remove any broken legacy entries
  if (plugins["x402@local"]) delete plugins["x402@local"];
  if (plugins["opendexter@local"]) delete plugins["opendexter@local"];

  const now = new Date().toISOString();
  plugins[pluginKey] = [
    {
      scope: "user",
      installPath: cacheDir,
      version,
      installedAt: now,
      lastUpdated: now,
    },
  ];
  pluginsJson.plugins = plugins;
  writeFileSync(pluginsJsonPath, JSON.stringify(pluginsJson, null, 2) + "\n");

  // 5. Enable in settings.json
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      const enabled = settings.enabledPlugins || {};

      // Remove any broken legacy entries
      if (enabled["x402@local"]) delete enabled["x402@local"];
      if (enabled["opendexter@local"]) delete enabled["opendexter@local"];

      enabled[pluginKey] = true;
      settings.enabledPlugins = enabled;
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    } catch {
      // Settings file parse error — skip, MCP still works
    }
  }

  return {
    ok: true,
    message: `Plugin installed (${skillDirs.length} skills) at ${cacheDir}`,
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

    // Claude Code gets full plugin installation (skills, manifest, registry)
    if (clientId === "claude-code" && result.ok) {
      const ps = spinner();
      ps.start("Installing OpenDexter skills plugin");
      const pluginResult = installClaudeCodePlugin();
      if (pluginResult.ok) {
        ps.stop("Skills plugin installed");
        successes.push(pluginResult.message);
      } else {
        ps.stop("Skills plugin failed");
        failures.push(pluginResult.message);
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
