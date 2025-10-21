import { z } from 'zod';

import { fetchOhlcvRange } from '../../integrations/birdeye.mjs';

const INPUT_SCHEMA = z.object({
  mint_address: z.string().min(1).describe('Token mint address (Base58).').optional(),
  pair_address: z.string().min(1).describe('Birdeye pair address. If omitted we auto-select the top-liquidity pair for the mint.').optional(),
  chain: z.string().min(1).describe('Chain identifier accepted by Birdeye (default solana).').optional(),
  interval: z.string().min(1).describe('Birdeye interval string (e.g. 1m, 5m, 1H). Overrides interval_minutes.').optional(),
  interval_minutes: z.number().int().positive().max(60).describe('Legacy interval in minutes (mapped to Birdeye interval string when interval is not provided).').optional(),
  time_from: z.number().int().nonnegative().describe('Epoch seconds for start of window. Defaults based on interval.').optional(),
  time_to: z.number().int().nonnegative().describe('Epoch seconds for end of window. Defaults to current time.').optional(),
  currency: z.enum(['usd', 'native']).describe('Currency for Birdeye OHLCV values. Defaults to usd.').optional(),
});

export function registerMarketsToolset(server) {
  server.registerTool(
    'markets_fetch_ohlcv',
    {
      title: 'Fetch OHLCV Range',
      description: 'Fetch Birdeye OHLCV candles for a Solana token mint over a specified window.',
      _meta: {
        category: 'markets.analytics',
        access: 'guest',
        tags: ['ohlcv', 'birdeye', 'markets'],
      },
      inputSchema: INPUT_SCHEMA.shape,
      outputSchema: {
        provider: z.string().optional(),
        chain: z.string().optional(),
        mint_address: z.string().nullable(),
        pair_address: z.string(),
        time_from: z.number().int(),
        time_to: z.number().int(),
        interval: z.string().optional(),
        interval_seconds: z.number().int().optional(),
        interval_minutes: z.number().int().nullable().optional(),
        currency: z.string().nullable().optional(),
        note: z.string().optional(),
        ohlcv: z.array(
          z.object({
            t: z.number().int(),
            o: z.number().nullable(),
            h: z.number().nullable(),
            l: z.number().nullable(),
            c: z.number().nullable(),
            v: z.number().nullable().optional(),
            v_usd: z.number().nullable().optional(),
            v_base: z.number().nullable().optional(),
            v_quote: z.number().nullable().optional(),
            currency: z.string().nullable().optional(),
          }),
        ),
      },
    },
    async (args = {}) => {
      let parsed;
      try {
        parsed = INPUT_SCHEMA.parse(args);
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'invalid_arguments', details: error?.message }) }],
          isError: true,
        };
      }

      try {
        const result = await fetchOhlcvRange({
          mintAddress: parsed.mint_address,
          pairAddress: parsed.pair_address,
          chain: parsed.chain,
          interval: parsed.interval,
          timeFrom: parsed.time_from,
          timeTo: parsed.time_to,
          intervalMinutes: parsed.interval_minutes,
          currency: parsed.currency,
        });

        const summary = {
          provider: result.provider,
          chain: result.chain,
          mint_address: result.mint_address,
          pair_address: result.pair_address,
          time_from: result.time_from,
          time_to: result.time_to,
          interval: result.interval,
          interval_seconds: result.interval_seconds,
          interval_minutes: result.interval_minutes,
          currency: result.currency,
          candles: Array.isArray(result.ohlcv) ? result.ohlcv.length : 0,
          note: result.note || undefined,
        };

        return {
          structuredContent: result,
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary),
            },
          ],
        };
      } catch (error) {
        const message = error?.message || 'ohlcv_fetch_failed';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );
}

export default { registerMarketsToolset };
