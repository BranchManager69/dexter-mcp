import { z } from 'zod';

const DEFAULT_API_BASE_URL =
  process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || 'http://localhost:3030';

function buildApiUrl(pathname) {
  const base = (DEFAULT_API_BASE_URL || '').replace(/\/+$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

function resolveAuthToken(extra) {
  const headerSources = [
    extra?.requestInfo?.headers,
    extra?.httpRequest?.headers,
    extra?.request?.headers,
  ].filter(Boolean);

  for (const headers of headerSources) {
    const token =
      headers?.authorization ||
      headers?.Authorization ||
      headers?.['x-user-token'] ||
      headers?.['X-User-Token'];
    if (typeof token === 'string' && token.trim()) {
      if (token.startsWith('Bearer ')) {
        return token.slice(7).trim();
      }
      return token.trim();
    }
  }

  const fallback = String(process.env.MCP_SUPABASE_BEARER || '').trim();
  return fallback || null;
}

async function fetchOnchain(path, extra, init = {}) {
  const url = buildApiUrl(path);
  const headers = Object.assign({ Accept: 'application/json' }, init.headers || {});
  const token = resolveAuthToken(extra);
  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: init.method || 'GET',
    headers,
    body: init.body,
  });

  const text = await response.text();
  let payload;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error('onchain_invalid_json');
    }
  } else {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || `onchain_error:${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function toSearchParams(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean') {
      search.set(key, value ? 'true' : 'false');
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

const SharedFilterSchema = z.object({
  mint: z.string().min(2, 'mint_required').optional(),
  wallet: z.string().min(10, 'wallet_required').optional(),
  timeframe: z.union([z.string(), z.number()]).optional(),
  limit: z.number().int().min(1).max(25).optional(),
  includeRaw: z.boolean().optional(),
});

const ActivityBaseSchema = z
  .object({
    scope: z.enum(['token', 'wallet']).optional().default('token'),
  })
  .merge(SharedFilterSchema);

const ActivityInputSchema = ActivityBaseSchema.superRefine((value, ctx) => {
  if (value.scope === 'token' && !value.mint) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'mint_required',
      path: ['mint'],
    });
  }
  if (value.scope === 'wallet') {
    if (!value.mint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mint_required',
        path: ['mint'],
      });
    }
    if (!value.wallet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'wallet_required',
        path: ['wallet'],
      });
    }
  }
});

const EntityBaseSchema = z
  .object({
    scope: z.enum(['token', 'wallet', 'trade']).optional().default('token'),
    signature: z.string().min(10, 'signature_required').optional(),
  })
  .merge(SharedFilterSchema);

const EntityInputSchema = EntityBaseSchema.superRefine((value, ctx) => {
  if (value.scope === 'trade' && !value.signature) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'signature_required',
      path: ['signature'],
    });
  }
  if ((value.scope === 'token' || value.scope === 'wallet') && !value.mint) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'mint_required',
      path: ['mint'],
    });
  }
  if (value.scope === 'wallet' && !value.wallet) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'wallet_required',
      path: ['wallet'],
    });
  }
});

function summarizeTokenActivity(summary) {
  if (!summary || typeof summary !== 'object') return 'token_activity_unavailable';
  const timeframeMinutes = Math.round((summary.timeframeSeconds || 0) / 60);
  const headline = [
    `Trades: ${summary.tradeCount ?? 0}`,
    `Buy SOL: ${(summary.buyVolumeSol ?? 0).toFixed?.(3) || summary.buyVolumeSol}`,
    `Sell SOL: ${(summary.sellVolumeSol ?? 0).toFixed?.(3) || summary.sellVolumeSol}`,
    `Net SOL: ${(summary.netFlowSol ?? 0).toFixed?.(3) || summary.netFlowSol}`,
  ].join(' | ');
  const topBuyer = summary.topNetBuyers?.[0]?.wallet;
  const topSeller = summary.topNetSellers?.[0]?.wallet;
  const badges = [
    timeframeMinutes ? `${timeframeMinutes}m window` : null,
    topBuyer ? `Top buyer: ${topBuyer}` : null,
    topSeller ? `Top seller: ${topSeller}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `${headline}${badges ? ` (${badges})` : ''}`;
}

function summarizeWalletActivity(summary) {
  if (!summary || typeof summary !== 'object') return 'wallet_activity_unavailable';
  return [
    `Trades: ${summary.tradeCount ?? 0}`,
    `Buys: ${(summary.buyVolumeSol ?? 0).toFixed?.(3) || summary.buyVolumeSol} SOL`,
    `Sells: ${(summary.sellVolumeSol ?? 0).toFixed?.(3) || summary.sellVolumeSol} SOL`,
    `Net: ${(summary.netSol ?? 0).toFixed?.(3) || summary.netSol} SOL`,
  ].join(' | ');
}

function summarizeTradeInsight(summary) {
  if (!summary || typeof summary !== 'object') return 'trade_insight_unavailable';
  const tokenCount = Array.isArray(summary.tokenBalanceDeltas) ? summary.tokenBalanceDeltas.length : 0;
  return `Slot ${summary.slot ?? 'n/a'} · Balances ${tokenCount}`;
}

function wrapResult(payload, textSummary) {
  return {
    structuredContent: payload,
    content: [
      {
        type: 'text',
        text: typeof textSummary === 'string' ? textSummary : JSON.stringify(textSummary),
      },
    ],
  };
}

function normaliseArgs(args = {}) {
  const copy = { ...args };
  if (copy.timeframe && typeof copy.timeframe === 'string') {
    copy.timeframe = copy.timeframe.trim();
  }
  if (copy.mint && typeof copy.mint === 'string') {
    copy.mint = copy.mint.trim();
  }
  if (copy.wallet && typeof copy.wallet === 'string') {
    copy.wallet = copy.wallet.trim();
  }
  return copy;
}

export function registerOnchainToolset(server) {
  server.registerTool(
    'onchain_activity_overview',
    {
      title: 'On-chain Activity Overview',
      description:
        'Summarize on-chain swap activity for a token or wallet over a timeframe. Requires token mint; wallet scope adds wallet address.',
      _meta: {
        category: 'onchain.analytics',
        access: 'public',
        tags: ['onchain', 'dexter', 'analytics'],
      },
      inputSchema: ActivityBaseSchema.shape,
    },
    async (input = {}, extra) => {
      let parsed;
      try {
        parsed = ActivityInputSchema.parse(normaliseArgs(input));
      } catch (error) {
        return wrapResult({ ok: false, error: error?.message || 'invalid_arguments' }, error);
      }

      const query = toSearchParams(parsed);
      const scopePath = parsed.scope === 'wallet' ? '/onchain/activity?scope=wallet' : '/onchain/activity';
      try {
        const payload = await fetchOnchain(`${scopePath}${query}`, extra);
        if (payload?.scope === 'wallet') {
          return wrapResult(payload, summarizeWalletActivity(payload?.summary));
        }
        return wrapResult(payload, summarizeTokenActivity(payload?.summary));
      } catch (error) {
        return wrapResult({ ok: false, error: error?.message || 'onchain_activity_failed' }, error);
      }
    },
  );

  server.registerTool(
    'onchain_entity_insight',
    {
      title: 'On-chain Entity Insight',
      description:
        'Deep dive on a wallet, token, or specific transaction signature. Use scope=trade with a signature for transaction deltas.',
      _meta: {
        category: 'onchain.analytics',
        access: 'public',
        tags: ['onchain', 'insight', 'dexter'],
      },
      inputSchema: EntityBaseSchema.shape,
    },
    async (input = {}, extra) => {
      let parsed;
      try {
        parsed = EntityInputSchema.parse(normaliseArgs(input));
      } catch (error) {
        return wrapResult({ ok: false, error: error?.message || 'invalid_arguments' }, error);
      }

      const query = toSearchParams({
        scope: parsed.scope,
        mint: parsed.mint,
        wallet: parsed.wallet,
        timeframe: parsed.timeframe,
        limit: parsed.limit,
        signature: parsed.signature,
      });

      try {
        const payload = await fetchOnchain(`/onchain/entity${query}`, extra);
        if (payload?.scope === 'trade') {
          return wrapResult(payload, summarizeTradeInsight(payload?.summary));
        }
        if (payload?.scope === 'wallet') {
          return wrapResult(payload, summarizeWalletActivity(payload?.summary));
        }
        return wrapResult(payload, summarizeTokenActivity(payload?.summary));
      } catch (error) {
        return wrapResult({ ok: false, error: error?.message || 'onchain_entity_failed' }, error);
      }
    },
  );
}
