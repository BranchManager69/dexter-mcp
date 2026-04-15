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

export const EVM_RPC_URLS: Record<string, string> = {
  "eip155:8453": process.env.BASE_RPC_URL || "https://mainnet.base.org",
  "eip155:137": process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
  "eip155:42161": process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  "eip155:10": process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
  "eip155:43114": process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
};

export const EVM_USDC_ADDRESSES: Record<string, `0x${string}`> = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "eip155:137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  "eip155:42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "eip155:10": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  "eip155:43114": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
};

export const CHAIN_NAMES: Record<string, { name: string; family: "svm" | "evm"; tier: "first" | "second" }> = {
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": { name: "Solana", family: "svm", tier: "first" },
  "eip155:8453": { name: "Base", family: "evm", tier: "first" },
  "eip155:137": { name: "Polygon", family: "evm", tier: "second" },
  "eip155:42161": { name: "Arbitrum", family: "evm", tier: "second" },
  "eip155:10": { name: "Optimism", family: "evm", tier: "second" },
  "eip155:43114": { name: "Avalanche", family: "evm", tier: "second" },
};

export const SUPPORTED_CHAIN_LABELS = [
  "Solana",
  "Base",
  "Polygon",
  "Arbitrum",
  "Optimism",
  "Avalanche",
] as const;

/**
 * Capability search endpoint — semantic vector search over the x402 corpus
 * with query expansion, similarity floor, tiered results (strong/related),
 * and cross-encoder LLM rerank. Returns {strongResults, relatedResults,
 * strongCount, relatedCount, topSimilarity, noMatchReason, rerank, intent}.
 *
 * Replaces the legacy substring ranker at /api/facilitator/marketplace/resources
 * which was removed in dexter-api as of 2026-04-15.
 */
export const CAPABILITY_PATH = "/api/x402gle/capability";

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
