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

function getSupabaseBearer(extra) {
  const headers = headersFromExtra(extra);
  const auth = headers?.authorization || headers?.Authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const fallback = headers?.['x-authorization'] || headers?.['X-Authorization'];
  if (typeof fallback === 'string' && fallback.startsWith('Bearer ')) {
    return fallback.slice(7).trim();
  }
  const envToken = process.env.MCP_SUPABASE_BEARER;
  return envToken ? String(envToken) : null;
}

async function apiFetch(path, init, extra) {
  const base = (process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  const token = getSupabaseBearer(extra);
  const headers = Object.assign({}, init?.headers || {}, token ? { Authorization: `Bearer ${token}` } : {});
  const url = buildApiUrl(base, path);
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    let payload = text;
    try {
      payload = JSON.parse(text);
    } catch {}
    throw new Error(payload?.error || payload?.message || `request_failed:${response.status}`);
  }
  return text ? JSON.parse(text) : {};
}

export function registerSolanaToolset(server) {
  server.registerTool('solana_resolve_token', {
    title: 'Resolve Solana Token',
    description: 'Resolve token metadata using DexScreener heuristics.',
    _meta: {
      category: 'solana.trading',
      access: 'free',
      tags: ['token', 'lookup']
    },
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(10).optional(),
    },
  }, async ({ query, limit }, extra) => {
    const result = await apiFetch(`/api/solana/resolve-token?q=${encodeURIComponent(query)}${limit ? `&limit=${limit}` : ''}`, { method: 'GET' }, extra);
    return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result.results || []) }] };
  });

  server.registerTool('solana_list_balances', {
    title: 'List Token Balances',
    description: 'List SPL token balances for a managed wallet.',
    _meta: {
      category: 'solana.portfolio',
      access: 'managed',
      tags: ['balances', 'spl']
    },
    inputSchema: {
      wallet_address: z.string(),
      min_ui: z.number().optional(),
      limit: z.number().int().optional(),
    },
  }, async ({ wallet_address, min_ui, limit }, extra) => {
    if (!wallet_address) {
      return { content: [{ type: 'text', text: 'wallet_address_required' }], isError: true };
    }
    const params = new URLSearchParams({ walletAddress: wallet_address });
    if (min_ui != null) params.set('minUi', String(min_ui));
    if (limit != null) params.set('limit', String(limit));
    const result = await apiFetch(`/api/solana/balances?${params.toString()}`, { method: 'GET' }, extra);
    return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result.balances || []) }] };
  });

  server.registerTool('solana_preview_sell_all', {
    title: 'Preview Sell All',
    description: 'Preview SOL received when selling the full token balance.',
    _meta: {
      category: 'solana.trading',
      access: 'managed',
      tags: ['sell', 'preview']
    },
    inputSchema: {
      wallet_address: z.string().optional(),
      mint: z.string(),
      slippage_bps: z.number().int().optional(),
    },
  }, async ({ wallet_address, mint, slippage_bps }, extra) => {
    const params = new URLSearchParams({ mint });
    if (wallet_address) params.set('walletAddress', wallet_address);
    if (slippage_bps != null) params.set('slippageBps', String(slippage_bps));
    const result = await apiFetch(`/api/solana/preview-sell?${params.toString()}`, { method: 'GET' }, extra);
    return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result.result || {}) }] };
  });

  server.registerTool('solana_execute_buy', {
    title: 'Execute Buy',
    description: 'Buy a token using SOL from a managed wallet.',
    _meta: {
      category: 'solana.trading',
      access: 'managed',
      tags: ['buy', 'execution']
    },
    inputSchema: {
      wallet_address: z.string().optional(),
      mint: z.string(),
      amount_sol: z.number().positive(),
      slippage_bps: z.number().int().optional(),
    },
  }, async ({ wallet_address, mint, amount_sol, slippage_bps }, extra) => {
    const body = {
      walletAddress: wallet_address ?? null,
      mint,
      amountSol: amount_sol,
      slippageBps: slippage_bps ?? undefined,
    };
    const result = await apiFetch('/api/solana/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, extra);
    return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result.result || {}) }] };
  });

  server.registerTool('solana_execute_sell', {
    title: 'Execute Sell',
    description: 'Sell a token for SOL from a managed wallet.',
    _meta: {
      category: 'solana.trading',
      access: 'managed',
      tags: ['sell', 'execution']
    },
    inputSchema: {
      wallet_address: z.string().optional(),
      mint: z.string(),
      amount_raw: z.string().optional(),
      percentage: z.number().min(1).max(100).optional(),
      slippage_bps: z.number().int().optional(),
    },
  }, async ({ wallet_address, mint, amount_raw, percentage, slippage_bps }, extra) => {
    const body = {
      walletAddress: wallet_address ?? null,
      mint,
      amountRaw: amount_raw ?? undefined,
      percentage: percentage ?? undefined,
      slippageBps: slippage_bps ?? undefined,
    };
    const result = await apiFetch('/api/solana/sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, extra);
    return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result.result || {}) }] };
  });
}
