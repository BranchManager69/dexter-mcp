/**
 * Vanity address generator with parallel worker threads and progress reporting.
 *
 * Calibrates against the local machine on first use, then grinds Solana and
 * EVM addresses in parallel across all available cores.
 */

import { Worker } from "node:worker_threads";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// In the built output, the worker lives at dist/wallet/vanity-worker.js
// while this module lives at dist/index.js. Resolve relative to this file.
const WORKER_PATH = join(dirname(fileURLToPath(import.meta.url)), "wallet", "vanity-worker.js");

export interface VanityTarget {
  chain: "solana" | "evm";
  prefix: string;
  caseSensitive?: boolean;
}

export interface VanityResult {
  chain: "solana" | "evm";
  address: string;
  privateKey: string;
  attempts: number;
  elapsedMs: number;
}

export interface GrindProgress {
  solana: { attempts: number; expectedAttempts: number; found: boolean; result?: VanityResult };
  evm: { attempts: number; expectedAttempts: number; found: boolean; result?: VanityResult };
}

function estimateAttempts(target: VanityTarget): number {
  const prefix = target.prefix.replace(/^0x/i, "");
  const len = prefix.length;

  if (target.chain === "solana") {
    // Base58 alphabet = 58 chars. Case-insensitive roughly halves for alpha chars.
    if (target.caseSensitive) return Math.pow(58, len);
    let combos = 1;
    const b58alpha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const b58digits = "123456789";
    for (const ch of prefix) {
      const lower = ch.toLowerCase();
      const upper = ch.toUpperCase();
      if (lower !== upper && b58alpha.includes(lower) && b58alpha.includes(upper)) {
        combos *= 2;
      }
    }
    return Math.round(Math.pow(58, len) / combos);
  }

  // EVM: hex, 16 chars per position. Case-insensitive for a-f doubles matches.
  let combos = 1;
  for (const ch of prefix) {
    if (/[a-fA-F]/.test(ch)) {
      combos *= 2; // both cases match
    }
  }
  return Math.round(Math.pow(16, len) / combos);
}

function calibrate(chain: "solana" | "evm", durationMs: number = 1000): Promise<number> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: {
        chain,
        // Impossible prefix — forces the worker to just grind and report progress
        prefix: chain === "solana" ? "ZZZZZZZZZZZZ" : "0xffffffffffff",
        caseSensitive: true,
      },
    });

    let totalAttempts = 0;
    const start = Date.now();

    worker.on("message", (msg) => {
      if (msg.type === "progress") {
        totalAttempts = msg.attempts;
      }
    });

    setTimeout(() => {
      worker.terminate();
      const elapsed = (Date.now() - start) / 1000;
      resolve(Math.round(totalAttempts / elapsed));
    }, durationMs);
  });
}

function grindOne(target: VanityTarget, numWorkers: number): {
  promise: Promise<VanityResult>;
  getAttempts: () => number;
  cancel: () => void;
} {
  const workers: Worker[] = [];
  let totalAttempts = 0;
  let cancelled = false;
  const start = Date.now();

  const promise = new Promise<VanityResult>((resolve) => {
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(WORKER_PATH, {
        workerData: {
          chain: target.chain,
          prefix: target.prefix,
          caseSensitive: target.caseSensitive ?? false,
        },
      });

      worker.on("message", (msg) => {
        if (msg.type === "progress") {
          totalAttempts += msg.attempts;
          // Reset worker-local counter tracking by just accumulating
        }
        if (msg.type === "found" && !cancelled) {
          cancelled = true;
          const result: VanityResult = {
            chain: target.chain,
            address: msg.address,
            privateKey: msg.privateKey,
            attempts: totalAttempts + msg.attempts,
            elapsedMs: Date.now() - start,
          };
          for (const w of workers) w.terminate();
          resolve(result);
        }
      });

      workers.push(worker);
    }
  });

  return {
    promise,
    getAttempts: () => totalAttempts,
    cancel: () => {
      cancelled = true;
      for (const w of workers) w.terminate();
    },
  };
}

export interface VanityOptions {
  solanaPrefix?: string;
  evmPrefix?: string;
  caseSensitive?: boolean;
  onProgress?: (progress: GrindProgress) => void;
  progressIntervalMs?: number;
}

export async function generateVanityWallet(opts: VanityOptions): Promise<{
  solana?: VanityResult;
  evm?: VanityResult;
}> {
  const totalCores = cpus().length;

  const hasSolana = !!opts.solanaPrefix;
  const hasEvm = !!opts.evmPrefix;
  if (!hasSolana && !hasEvm) throw new Error("At least one prefix required");

  // Split cores between chains, giving more to the slower one (EVM)
  // EVM prefix (0x402, 4 hex chars) is much easier than Solana (dex, 3 base58 chars)
  // so give Solana more cores
  const solanaCores = hasSolana && hasEvm ? Math.max(2, Math.floor(totalCores * 0.6)) : totalCores;
  const evmCores = hasEvm ? totalCores - (hasSolana ? solanaCores : 0) : 0;

  const solanaExpected = hasSolana
    ? estimateAttempts({ chain: "solana", prefix: opts.solanaPrefix!, caseSensitive: opts.caseSensitive })
    : 0;
  const evmExpected = hasEvm
    ? estimateAttempts({ chain: "evm", prefix: opts.evmPrefix!, caseSensitive: opts.caseSensitive })
    : 0;

  const results: { solana?: VanityResult; evm?: VanityResult } = {};

  const solanaGrind = hasSolana
    ? grindOne({ chain: "solana", prefix: opts.solanaPrefix!, caseSensitive: opts.caseSensitive }, solanaCores)
    : null;
  const evmGrind = hasEvm
    ? grindOne({ chain: "evm", prefix: opts.evmPrefix!, caseSensitive: opts.caseSensitive }, evmCores)
    : null;

  const progress: GrindProgress = {
    solana: { attempts: 0, expectedAttempts: solanaExpected, found: false },
    evm: { attempts: 0, expectedAttempts: evmExpected, found: false },
  };

  const interval = opts.onProgress
    ? setInterval(() => {
        if (solanaGrind && !progress.solana.found) {
          progress.solana.attempts = solanaGrind.getAttempts();
        }
        if (evmGrind && !progress.evm.found) {
          progress.evm.attempts = evmGrind.getAttempts();
        }
        opts.onProgress!(progress);
      }, opts.progressIntervalMs ?? 200)
    : null;

  const pending: Promise<void>[] = [];

  if (solanaGrind) {
    pending.push(
      solanaGrind.promise.then((r) => {
        results.solana = r;
        progress.solana.found = true;
        progress.solana.result = r;
        progress.solana.attempts = r.attempts;
      }),
    );
  }

  if (evmGrind) {
    pending.push(
      evmGrind.promise.then((r) => {
        results.evm = r;
        progress.evm.found = true;
        progress.evm.result = r;
        progress.evm.attempts = r.attempts;
      }),
    );
  }

  await Promise.all(pending);

  if (interval) clearInterval(interval);
  // Fire one final progress update
  if (opts.onProgress) opts.onProgress(progress);

  return results;
}
