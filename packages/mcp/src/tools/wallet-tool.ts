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
        const chainBalances = Object.fromEntries(
          Object.entries(chains).map(([caip2, chain]) => [
            caip2,
            {
              available: String(Math.round(chain.usdc * 1e6)),
              name: chain.name,
              tier: caip2 === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" || caip2 === "eip155:8453" ? "first" : "second",
            },
          ]),
        );
        const data: Record<string, unknown> = {
          address: wallet.info.solanaAddress || wallet.info.evmAddress || null,
          solanaAddress: wallet.info.solanaAddress,
          evmAddress: wallet.info.evmAddress || null,
          network: "multichain",
          // Keep the wallet contract aligned with the hosted MCP surfaces so
          // ChatGPT widgets can normalize once and render every producer safely.
          chainBalances,
          balances: {
            usdc: totalUsdc,
            fundedAtomic: String(Math.round(totalUsdc * 1e6)),
            spentAtomic: "0",
            availableAtomic: String(Math.round(totalUsdc * 1e6)),
          },
          supportedNetworks: Object.keys(chainBalances).length > 0
            ? Object.keys(chainBalances)
            : ["solana", "base", "polygon", "arbitrum", "optimism", "avalanche"],
          walletFile: WALLET_FILE,
        };
        if (totalUsdc === 0) {
          data.tip = `Deposit USDC to ${wallet.info.solanaAddress || "your Solana wallet"}${wallet.info.evmAddress ? ` or ${wallet.info.evmAddress}` : ""} to start paying.`;
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
