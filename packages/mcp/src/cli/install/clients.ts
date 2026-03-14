import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

export type ClientId =
  | "cursor"
  | "claude-code"
  | "codex"
  | "vscode"
  | "windsurf"
  | "gemini-cli";

interface ClientMeta {
  name: string;
  description: string;
}

export const CLIENTS: Record<ClientId, ClientMeta> = {
  cursor: {
    name: "Cursor",
    description: "Cursor AI code editor",
  },
  "claude-code": {
    name: "Claude Code",
    description: "Anthropic Claude Code CLI",
  },
  codex: {
    name: "Codex",
    description: "OpenAI Codex CLI",
  },
  vscode: {
    name: "VS Code",
    description: "Visual Studio Code with MCP support",
  },
  windsurf: {
    name: "Windsurf",
    description: "Codeium Windsurf editor",
  },
  "gemini-cli": {
    name: "Gemini CLI",
    description: "Google Gemini CLI",
  },
};

export function detectInstalledClients(): ClientId[] {
  const configDir = getConfigDir();
  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");

  const checks: Array<[ClientId, boolean]> = [
    ["cursor", existsSync(join(homedir(), ".cursor"))],
    ["claude-code", existsSync(join(homedir(), ".claude.json")) || existsSync(join(homedir(), ".claude"))],
    ["codex", existsSync(codexHome)],
    ["vscode", existsSync(join(configDir, "Code")) || existsSync(join(configDir, "Code - Insiders"))],
    ["windsurf", existsSync(join(homedir(), ".codeium", "windsurf"))],
    ["gemini-cli", existsSync(join(homedir(), ".gemini"))],
  ];

  return checks.filter(([, present]) => present).map(([id]) => id);
}

interface ClientConfig {
  configPath: string;
  sectionKey: string;
  entry: Record<string, unknown>;
  manual?: boolean;
}

const SERVER_CMD = {
  command: "npx",
  args: ["-y", "@dexterai/opendexter@latest"],
};

const SERVER_CMD_DEV = {
  command: "node",
  args: [process.cwd() + "/dist/index.js", "--dev"],
};

function getConfigDir(): string {
  const platform = process.platform;
  if (platform === "win32") {
    return process.env.APPDATA || join(homedir(), "AppData", "Roaming");
  }
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support");
  }
  return process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
}

export function getClientConfig(client: ClientId, dev: boolean): ClientConfig {
  const cmd = dev ? SERVER_CMD_DEV : SERVER_CMD;

  switch (client) {
    case "cursor":
      return {
        configPath: join(homedir(), ".cursor", "mcp.json"),
        sectionKey: "mcpServers",
        entry: cmd,
      };

    case "claude-code":
      return {
        configPath: join(homedir(), ".claude.json"),
        sectionKey: "mcpServers",
        entry: cmd,
      };

    case "codex": {
      const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
      return {
        configPath: join(codexHome, "config.toml"),
        sectionKey: "mcp_servers",
        entry: cmd,
        manual: true, // TOML requires different handling
      };
    }

    case "vscode": {
      const configDir = getConfigDir();
      const vscodeDirs = ["Code", "Code - Insiders"];
      const dir = vscodeDirs.find((d) => existsSync(join(configDir, d))) || "Code";
      return {
        configPath: join(configDir, dir, "User", "mcp.json"),
        sectionKey: "mcpServers",
        entry: cmd,
      };
    }

    case "windsurf":
      return {
        configPath: join(homedir(), ".codeium", "windsurf", "mcp_config.json"),
        sectionKey: "mcpServers",
        entry: cmd,
      };

    case "gemini-cli":
      return {
        configPath: join(homedir(), ".gemini", "settings.json"),
        sectionKey: "mcpServers",
        entry: cmd,
      };
  }
}
