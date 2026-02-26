import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname as pathDirname } from "node:path";

export const DATA_DIR = join(homedir(), ".dexterai-mcp");
export const WALLET_FILE = join(DATA_DIR, "wallet.json");

export const DEXTER_API_PROD = process.env.DEXTER_API_URL || "https://x402.dexter.cash";
export const DEXTER_API_DEV = "http://127.0.0.1:3030";
export const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.dexter.cash/api/solana/rpc";

export const MARKETPLACE_PATH = "/api/facilitator/marketplace/resources";

export function getApiBase(dev: boolean): string {
  return dev ? DEXTER_API_DEV : DEXTER_API_PROD;
}

function loadVersion(): string {
  try {
    const here = pathDirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const VERSION = loadVersion();
