import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LoadedWallet } from "../wallet/index.js";
import { getAllBalances } from "../wallet/index.js";
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
    "Show wallet addresses (Solana + EVM), USDC balances across all chains, and deposit instructions. " +
      "The wallet is used to automatically pay for x402 API calls on Solana, Base, Polygon, Arbitrum, Optimism, and Avalanche.",
    {},
    async () => {
      if (!wallet) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "No wallet configured",
                tip: "Set DEXTER_PRIVATE_KEY (Solana) or EVM_PRIVATE_KEY (EVM) env var, or run `npx @dexterai/opendexter wallet` to create one.",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const { totalUsdc, chains } = await getAllBalances(wallet.info);
        const data: Record<string, unknown> = {
          solanaAddress: wallet.info.solanaAddress,
          evmAddress: wallet.info.evmAddress || null,
          network: "multichain",
          totalUsdc,
          chains,
          walletFile: WALLET_FILE,
        };
        if (totalUsdc === 0) {
          data.tip = `Deposit USDC to ${wallet.info.solanaAddress} (Solana) or ${wallet.info.evmAddress || "configure EVM key"} (Base/Polygon/Arbitrum/Optimism/Avalanche) to start paying.`;
        }
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
