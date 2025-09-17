import { z } from 'zod';

export function registerWalletExtraTools(server) {
  server.registerTool('get_wallet_holdings', {
    title: 'Get Wallet Holdings',
    description: 'Fetch wallet analysis from the API server',
    inputSchema: { wallet_address: z.string().min(32) },
    outputSchema: { success: z.boolean().optional() }
  }, async ({ wallet_address }) => {
    try {
      const fetch = (await import('node-fetch')).default;
      const apiUrl = process.env.API_BASE_URL || 'http://localhost:3004';
      const response = await fetch(`${apiUrl}/api/wallet-analysis/${wallet_address}`);
      if (!response.ok) throw new Error(`API returned ${response.status}: ${response.statusText}`);
      const data = await response.json();
      const out = {
        success: true,
        wallet_address,
        sol_balance: data.summary?.solBalance?.sol || 0,
        total_value_usd: data.portfolio?.totalValue || 0,
        tokens: (data.tokens||[]).map(t => ({ symbol: t.symbol, name: t.name, mint: t.mint, balance: t.balance, value_usd: t.value, price: t.price, market_cap: t.marketCap, liquidity: t.realQuoteLiquidity })),
        token_count: (data.tokens||[]).length
      };
      return { structuredContent: out };
    } catch (e) { return { content:[{ type:'text', text: e?.message || 'wallet_holdings_failed' }], isError:true }; }
  });
}

