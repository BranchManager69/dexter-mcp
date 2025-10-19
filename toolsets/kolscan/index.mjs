import { z } from 'zod';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || 'http://localhost:3030';

function buildApiUrl(base, path) {
  const normalizedBase = (base || '').replace(/\/+$/, '');
  if (!path) return normalizedBase || '';
  let normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedBase.endsWith('/api')) {
    if (normalizedPath === '/api') {
      normalizedPath = '';
    } else if (normalizedPath.startsWith('/api/')) {
      normalizedPath = normalizedPath.slice(4);
    }
  }
  return `${normalizedBase}${normalizedPath}` || normalizedPath;
}

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

function resolveAuthToken(extra) {
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

async function fetchKolscan(path, extra, init = {}) {
  const base = (process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  const url = buildApiUrl(base, path);
  const headers = Object.assign({ Accept: 'application/json' }, init.headers || {});
  const token = resolveAuthToken(extra);
  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const requestInit = {
    method: init.method || 'GET',
    headers,
    body: init.body,
  };

  const response = await fetch(url, requestInit);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error('kolscan_invalid_json');
    }
  } else {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || `kolscan_request_failed:${response.status}`;
    throw new Error(message);
  }

  return payload;
}

const LeaderboardInputSchema = z
  .object({
    timeframe: z.union([z.string(), z.number()]).optional(),
    minProfit: z.number().optional(),
    maxProfit: z.number().optional(),
    minWins: z.number().optional(),
    maxWins: z.number().optional(),
    minLosses: z.number().optional(),
    maxLosses: z.number().optional(),
    requireTwitter: z.boolean().optional(),
    requireTelegram: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
    sortBy: z.enum(['profit', 'wins', 'losses', 'name']).optional(),
    direction: z.enum(['asc', 'desc']).optional(),
    format: z.enum(['full', 'stats', 'handles']).optional(),
  })
  .passthrough();

const ResolveInputSchema = z.object({
  query: z.string().min(1, 'query_required'),
  limit: z.number().int().min(1).max(50).optional(),
});

const WalletDetailInputSchema = z.object({
  walletAddress: z.string().min(1, 'wallet_address_required'),
  timeframe: z.union([z.string(), z.number()]).optional(),
  format: z.enum(['summary', 'trades', 'full']).optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});

const TrendingInputSchema = z.object({
  timeframe: z.union([z.string(), z.number()]).optional(),
  minKols: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  txLimit: z.number().int().min(1).max(10000).optional(),
  wallets: z.union([z.string(), z.array(z.string())]).optional(),
});

const TokenDetailInputSchema = z.object({
  tokenAddress: z.string().min(1, 'token_address_required'),
  timeframe: z.union([z.string(), z.number()]).optional(),
  format: z.enum(['summary', 'trades', 'full']).optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});

function toSearchParams(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      search.set(key, value.join(','));
      continue;
    }
    if (typeof value === 'boolean') {
      search.set(key, value ? 'true' : 'false');
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function summarizeLeaderboard(payload) {
  if (!payload || payload.ok === false) {
    return { error: payload?.error || 'kolscan_leaderboard_failed' };
  }
  const timeframe = payload.timeframe || payload.timeframeLabel || null;
  const top = Array.isArray(payload.data)
    ? payload.data.slice(0, 5).map((entry) => ({
        rank: entry.rank,
        name: entry.name || null,
        walletAddress: entry.walletAddress,
        profit: entry.profit ?? null,
        wins: entry.wins ?? null,
        losses: entry.losses ?? null,
        twitter: entry.twitter || null,
      }))
    : [];
  return {
    timeframe,
    count: payload.count ?? top.length,
    top,
  };
}

function summarizeResolve(payload) {
  if (!payload || payload.ok === false) {
    return { error: payload?.error || 'kolscan_resolve_failed' };
  }
  const matches = Array.isArray(payload.data)
    ? payload.data.map((entry) => ({
        walletAddress: entry.walletAddress,
        name: entry.name || null,
        twitter: entry.twitter || null,
        telegram: entry.telegram || null,
        score: entry.score ?? null,
      }))
    : [];
  return {
    query: payload.query || null,
    count: payload.count ?? matches.length,
    matches: matches.slice(0, 10),
  };
}

function summarizeWalletDetail(payload) {
  if (!payload || payload.ok === false) {
    return { error: payload?.error || 'kolscan_wallet_failed' };
  }
  const summary = payload.summary || {};
  const meta = payload.meta || {};
  const tokens = Array.isArray(summary.tokens)
    ? summary.tokens.slice(0, 5).map((token) => ({
        tokenAddress: token.tokenAddress,
        symbol: token.symbol || null,
        buySol: token.buySol ?? null,
        sellSol: token.sellSol ?? null,
        netSol: (token.sellSol ?? 0) - (token.buySol ?? 0),
      }))
    : [];
  const trades = Array.isArray(payload.trades)
    ? payload.trades.slice(0, 5).map((trade) => ({
        walletAddress: trade.wallet_address,
        name: trade.walletMetadata?.name || null,
        twitter: trade.walletMetadata?.twitter || null,
        direction: trade.spl_direction || null,
        solChange: trade.sol_change ?? null,
        timestamp: trade.timestamp ?? null,
      }))
    : [];
  return {
    walletAddress: payload.walletAddress,
    name: meta?.name || null,
    twitter: meta?.twitter || null,
    timeframe: summary.timeframeLabel || payload.timeframeLabel || null,
    tradeCount: summary.tradeCount ?? null,
    buySol: summary.buySol ?? null,
    sellSol: summary.sellSol ?? null,
    netSol: summary.netSol ?? null,
    truncated: summary.truncated ?? payload.truncated ?? false,
    tokens,
    sampleTrades: trades,
  };
}

function summarizeTrending(payload) {
  if (!payload || payload.ok === false) {
    return { error: payload?.error || 'kolscan_trending_failed' };
  }
  const tokens = Array.isArray(payload.tokens)
    ? payload.tokens.slice(0, 10).map((token) => ({
        tokenAddress: token.tokenAddress,
        symbol: token.symbol || null,
        kolCount: token.kolCount ?? null,
        totalBuySol: token.totalBuySol ?? null,
        totalSellSol: token.totalSellSol ?? null,
        sampleWallets: Array.isArray(token.sampleWalletDetails)
          ? token.sampleWalletDetails.map((wallet) => ({
              walletAddress: wallet.walletAddress,
              name: wallet.name || null,
              twitter: wallet.twitter || null,
            }))
          : [],
      }))
    : [];
  return {
    timeframe: payload.timeframeLabel || payload.timeframe || null,
    minKols: payload.minKols ?? null,
    limit: payload.limit ?? null,
    tokens,
    transactionsAnalyzed: payload.transactionsAnalyzed ?? null,
    truncated: payload.truncated ?? false,
  };
}

function summarizeTokenDetail(payload) {
  if (!payload || payload.ok === false) {
    return { error: payload?.error || 'kolscan_token_failed' };
  }
  const summary = payload.summary || {};
  const wallets = Array.isArray(summary.wallets)
    ? summary.wallets.slice(0, 5).map((wallet) => ({
        walletAddress: wallet.walletAddress,
        name: wallet.name || null,
        twitter: wallet.twitter || null,
        buySol: wallet.buySol ?? null,
        sellSol: wallet.sellSol ?? null,
        trades: wallet.trades ?? null,
      }))
    : [];
  const trades = Array.isArray(payload.trades)
    ? payload.trades.slice(0, 5).map((trade) => ({
        walletAddress: trade.wallet_address,
        name: trade.walletMetadata?.name || null,
        twitter: trade.walletMetadata?.twitter || null,
        direction: trade.spl_direction || null,
        solChange: trade.sol_change ?? null,
        timestamp: trade.timestamp ?? null,
      }))
    : [];
  return {
    tokenAddress: payload.tokenAddress,
    symbol: summary.symbol || null,
    tradeCount: summary.tradeCount ?? payload.count ?? null,
    uniqueWallets: summary.uniqueWallets ?? null,
    buySol: summary.buySol ?? null,
    sellSol: summary.sellSol ?? null,
    netSol: summary.netSol ?? null,
    timeframe: summary.timeframeLabel || payload.timeframeLabel || null,
    truncated: summary.truncated ?? payload.truncated ?? false,
    wallets,
    sampleTrades: trades,
  };
}

function handleError(error) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: error?.message || error || 'kolscan_request_failed' }) }],
    isError: true,
  };
}

export function registerKolscanToolset(server) {
  server.registerTool(
    'kolscan_leaderboard',
    {
      title: 'Fetch Kolscan Leaderboard',
      description: 'Fetch Kolscan leaderboard rankings with optional filters (timeframe, profit bounds, social requirements).',
      _meta: {
        category: 'kolscan.analytics',
        access: 'public',
        tags: ['kolscan', 'leaderboard', 'analytics'],
      },
      inputSchema: LeaderboardInputSchema.shape,
    },
    async (args = {}, extra) => {
      let parsed;
      try {
        parsed = LeaderboardInputSchema.parse(args);
      } catch (error) {
        return handleError(error);
      }
      const query = toSearchParams(parsed);
      try {
        const payload = await fetchKolscan(`/api/kolscan/leaderboard${query}`, extra);
        const summary = summarizeLeaderboard(payload);
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(summary) }],
        };
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.registerTool(
    'kolscan_resolve_wallet',
    {
      title: 'Resolve Kolscan Wallet Handle',
      description: 'Resolve Kolscan handles or social aliases to wallet metadata.',
      _meta: {
        category: 'kolscan.lookup',
        access: 'public',
        tags: ['kolscan', 'wallet', 'lookup'],
      },
      inputSchema: ResolveInputSchema.shape,
    },
    async (args = {}, extra) => {
      let parsed;
      try {
        parsed = ResolveInputSchema.parse(args);
      } catch (error) {
        return handleError(error);
      }
      const query = toSearchParams(parsed);
      try {
        const payload = await fetchKolscan(`/api/kolscan/resolve${query}`, extra);
        const summary = summarizeResolve(payload);
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(summary) }],
        };
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.registerTool(
    'kolscan_wallet_detail',
    {
      title: 'Fetch Kolscan Wallet Detail',
      description: 'Return Kolscan wallet summary metrics and optional trade history for a selected timeframe.',
      _meta: {
        category: 'kolscan.analytics',
        access: 'public',
        tags: ['kolscan', 'wallet', 'summary'],
      },
      inputSchema: WalletDetailInputSchema.shape,
    },
    async (args = {}, extra) => {
      let parsed;
      try {
        parsed = WalletDetailInputSchema.parse(args);
      } catch (error) {
        return handleError(error);
      }
      const { walletAddress, ...rest } = parsed;
      const query = toSearchParams(rest);
      try {
        const payload = await fetchKolscan(`/api/kolscan/wallet/${encodeURIComponent(walletAddress)}${query}`, extra);
        const summary = summarizeWalletDetail(payload);
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(summary) }],
        };
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.registerTool(
    'kolscan_trending_tokens',
    {
      title: 'Fetch Trending Kolscan Tokens',
      description: 'Aggregate trending tokens across Kolscan KOL activity for a timeframe.',
      _meta: {
        category: 'kolscan.analytics',
        access: 'public',
        tags: ['kolscan', 'tokens', 'trending'],
      },
      inputSchema: TrendingInputSchema.shape,
    },
    async (args = {}, extra) => {
      let parsed;
      try {
        parsed = TrendingInputSchema.parse(args);
      } catch (error) {
        return handleError(error);
      }
      const normalized = { ...parsed };
      if (Array.isArray(normalized.wallets)) {
        normalized.wallets = normalized.wallets.filter((value) => typeof value === 'string' && value.trim().length).join(',');
      }
      const query = toSearchParams(normalized);
      try {
        const payload = await fetchKolscan(`/api/kolscan/trending${query}`, extra);
        const summary = summarizeTrending(payload);
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(summary) }],
        };
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.registerTool(
    'kolscan_token_detail',
    {
      title: 'Fetch Kolscan Token Detail',
      description: 'Summarize KOL activity for a specific token, including per-wallet breakdowns.',
      _meta: {
        category: 'kolscan.analytics',
        access: 'public',
        tags: ['kolscan', 'token', 'summary'],
      },
      inputSchema: TokenDetailInputSchema.shape,
    },
    async (args = {}, extra) => {
      let parsed;
      try {
        parsed = TokenDetailInputSchema.parse(args);
      } catch (error) {
        return handleError(error);
      }
      const { tokenAddress, ...rest } = parsed;
      const query = toSearchParams(rest);
      try {
        const payload = await fetchKolscan(`/api/kolscan/token/${encodeURIComponent(tokenAddress)}${query}`, extra);
        const summary = summarizeTokenDetail(payload);
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(summary) }],
        };
      } catch (error) {
        return handleError(error);
      }
    },
  );
}

export default { registerKolscanToolset };
