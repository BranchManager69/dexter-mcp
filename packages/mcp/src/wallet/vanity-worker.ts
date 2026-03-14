/**
 * Worker thread for vanity address grinding.
 * Receives a target config via workerData, grinds until a match is found,
 * then posts the result back to the parent.
 */

import { parentPort, workerData } from "node:worker_threads";
import { Keypair } from "@solana/web3.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import bs58 from "bs58";

interface VanityTask {
  chain: "solana" | "evm";
  prefix: string;
  caseSensitive: boolean;
}

const task = workerData as VanityTask;
const target = task.caseSensitive ? task.prefix : task.prefix.toLowerCase();

let attempts = 0;
const REPORT_INTERVAL = 500;

if (task.chain === "solana") {
  while (true) {
    const kp = Keypair.generate();
    const addr = kp.publicKey.toBase58();
    attempts++;

    const check = task.caseSensitive ? addr : addr.toLowerCase();
    if (check.startsWith(target)) {
      parentPort?.postMessage({
        type: "found",
        address: addr,
        privateKey: bs58.encode(kp.secretKey),
        attempts,
      });
      break;
    }

    if (attempts % REPORT_INTERVAL === 0) {
      parentPort?.postMessage({ type: "progress", attempts });
    }
  }
} else {
  while (true) {
    const pk = generatePrivateKey();
    const acct = privateKeyToAccount(pk);
    attempts++;

    const check = task.caseSensitive ? acct.address : acct.address.toLowerCase();
    if (check.startsWith(target)) {
      parentPort?.postMessage({
        type: "found",
        address: acct.address,
        privateKey: pk,
        attempts,
      });
      break;
    }

    if (attempts % REPORT_INTERVAL === 0) {
      parentPort?.postMessage({ type: "progress", attempts });
    }
  }
}
