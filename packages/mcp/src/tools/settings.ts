import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadSettings, saveSettings, SETTINGS_FILE } from "../settings.js";

export function registerSettingsTool(server: McpServer): void {
  server.tool(
    "x402_settings",
    "Read or update OpenDexter spending policy. Use this to inspect or change the default max amount the agent is allowed to spend on a single API call.",
    {
      maxAmountUsdc: z.number().positive().optional().describe("Optional new per-call max spend in USDC."),
    },
    async (args) => {
      const settings = args.maxAmountUsdc != null
        ? saveSettings({ maxAmountUsdc: args.maxAmountUsdc })
        : loadSettings();

      const payload = {
        settings,
        settingsFile: SETTINGS_FILE,
        tip: "x402_fetch will reject requests above maxAmountUsdc unless you raise it here.",
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      } as any;
    },
  );
}

export async function cliSettings(opts: { maxAmountUsdc?: number }): Promise<void> {
  const settings = opts.maxAmountUsdc != null
    ? saveSettings({ maxAmountUsdc: opts.maxAmountUsdc })
    : loadSettings();

  console.log(
    JSON.stringify(
      {
        settings,
        settingsFile: SETTINGS_FILE,
      },
      null,
      2,
    ),
  );
}
