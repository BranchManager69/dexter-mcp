import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DATA_DIR } from "./config.js";
import { join } from "node:path";

export const SETTINGS_FILE = join(DATA_DIR, "settings.json");
export const DEFAULT_MAX_AMOUNT_USDC = 5;

export interface DexterSettings {
  maxAmountUsdc: number;
}

export function loadSettings(): DexterSettings {
  if (!existsSync(SETTINGS_FILE)) {
    return { maxAmountUsdc: DEFAULT_MAX_AMOUNT_USDC };
  }

  try {
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8")) as Partial<DexterSettings>;
    const maxAmountUsdc = typeof raw.maxAmountUsdc === "number" && raw.maxAmountUsdc > 0
      ? raw.maxAmountUsdc
      : DEFAULT_MAX_AMOUNT_USDC;
    return { maxAmountUsdc };
  } catch {
    return { maxAmountUsdc: DEFAULT_MAX_AMOUNT_USDC };
  }
}

export function saveSettings(next: Partial<DexterSettings>): DexterSettings {
  const current = loadSettings();
  const merged: DexterSettings = {
    maxAmountUsdc:
      typeof next.maxAmountUsdc === "number" && next.maxAmountUsdc > 0
        ? next.maxAmountUsdc
        : current.maxAmountUsdc,
  };
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2) + "\n", { mode: 0o600 });
  return merged;
}
