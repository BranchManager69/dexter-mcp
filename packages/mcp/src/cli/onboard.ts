import { loadOrCreateWallet, getAllBalances } from "../wallet/index.js";
import { runInstall } from "./install/index.js";
import { CLIENTS, detectInstalledClients } from "./install/clients.js";
import { intro, outro, log, note } from "@clack/prompts";
import chalk from "chalk";
import { SUPPORTED_CHAIN_LABELS } from "../config.js";

interface SetupOpts {
  dev: boolean;
  yes: boolean;
}

function fundingAdvice(totalUsdc: number, wallet: { solanaAddress?: string; evmAddress?: string }) {
  if (totalUsdc > 0) {
    return [
      `Treasury online with ${totalUsdc.toFixed(2)} USDC available across active rails.`,
      "You are ready to search, inspect, and settle paid API calls.",
    ];
  }

  const lines = ["Treasury created, but no USDC is loaded yet."];
  if (wallet.solanaAddress) {
    lines.push(`- Solana funding rail: ${wallet.solanaAddress}`);
  }
  if (wallet.evmAddress) {
    lines.push(`- EVM funding rail:    ${wallet.evmAddress}`);
  }
  lines.push("Once funded, your agent can settle x402 API calls automatically.");
  return lines;
}

export async function runSetup(opts: SetupOpts): Promise<void> {
  intro(chalk.bold("OpenDexter setup"));
  log.message("Activating your agent wallet, wiring your clients, and bringing multichain settlement online.");

  const wallet = await loadOrCreateWallet({ quiet: true });
  if (!wallet) {
    console.error("Failed to create or load wallet.");
    process.exit(1);
  }

  const walletStatus =
    wallet.status === "created"
      ? "Fresh wallet activated"
      : wallet.status === "migrated"
        ? "Wallet upgraded for multichain settlement"
        : wallet.status === "env"
          ? "Wallet loaded from environment"
          : "Wallet online";
  log.step(walletStatus);
  if (wallet.info.solanaAddress) log.info(`Solana rail: ${wallet.info.solanaAddress}`);
  if (wallet.info.evmAddress) log.info(`EVM rail:    ${wallet.info.evmAddress}`);

  const detected = detectInstalledClients();
  if (detected.length > 0) {
    await runInstall({
      dev: opts.dev,
      yes: opts.yes,
      all: true,
      skipWalletSetup: true,
    });
  } else {
    log.warn("No supported clients were auto-detected.");
    log.message("You can still run `opendexter install --client <name>` manually later.");
  }

  const { totalUsdc } = await getAllBalances(wallet.info);

  note(`Settlement live across: ${SUPPORTED_CHAIN_LABELS.join(" · ")}`, "Rails");

  note(fundingAdvice(totalUsdc, wallet.info).join("\n"), "Funding");

  note(
    [
      "1. Run `opendexter wallet` to confirm your addresses and balances.",
      "2. Run `opendexter search <what-you-need>` to browse the marketplace.",
      "3. Run `opendexter check <url>` on any result before your first paid call.",
      "4. Run `opendexter fetch <url>` once your wallet is funded.",
    ].join("\n"),
    "First-use path",
  );

  let nextMove = "";
  if (totalUsdc > 0) {
    nextMove = "Treasury funded. Start with a real marketplace search for the task you actually want to complete.";
  } else {
    nextMove = "Fund a rail, then start with `opendexter search <what-you-need>`.";
  }
  outro(nextMove);
}
