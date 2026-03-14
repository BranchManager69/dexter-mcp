/**
 * Terminal progress display for vanity wallet generation.
 * Renders dual progress bars that update in place.
 */

import type { GrindProgress, VanityResult } from "./vanity.js";

const BAR_WIDTH = 24;
const FILLED = "█";
const EMPTY = "░";

function formatTime(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function truncateAddress(addr: string, len: number = 42): string {
  if (addr.length <= len) return addr;
  return addr.slice(0, len - 3) + "...";
}

function renderBar(ratio: number): string {
  const clamped = Math.min(ratio, 1);
  const filled = Math.round(clamped * BAR_WIDTH);
  return FILLED.repeat(filled) + EMPTY.repeat(BAR_WIDTH - filled);
}

function renderLine(
  label: string,
  chain: { attempts: number; expectedAttempts: number; found: boolean; result?: VanityResult },
): string {
  if (chain.found && chain.result) {
    const addr = truncateAddress(chain.result.address);
    const time = formatTime(chain.result.elapsedMs);
    return `  ${label}  ${addr}  ✓ ${time}`;
  }

  if (chain.expectedAttempts === 0) return "";

  const ratio = chain.attempts / chain.expectedAttempts;
  const pct = Math.min(Math.round(ratio * 100), 99);
  const bar = renderBar(ratio);
  return `  ${label}  ${bar}  ${String(pct).padStart(2)}%`;
}

export function createProgressRenderer(): (progress: GrindProgress) => void {
  let linesWritten = 0;
  const startTime = Date.now();
  let headerWritten = false;

  return (progress: GrindProgress) => {
    const output = process.stderr;

    if (!headerWritten) {
      output.write("\n  Creating your Dexter wallet...\n\n");
      headerWritten = true;
      linesWritten = 0;
    }

    // Move cursor up to overwrite previous lines
    if (linesWritten > 0) {
      output.write(`\x1b[${linesWritten}A`);
    }

    const lines: string[] = [];

    const solLine = renderLine("Solana  (dex...)", progress.solana);
    if (solLine) lines.push(solLine);

    const evmLine = renderLine("EVM     (0x402DD...)", progress.evm);
    if (evmLine) lines.push(evmLine);

    // Clear and write each line
    for (const line of lines) {
      output.write(`\x1b[2K${line}\n`);
    }
    linesWritten = lines.length;

    // If both done, print the final block
    if (progress.solana.found && progress.evm.found) {
      output.write("\n");
      output.write("  Deposit USDC to either address to start.\n");
      output.write("\n");
    }
  };
}
