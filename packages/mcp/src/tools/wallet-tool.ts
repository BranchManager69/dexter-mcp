import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LoadedWallet } from "../wallet/index.js";
import { getSolanaBalance } from "../wallet/index.js";
import { WALLET_FILE } from "../config.js";
import { WALLET_META } from "../widget-meta.js";

interface WalletToolOpts {
  dev: boolean;
}

export function registerWalletTool(
  server: McpServer,
  wallet: LoadedWallet | null,
  opts: WalletToolOpts,
): void {
  server.tool(
    "x402_wallet",
    "Show wallet address, USDC balance, and deposit instructions. " +
      "The wallet is used to automatically pay for x402 API calls.",
    {},
    async () => {
      if (!wallet) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "No wallet configured",
                tip: "Set DEXTER_PRIVATE_KEY env var or run `npx @dexterai/opendexter wallet` to create one.",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const balance = await getSolanaBalance(wallet.info.solanaAddress);
        const data = {
          address: wallet.info.solanaAddress,
          network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
          networkName: "Solana Mainnet",
          balances: { sol: balance.sol, usdc: balance.usdc },
          walletFile: WALLET_FILE,
          tip: balance.usdc === 0
            ? `Deposit USDC (Solana) to ${wallet.info.solanaAddress} to start paying for x402 APIs.`
            : undefined,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
          _meta: WALLET_META,
        } as any;
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: err.message }) },
          ],
          isError: true,
        };
      }
    },
  );
}
