import { z } from 'zod';
import { fetchWithX402Json } from '../../clients/x402Client.mjs';
import { buildApiUrl } from '../wallet/index.mjs';

const DEFAULT_API_BASE_URL = 'http://localhost:3030';

function resolveApiBase() {
  const candidates = [
    process.env.HYPERLIQUID_API_BASE_URL,
    process.env.API_BASE_URL,
    process.env.DEXTER_API_BASE_URL,
    DEFAULT_API_BASE_URL,
  ];
  for (const candidate of candidates) {
    if (!candidate || !candidate.trim()) continue;
    const normalized = buildApiUrl(candidate, '').replace(/\/api$/i, '');
    if (normalized) return normalized.replace(/\/+$/, '');
  }
  return buildApiUrl(DEFAULT_API_BASE_URL, '').replace(/\/api$/i, '').replace(/\/+$/, '');
}

function extractAuthorization(extra) {
  const sources = [
    extra?.requestInfo?.headers,
    extra?.request?.headers,
    extra?.httpRequest?.headers,
  ];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const auth =
      source.authorization ||
      source.Authorization ||
      source['x-authorization'] ||
      source['X-Authorization'];
    if (typeof auth === 'string' && auth.trim()) {
      return auth.trim();
    }
  }
  return null;
}

const optInSchema = z.object({
  managedWalletPublicKey: z
    .string()
    .min(32, 'managed_wallet_too_short')
    .max(64, 'managed_wallet_too_long')
    .optional(),
  agentName: z.string().min(3, 'agent_name_short').max(31, 'agent_name_long').optional(),
});

const perpTradeSchema = z.object({
  managedWalletPublicKey: z.string().min(1, 'managed_wallet_required'),
  hyperliquidSymbol: z.string().min(1, 'symbol_required'),
  side: z.enum(['buy', 'sell']),
  size: z.number().positive('size_must_be_positive'),
  limitPrice: z.number().positive('limit_price_must_be_positive').optional(),
  stopLossPrice: z.number().positive('stop_loss_must_be_positive').optional(),
  takeProfitPrice: z.number().positive('take_profit_must_be_positive').optional(),
  reduceOnly: z.boolean().optional(),
  allowMarket: z.boolean().optional(),
  leverage: z.number().positive('leverage_must_be_positive').optional(),
});

export function registerHyperliquidToolset(server) {
  const base = resolveApiBase();

  server.registerTool(
    'hyperliquid_markets',
    {
      title: 'Hyperliquid Market List',
      description: 'Returns the current list of tradable Hyperliquid perp symbols.',
      _meta: {
        category: 'hyperliquid',
        access: 'pro',
        tags: ['hyperliquid', 'markets', 'listing'],
      },
      inputSchema: z.object({}).passthrough(),
    },
    async (_input = {}, extra = {}) => {
      const authHeader = extractAuthorization(extra);
      const headers = {
        Accept: 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      };

      const { response, json, text } = await fetchWithX402Json(
        `${base}/hyperliquid/markets`,
        { method: 'GET', headers },
        {
          metadata: { tool: 'hyperliquid_markets' },
          authHeaders: headers,
        },
      );

      if (!response.ok) {
        const message =
          (json && (json.error || json.message)) ||
          text ||
          `hyperliquid_markets_failed:${response.status}`;
        throw new Error(String(message));
      }

      return {
        structuredContent: json,
        content: [{ type: 'text', text: JSON.stringify(json) }],
      };
    },
  );

  server.registerTool(
    'hyperliquid_opt_in',
    {
      title: 'Hyperliquid Opt-in',
      description:
        'Provision a Hyperliquid agent wallet for a Dexter-managed wallet so the user can trade perps.',
      _meta: {
        category: 'hyperliquid',
        access: 'pro',
        tags: ['hyperliquid', 'onboarding', 'x402'],
        promptSlug: 'agent.concierge.tool.hyperliquid_opt_in',
      },
      inputSchema: optInSchema,
    },
    async (input = {}, extra = {}) => {
      const payload = optInSchema.parse(input);
      const authHeader = extractAuthorization(extra);

      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      };

      const { response, json, text } = await fetchWithX402Json(
        `${base}/hyperliquid/opt-in`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
        {
          metadata: {
            tool: 'hyperliquid_opt_in',
            wallet: payload.managedWalletPublicKey || null,
          },
          authHeaders: headers,
        },
      );

      if (!response.ok) {
        const message =
          (json && (json.error || json.message)) ||
          text ||
          `hyperliquid_opt_in_failed:${response.status}`;
        throw new Error(String(message));
      }

      return {
        structuredContent: json,
        content: [{ type: 'text', text: JSON.stringify(json) }],
      };
    },
  );

  server.registerTool(
    'hyperliquid_perp_trade',
    {
      title: 'Hyperliquid Perp Trade',
      description: 'Submit a Hyperliquid perpetual order through a Dexter-managed wallet.',
      _meta: {
        category: 'hyperliquid',
        access: 'pro',
        tags: ['hyperliquid', 'perps', 'trade', 'x402'],
        promptSlug: 'agent.concierge.tool.hyperliquid_perp_trade',
      },
      inputSchema: perpTradeSchema,
    },
    async (input = {}, extra = {}) => {
      const payload = perpTradeSchema.parse(input);
      const authHeader = extractAuthorization(extra);

      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      };

      const { response, json, text } = await fetchWithX402Json(
        `${base}/hyperliquid/perp-trade`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
        {
          metadata: {
            tool: 'hyperliquid_perp_trade',
            symbol: payload.hyperliquidSymbol,
            side: payload.side,
          },
          authHeaders: headers,
        },
      );

      if (!response.ok) {
        const message =
          (json && (json.error || json.message)) ||
          text ||
          `hyperliquid_perp_trade_failed:${response.status}`;
        throw new Error(String(message));
      }

      return {
        structuredContent: json,
        content: [{ type: 'text', text: JSON.stringify(json) }],
      };
    },
  );
}
