import { z } from 'zod';

import { fetchGmgnTokenSnapshot } from '../../integrations/gmgn.mjs';
import { fetchWithX402Json } from '../../clients/x402Client.mjs';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || 'http://localhost:3030';

function headersFromExtra(extra) {
  try {
    if (extra?.requestInfo?.headers) return extra.requestInfo.headers;
  } catch {}
  try {
    if (extra?.request?.headers) return extra.request.headers;
  } catch {}
  try {
    if (extra?.httpRequest?.headers) return extra.httpRequest.headers;
  } catch {}
  return {};
}

function getSupabaseBearer(extra) {
  const headers = headersFromExtra(extra);
  const candidates = [
    headers?.authorization,
    headers?.Authorization,
    headers?.['x-authorization'],
    headers?.['X-Authorization'],
    headers?.['x-user-token'],
    headers?.['X-User-Token'],
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('Bearer ')) {
      const token = trimmed.slice(7).trim();
      if (token && token !== process.env.TOKEN_AI_MCP_TOKEN) {
        return token;
      }
    } else if (candidate === headers?.['x-user-token'] || candidate === headers?.['X-User-Token']) {
      return trimmed;
    }
  }

  const envToken = String(process.env.MCP_SUPABASE_BEARER || '').trim();
  return envToken || null;
}

async function ensureGmgnAccess(extra) {
  const base = (process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  const token = getSupabaseBearer(extra);
  const headers = Object.assign({ Accept: 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {});

  const { response, json, text } = await fetchWithX402Json(
    `${base}/api/payments/x402/access/gmgn`,
    {
      method: 'POST',
      headers,
    },
    {
      metadata: { toolset: 'gmgn', resource: 'gmgn_fetch_token_snapshot' },
      authHeaders: headers,
    },
  );

  if (!response.ok) {
    const payload = json ?? text ?? {};
    const message = typeof payload === 'object' ? payload?.error || payload?.message || 'gmgn_payment_failed' : String(payload);
    throw new Error(message);
  }
}

const INPUT_SCHEMA = z.object({
  token_address: z.string().min(1, 'token_address_required'),
  chain: z.string().min(1).optional(),
  resolution: z.string().min(1).optional(),
  candle_limit: z.number().int().min(10).max(500).optional(),
  include_trades: z.boolean().optional(),
  include_security: z.boolean().optional(),
  include_candles: z.boolean().optional(),
  timeout_ms: z.number().int().min(5000).max(120000).optional(),
});

function summariseSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {};
  const stat = snapshot.requests?.token_stat?.data?.data || {};
  const preview = snapshot.requests?.token_preview?.data?.data || {};
  const candles = snapshot.requests?.token_candles?.data?.data?.list || [];
  const trades = snapshot.requests?.token_trades_recent?.data?.data?.history || [];

  const latestCandle = candles.length ? candles[candles.length - 1] : null;

  return {
    name: preview.name || null,
    symbol: preview.symbol || null,
    market_cap: preview.mc ? Number(preview.mc) : null,
    price_change_24h: preview.price_24_change ? Number(preview.price_24_change) : null,
    holder_count: stat.holder_count ?? null,
    creator: preview.creator || null,
    candles_returned: candles.length,
    latest_price: latestCandle ? Number(latestCandle.close) : null,
    trade_samples: trades.length,
  };
}

export function registerGmgnToolset(server) {
      server.registerTool(
    'gmgn_fetch_token_snapshot',
    {
      title: 'Fetch GMGN Token Snapshot',
      description: 'Fetches token info from GMGN for a specified token.',
      _meta: {
        category: 'gmgn.analytics',
        access: 'guest',
        tags: ['gmgn', 'scrape', 'token', 'snapshot'],
      },
      inputSchema: INPUT_SCHEMA.shape,
      outputSchema: {
        chain: z.string(),
        token_slug: z.string(),
        token_address: z.string(),
        fetched_at: z.string(),
        target_url: z.string(),
        base_query: z.record(z.string()).optional(),
        requests: z.record(
          z.object({
            status: z.number(),
            ok: z.boolean(),
            url: z.string(),
            method: z.string(),
            data: z.any(),
          }),
        ),
      },
    },
    async (args = {}, extra) => {
      let parsed;
      try {
        parsed = INPUT_SCHEMA.parse(args);
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'invalid_arguments', details: error?.errors || error?.message }),
            },
          ],
          isError: true,
        };
      }

      try {
        await ensureGmgnAccess(extra);
        const snapshot = await fetchGmgnTokenSnapshot({
          chain: parsed.chain,
          address: parsed.token_address,
          resolution: parsed.resolution,
          candle_limit: parsed.candle_limit,
          include_trades: parsed.include_trades,
          include_security: parsed.include_security,
          include_candles: parsed.include_candles,
          timeout_ms: parsed.timeout_ms,
        });

        const summary = summariseSnapshot(snapshot);

        return {
          structuredContent: snapshot,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                token: summary.symbol ? `${summary.symbol} (${summary.name || 'unknown'})` : summary.name || snapshot.token_address,
                market_cap: summary.market_cap,
                holders: summary.holder_count,
                latest_price: summary.latest_price,
                candles: summary.candles_returned,
                trades: summary.trade_samples,
              }),
            },
          ],
        };
      } catch (error) {
        const message = error?.message || 'gmgn_snapshot_failed';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );
}

export default { registerGmgnToolset };
