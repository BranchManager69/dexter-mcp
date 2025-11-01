import { z } from 'zod';

import { fetchWithX402Json } from '../../clients/x402Client.mjs';
import { resolveWalletForRequest } from '../wallet/index.mjs';

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
    const token = auth.slice(7).trim();
    if (token && token !== process.env.TOKEN_AI_MCP_TOKEN) {
      return token;
    }
  }
  const fallback = headers?.['x-authorization'] || headers?.['X-Authorization'];
  if (typeof fallback === 'string' && fallback.startsWith('Bearer ')) {
    const token = fallback.slice(7).trim();
    if (token && token !== process.env.TOKEN_AI_MCP_TOKEN) {
      return token;
    }
  }
  const envToken = process.env.MCP_SUPABASE_BEARER;
  return envToken ? String(envToken) : null;
}

async function apiFetch(path, init, extra) {
  const base = (process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  const token = getSupabaseBearer(extra);
  const headers = Object.assign(
    {
      Accept: 'application/json',
    },
    init?.headers || {},
    token ? { Authorization: `Bearer ${token}` } : {},
  );
  const url = buildApiUrl(base, path);
  const { response, json, text } = await fetchWithX402Json(
    url,
    { ...init, headers },
    {
      metadata: { toolset: 'solana', path },
      authHeaders: headers,
    },
  );
  if (!response.ok) {
    let payload = json;
    if (!payload && text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    throw new Error(
      payload?.error || payload?.message || `request_failed:${response.status}`,
    );
  }
  return json ?? {};
}

export function registerSolanaToolset(server) {
  function normaliseTokenResult(result) {
    if (!result || typeof result !== 'object') return null;
    const info = result.info || {};
    const pairs = Array.isArray(result.pairs) ? result.pairs : [];
    const primaryPair = pairs.find((pair) => pair?.url) || pairs[0] || null;
    const socials = Array.isArray(info.socials) ? info.socials : [];
    const websites = Array.isArray(info.websites) ? info.websites : [];

    const priceChange = result.priceChange || {};
    const jupiter = result.extensions && result.extensions.jupiter ? result.extensions.jupiter : null;

    const resolvedPriceUsd =
      (jupiter && typeof jupiter.usdPrice === 'number' ? jupiter.usdPrice : null) ??
      (typeof result.priceUsd === 'number' ? result.priceUsd : null) ??
      (primaryPair && typeof primaryPair.priceUsd === 'number' ? primaryPair.priceUsd : null);

    const resolvedLiquidityUsd =
      (jupiter && typeof jupiter.liquidityUsd === 'number' ? jupiter.liquidityUsd : null) ??
      (typeof result.liquidityUsd === 'number' ? result.liquidityUsd : null) ??
      (primaryPair && primaryPair.liquidity && typeof primaryPair.liquidity.usd === 'number'
        ? primaryPair.liquidity.usd
        : null);

    return {
      address: result.address || result.mintAddress || result.mint || null,
      name: result.name || null,
      symbol: result.symbol || null,
      category: result.category || result.tokenType || null,
      decimals: result.decimals ?? null,
      liquidityUsd: resolvedLiquidityUsd,
      fdvUsd: result.fdv ?? result.fdvUsd ?? result.marketCap ?? null,
      priceUsd: resolvedPriceUsd,
      priceChange24hPct: priceChange.h24 ?? result.priceChange24h ?? null,
      volume24hUsd: result.volume24hUsd ?? primaryPair?.volume?.h24 ?? null,
      logoUri: info.imageUrl || info.logo || primaryPair?.info?.imageUrl || null,
      websiteUrl: websites.find((site) => site?.url)?.url || null,
      twitterUrl: socials.find((social) => social?.type === 'twitter')?.url || null,
      pairUrl: primaryPair?.url || null,
      organicScore: jupiter && typeof jupiter.organicScore === 'number' ? jupiter.organicScore : null,
      organicScoreLabel: jupiter?.organicScoreLabel ?? null,
      isVerified: jupiter?.isVerified ?? null,
      jupiterTags: jupiter?.tags ?? null,
      audit: jupiter?.audit ?? null,
      raw: result,
    };
  }

  server.registerTool('solana_resolve_token', {
    title: 'Resolve Solana Token',
    description: 'Resolve token metadata using Dexter\'s token lookup heuristics.',
    _meta: {
      category: 'solana.trading',
      access: 'free',
      tags: ['token', 'lookup'],
      'openai/outputTemplate': 'openai://app-assets/dexter-mcp/solana-token-lookup',
    },
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(10).optional(),
    },
  }, async ({ query, limit }, extra) => {
    try {
      const result = await apiFetch(`/api/solana/resolve-token?q=${encodeURIComponent(query)}${limit ? `&limit=${limit}` : ''}`, { method: 'GET' }, extra);
      const mapped = Array.isArray(result?.results) ? result.results.map((token) => normaliseTokenResult(token)).filter(Boolean) : [];
      const structured = {
        query,
        limit: limit ?? null,
        results: mapped,
        raw: result,
      };
      return {
        structuredContent: structured,
        content: [{ type: 'text', text: JSON.stringify(mapped) }],
        status: structured.results.length ? 'completed' : 'in_progress',
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'token_lookup_failed', message: error?.message || String(error) }) }],
        status: 'failed',
        isError: true,
      };
    }
  });

  server.registerTool('solana_list_balances', {
    title: 'List Token Balances',
    description: 'List a wallet\'s SOL and SPL token balances.',
    _meta: {
      category: 'solana.portfolio',
      access: 'managed',
      tags: ['balances', 'spl']
    },
    inputSchema: {
      wallet_address: z.string().optional(),
      min_ui: z.number().optional(),
      limit: z.number().int().optional(),
    },
  }, async ({ wallet_address, min_ui, limit }, extra) => {
    let targetWallet = wallet_address ? String(wallet_address).trim() : '';
    if (!targetWallet) {
      try {
        const resolved = await resolveWalletForRequest(extra);
        if (resolved?.wallet_address) {
          targetWallet = String(resolved.wallet_address);
        }
      } catch {}
    }

    if (!targetWallet) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'wallet_address_required' }) }],
        isError: true,
      };
    }

    const params = new URLSearchParams({ walletAddress: targetWallet });
    if (min_ui != null) params.set('minUi', String(min_ui));
    if (limit != null) params.set('limit', String(limit));
    const result = await apiFetch(`/api/solana/balances?${params.toString()}`, { method: 'GET' }, extra);
    return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result.balances || []) }] };
  });

  const swapInputShape = z.object({
    input_mint: z.string().min(1),
    output_mint: z.string().min(1),
    amount_ui: z.union([z.string(), z.number()]).nullable().optional(),
    wallet_address: z.string().min(1).optional(),
    slippage_bps: z.number().int().optional(),
    mode: z.enum(['ExactIn', 'ExactOut']),
    desired_output_ui: z.union([z.string(), z.number()]).nullable().optional(),
  });

  const swapInputSchema = swapInputShape.superRefine((value, ctx) => {
    if (value.mode === 'ExactIn' && (value.amount_ui == null || value.amount_ui === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount_ui is required for ExactIn swaps.' });
    }
    if (value.mode === 'ExactOut' && (value.desired_output_ui == null || value.desired_output_ui === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'desired_output_ui is required for ExactOut swaps.' });
    }
  });

  server.registerTool('solana_swap_preview', {
    title: 'Preview Solana Swap',
    description: 'Preview a SOL-token swap using UI-denominated amounts before execution.',
    _meta: {
      category: 'solana.trading',
      access: 'managed',
      tags: ['swap', 'preview'],
      'openai/outputTemplate': 'openai://app-assets/dexter-mcp/solana-swap-preview',
    },
    inputSchema: swapInputShape,
  }, async (input, extra) => {
    const { input_mint, output_mint, amount_ui, wallet_address, slippage_bps, mode, desired_output_ui } = swapInputSchema.parse(input);
    const body = {
      inputMint: input_mint,
      outputMint: output_mint,
      amountUi: amount_ui,
      ...(wallet_address ? { walletAddress: wallet_address } : {}),
      ...(slippage_bps != null ? { slippageBps: slippage_bps } : {}),
      ...(mode ? { mode } : {}),
      ...(desired_output_ui != null ? { desiredOutputUi: desired_output_ui } : {}),
    };
    try {
      const result = await apiFetch('/api/solana/swap/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, extra);
      const structured = {
        request: body,
        result,
      };
      return {
        structuredContent: structured,
        content: [{ type: 'text', text: JSON.stringify(result.result || result || {}) }],
        status: 'completed',
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'swap_preview_failed', message: error?.message || String(error) }) }],
        status: 'failed',
        isError: true,
      };
    }
  });

  server.registerTool('solana_swap_execute', {
    title: 'Execute Solana Swap',
    description: 'Execute a SOL-token swap after previewing the expected output.',
    _meta: {
      category: 'solana.trading',
      access: 'managed',
      tags: ['swap', 'execution'],
      'openai/outputTemplate': 'openai://app-assets/dexter-mcp/solana-swap-execute',
    },
    inputSchema: swapInputShape,
  }, async (input, extra) => {
    const { input_mint, output_mint, amount_ui, wallet_address, slippage_bps, mode, desired_output_ui } = swapInputSchema.parse(input);
    const body = {
      inputMint: input_mint,
      outputMint: output_mint,
      amountUi: amount_ui,
      ...(wallet_address ? { walletAddress: wallet_address } : {}),
      ...(slippage_bps != null ? { slippageBps: slippage_bps } : {}),
      ...(mode ? { mode } : {}),
      ...(desired_output_ui != null ? { desiredOutputUi: desired_output_ui } : {}),
    };
    try {
      const result = await apiFetch('/api/solana/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, extra);
      const structured = {
        request: body,
        result,
      };
      return {
        structuredContent: structured,
        content: [{ type: 'text', text: JSON.stringify(result.result || result || {}) }],
        status: 'completed',
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'swap_execute_failed', message: error?.message || String(error) }) }],
        status: 'failed',
        isError: true,
      };
    }
  });
}
