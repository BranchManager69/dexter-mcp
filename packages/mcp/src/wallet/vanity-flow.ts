import { confirm, intro, log, outro, select, text } from "@clack/prompts";
import chalk from "chalk";
import { createProgressRenderer } from "./vanity-progress.js";
import { generateVanityWallet } from "./vanity.js";
import { loadOrCreateWallet, saveWalletInfo, type WalletInfo } from "./index.js";
import { WALLET_FILE } from "../config.js";

interface VanityFlowOpts {
  dev: boolean;
  solanaPrefix?: string;
  evmPrefix?: string;
  caseSensitive?: boolean;
  yes?: boolean;
}

const PRESETS = {
  balanced: {
    label: "Balanced",
    hint: "Fast enough to generate, still looks branded",
    solanaPrefix: "Dex",
    evmPrefix: "402",
  },
  branded: {
    label: "Branded",
    hint: "Stronger Dexter feel, slightly slower",
    solanaPrefix: "Dex",
    evmPrefix: "402dd",
  },
  solana: {
    label: "Solana-first",
    hint: "Only grind the Solana address",
    solanaPrefix: "Dex",
    evmPrefix: undefined,
  },
  custom: {
    label: "Custom",
    hint: "Set your own Solana and/or EVM prefix",
    solanaPrefix: undefined,
    evmPrefix: undefined,
  },
} as const;

function applyVanity(current: WalletInfo, vanity: { solana?: { address: string; privateKey: string }; evm?: { address: string; privateKey: string } }): WalletInfo {
  return {
    ...current,
    ...(vanity.solana
      ? {
          solanaAddress: vanity.solana.address,
          solanaPrivateKey: vanity.solana.privateKey,
        }
      : {}),
    ...(vanity.evm
      ? {
          evmAddress: vanity.evm.address,
          evmPrivateKey: vanity.evm.privateKey,
        }
      : {}),
  };
}

export async function runVanityFlow(opts: VanityFlowOpts): Promise<void> {
  intro(chalk.bold("OpenDexter vanity wallet"));
  log.message("Mint a more recognizable agent wallet identity without changing how OpenDexter works.");

  const wallet = await loadOrCreateWallet({ quiet: true });
  if (!wallet) {
    console.error("Failed to load wallet.");
    process.exit(1);
  }

  log.info(`Current Solana: ${wallet.info.solanaAddress}`);
  if (wallet.info.evmAddress) log.info(`Current EVM:    ${wallet.info.evmAddress}`);

  let solanaPrefix = opts.solanaPrefix;
  let evmPrefix = opts.evmPrefix;
  let caseSensitive = opts.caseSensitive ?? false;

  if (!solanaPrefix && !evmPrefix) {
    const preset = await select({
      message: "Choose the vanity wallet style",
      options: Object.entries(PRESETS).map(([value, presetValue]) => ({
        value,
        label: presetValue.label,
        hint: presetValue.hint,
      })),
    });

    if (typeof preset !== "string") {
      throw new Error("No vanity preset selected.");
    }

    const selected = PRESETS[preset as keyof typeof PRESETS];
    solanaPrefix = selected.solanaPrefix;
    evmPrefix = selected.evmPrefix;

    if (preset === "custom") {
      const solanaAnswer = await text({
        message: "Solana prefix (optional)",
        placeholder: "Dex",
      });
      const evmAnswer = await text({
        message: "EVM prefix after 0x (optional)",
        placeholder: "402dd",
      });

      solanaPrefix = typeof solanaAnswer === "string" && solanaAnswer.trim() ? solanaAnswer.trim() : undefined;
      evmPrefix = typeof evmAnswer === "string" && evmAnswer.trim() ? evmAnswer.trim() : undefined;
    }
  }

  if (!solanaPrefix && !evmPrefix) {
    console.error("At least one vanity prefix is required.");
    process.exit(1);
  }

  const proceed = opts.yes
    ? true
    : await confirm({
        message: `Generate a vanity wallet${solanaPrefix ? ` (Solana: ${solanaPrefix})` : ""}${evmPrefix ? ` (EVM: 0x${evmPrefix})` : ""}?`,
      });

  if (!proceed) {
    outro("Vanity wallet generation cancelled.");
    return;
  }

  const progressRenderer = createProgressRenderer();
  log.step("Grinding vanity addresses");

  const result = await generateVanityWallet({
    solanaPrefix,
    evmPrefix,
    caseSensitive,
    onProgress: progressRenderer,
  });

  const nextWallet = applyVanity(wallet.info, result);
  saveWalletInfo(nextWallet);

  if (result.solana) {
    log.success(`New Solana vanity: ${result.solana.address}`);
  }
  if (result.evm) {
    log.success(`New EVM vanity:    ${result.evm.address}`);
  }
  log.info(`Saved to ${WALLET_FILE}`);

  outro("Vanity wallet is live. OpenDexter will use it for future local payments.");
}
