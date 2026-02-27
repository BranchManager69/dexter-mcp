/**
 * x402-client toolset — user-facing search & pay for any x402 resource
 *
 * Authenticated counterpart to open-mcp x402 tools.
 *
 * x402_search: Discover paid APIs in the Dexter marketplace.
 * x402_pay:    Call any x402-enabled endpoint with automatic payment
 *              settlement via the Dexter facilitator (authenticated users).
 * x402_fetch:  Same as x402_pay but normalized to fetch-result widget schema.
 * x402_check:  Probe endpoint pricing without payment.
 * x402_wallet: Show active authenticated wallet + SOL/USDC balances.
 */

import { z } from 'zod';
import { fetchWithX402Json } from '../../clients/x402Client.mjs';
import { createWidgetMeta } from '../widgetMeta.mjs';
import { resolveWalletForRequest } from '../wallet/index.mjs';

const DEXTER_API = (
  process.env.X402_API_URL ||
  'https://x402.dexter.cash'
).replace(/\/+$/, '');

const MARKETPLACE_PATH = '/api/facilitator/marketplace/resources';

const SEARCH_META = createWidgetMeta({
  templateUri: 'ui://dexter/x402-marketplace-search',
  widgetDescription: 'Shows paid API search results as interactive cards with prices and fetch actions.',
  invoking: 'Searching marketplace...',
  invoked: 'Results ready',
  extra: {
    ui: { resourceUri: 'ui://dexter/x402-marketplace-search', visibility: ['model', 'app'] },
  },
});

const FETCH_META = createWidgetMeta({
  templateUri: 'ui://dexter/x402-fetch-result',
  widgetDescription: 'Shows API response data with payment details and settlement status.',
  invoking: 'Calling API...',
  invoked: 'Response received',
  resourceDomains: ['https://api.qrserver.com', 'https://cdn.jsdelivr.net'],
  extra: {
    ui: { resourceUri: 'ui://dexter/x402-fetch-result', visibility: ['model', 'app'] },
  },
});

const CHECK_META = createWidgetMeta({
  templateUri: 'ui://dexter/x402-pricing',
  widgetDescription: 'Shows endpoint pricing options and chain-level payment details.',
  invoking: 'Checking pricing...',
  invoked: 'Pricing loaded',
  resourceDomains: ['https://cdn.jsdelivr.net'],
  extra: {
    ui: { resourceUri: 'ui://dexter/x402-pricing', visibility: ['model', 'app'] },
  },
});

const WALLET_META = createWidgetMeta({
  templateUri: 'ui://dexter/x402-wallet',
  widgetDescription: 'Shows active wallet address, balances, and deposit QR.',
  invoking: 'Loading wallet...',
  invoked: 'Wallet loaded',
  resourceDomains: ['https://api.qrserver.com', 'https://cdn.jsdelivr.net'],
  extra: {
    ui: { resourceUri: 'ui://dexter/x402-wallet', visibility: ['model', 'app'] },
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
      return token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    }
  }
  return process.env.MCP_SUPABASE_BEARER?.trim() || null;
}

function formatPrice(resource) {
  if (resource.priceLabel) return resource.priceLabel;
  if (resource.priceUsdc != null) return `$${Number(resource.priceUsdc).toFixed(2)}`;
  return 'free';
}

function formatResource(r) {
  return {
    name: r.displayName || r.resourceUrl,
    url: r.resourceUrl,
    method: r.method || 'GET',
    price: formatPrice(r),
    network: r.priceNetwork || null,
    description: r.description || '',
    category: r.category || 'uncategorized',
    qualityScore: r.qualityScore ?? null,
    verified: r.verificationStatus === 'pass',
    verificationNotes: r.verificationNotes || null,
    totalCalls: r.totalSettlements ?? 0,
    totalVolume: r.totalVolumeUsdc != null ? `$${Number(r.totalVolumeUsdc).toLocaleString()}` : null,
    seller: r.seller?.displayName || null,
    sellerReputation: r.reputationScore ?? null,
    lastActive: r.lastSettlementAt || null,
    authRequired: Boolean(r.authRequired),
    authType: r.authType || null,
    authHint: r.authHint || null,
  };
}

function parseResponseData(contentType, json, text) {
  if (json !== null && json !== undefined) return json;
  if (contentType.includes('application/json') && text) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  return text ?? null;
}

function normalizePaymentReceipt(paymentReceipt, response) {
  if (!paymentReceipt) return undefined;
  return {
    settled: Boolean(response?.ok),
    details: {
      success: Boolean(response?.ok),
      transaction:
        paymentReceipt?.response?.signature ||
        paymentReceipt?.response?.transactionSignature ||
        paymentReceipt?.response?.txHash ||
        null,
      network: paymentReceipt?.requirement?.network || null,
      payer: paymentReceipt?.walletAddress || null,
      requirements: {
        amount: String(
          paymentReceipt?.requirement?.maxAmountRequired ??
          paymentReceipt?.requirement?.amount ??
          ''
        ) || undefined,
        asset: paymentReceipt?.requirement?.asset || undefined,
        payTo: paymentReceipt?.requirement?.payTo || undefined,
        extra: paymentReceipt?.requirement?.extra || undefined,
      },
    },
  };
}

// ─── x402_search ─────────────────────────────────────────────────────────────

async function searchMarketplace({ query, category, maxPriceUsdc, network, verifiedOnly, sort, limit }) {
  const params = new URLSearchParams();
  if (query) params.set('search', query);
  if (category) params.set('category', category);
  if (maxPriceUsdc != null) params.set('maxPrice', String(maxPriceUsdc));
  if (network) params.set('network', network);
  if (verifiedOnly) params.set('verified', 'true');
  if (sort) params.set('sort', sort);
  params.set('order', 'desc');
  params.set('limit', String(Math.min(limit || 20, 50)));

  const url = `${DEXTER_API}${MARKETPLACE_PATH}?${params}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    throw new Error(`Marketplace returned ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  }

  const data = await res.json();
  return {
    resources: (data.resources || []).map(formatResource),
    total: data.resources?.length || 0,
  };
}

async function checkEndpointPricing({ url, method = 'GET' }) {
  const probe = await fetch(url, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: method !== 'GET' ? '{}' : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (probe.status !== 402) {
    if (probe.status === 401 || probe.status === 403) {
      const bodyText = await probe.text().catch(() => '');
      return {
        error: true,
        statusCode: probe.status,
        authRequired: true,
        message: bodyText || 'Provider authentication required before x402 payment flow.',
      };
    }
    if (probe.status >= 500) return { error: true, statusCode: probe.status, message: 'Server error' };
    if (probe.status >= 400) return { error: true, statusCode: probe.status, message: `Client error: ${probe.status}` };
    return { requiresPayment: false, statusCode: probe.status, free: true };
  }

  let body = null;
  try {
    body = await probe.json();
  } catch {}

  const accepts = body?.accepts;
  if (!Array.isArray(accepts) || !accepts.length) {
    return { requiresPayment: true, statusCode: 402, error: true, message: 'No payment options found' };
  }

  const paymentOptions = accepts.map((a) => {
    const amount = Number(a.amount || a.maxAmountRequired || 0);
    const decimals = Number(a.extra?.decimals ?? 6);
    const price = amount / Math.pow(10, decimals);
    return {
      price,
      priceFormatted: `$${price.toFixed(decimals > 2 ? 4 : 2)}`,
      network: a.network,
      scheme: a.scheme,
      asset: a.asset,
      payTo: a.payTo,
    };
  });

  return {
    requiresPayment: true,
    statusCode: 402,
    x402Version: body?.x402Version ?? 2,
    paymentOptions,
    resource: body?.resource || null,
  };
}

async function fetchWithSettlement({ url, method = 'GET', params, headers: customHeaders }, extra, normalizeForWidget = false) {
  const startTime = Date.now();
  const authToken = resolveAuthToken(extra);
  const requestHeaders = {
    Accept: 'application/json',
    ...(customHeaders || {}),
  };
  if (authToken) requestHeaders.Authorization = `Bearer ${authToken}`;

  let targetUrl = url;
  let body;
  if (method === 'GET' && params && typeof params === 'object') {
    const urlObj = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      if (value != null) urlObj.searchParams.set(key, String(value));
    }
    targetUrl = urlObj.toString();
  } else if (params != null) {
    body = typeof params === 'string' ? params : JSON.stringify(params);
    if (!requestHeaders['Content-Type']) requestHeaders['Content-Type'] = 'application/json';
  }

  const { response, json, text, paymentReceipt } = await fetchWithX402Json(
    targetUrl,
    { method, headers: requestHeaders, body },
    { authHeaders: requestHeaders, metadata: { tool: normalizeForWidget ? 'x402_fetch' : 'x402_pay', resourceUrl: url } },
  );

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const data = parseResponseData(contentType, json, text);
  const baseResult = {
    success: response.ok,
    status: response.status,
    data,
    responseTimeMs: Date.now() - startTime,
  };

  if (normalizeForWidget) {
    return {
      status: response.status,
      data,
      payment: normalizePaymentReceipt(paymentReceipt, response),
      ...(response.ok ? {} : { error: typeof data === 'string' ? data : `Request failed with ${response.status}` }),
    };
  }

  if (paymentReceipt) {
    baseResult.payment = {
      network: paymentReceipt.requirement?.network ?? 'unknown',
      amount: paymentReceipt.requirement?.maxAmountRequired ?? null,
      wallet: paymentReceipt.walletAddress ?? null,
    };
  }
  return baseResult;
}

async function getWalletSnapshot(extra) {
  const resolved = await resolveWalletForRequest(extra);
  const address = resolved?.wallet_address || null;
  if (!address) {
    return {
      error: 'No wallet configured',
      tip: 'No managed wallet was resolved for this authenticated session.',
    };
  }

  const token = resolveAuthToken(extra);
  const apiBase = (
    process.env.API_BASE_URL ||
    process.env.DEXTER_API_BASE_URL ||
    process.env.DEXTER_API_URL ||
    'https://api.dexter.cash'
  ).replace(/\/+$/, '');

  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const resp = await fetch(
      `${apiBase}/api/solana/balances?walletAddress=${encodeURIComponent(address)}&limit=200`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (resp.ok) {
      const json = await resp.json().catch(() => null);
      const balances = Array.isArray(json?.balances) ? json.balances : [];
      const nativeSol = balances.find((b) => b?.isNative === true);
      const usdcToken = balances.find((b) => {
        const mint = String(b?.mint || '').trim();
        const symbol = String(b?.token?.symbol || '').trim().toUpperCase();
        return mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || symbol === 'USDC';
      });
      const sol = Number(nativeSol?.amountUi ?? 0);
      const usdc = Number(usdcToken?.amountUi ?? 0);

      return {
        address,
        network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        networkName: 'Solana Mainnet',
        balances: { sol, usdc },
        tip: usdc === 0 ? `Deposit USDC to ${address} to pay for x402 APIs.` : undefined,
      };
    }
  } catch (err) {
    const msg = err?.message || String(err);
    return { address, error: `Failed to load balances: ${msg}`, tip: 'Wallet resolved, but balance lookup failed.' };
  }

  return {
    address,
    network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    networkName: 'Solana Mainnet',
    balances: { sol: 0, usdc: 0 },
    tip: `Wallet resolved (${address}), but live balances were unavailable.`,
  };
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerX402ClientToolset(server) {
  // --- x402_search ---
  server.registerTool('x402_search', {
    title: 'x402 Marketplace Search',
    description:
      'Search the Dexter x402 marketplace for paid API resources. ' +
      'Returns services with pricing, quality scores, verification status, ' +
      'settlement volume, and seller reputation. Use this to discover APIs ' +
      'an agent can pay for and call.',
    inputSchema: {
      query: z.string().optional().describe('Search term (e.g. "token analysis", "image generation", "sentiment")'),
      category: z.string().optional().describe('Filter by category (e.g. "api", "games", "creative")'),
      network: z.string().optional().describe('Filter by payment network: "solana", "base", "polygon"'),
      maxPriceUsdc: z.number().optional().describe('Maximum price per call in USDC'),
      verifiedOnly: z.boolean().optional().describe('Only return verified (quality-checked) endpoints'),
      sort: z.enum(['relevance', 'quality_score', 'settlements', 'volume', 'recent']).optional()
        .describe('Sort results (default: relevance when searching, settlements otherwise)'),
      limit: z.number().optional().describe('Max results (default: 20, max: 50)'),
    },
    _meta: {
      category: 'x402.marketplace',
      access: 'guest',
      tags: ['x402', 'marketplace', 'search', 'directory'],
      ...SEARCH_META,
    },
  }, async (args) => {
    try {
      const result = await searchMarketplace(args);
      const data = {
        success: true,
        count: result.resources.length,
        resources: result.resources,
        source: 'Dexter x402 Marketplace (https://dexter.cash)',
        tip: 'Use x402_fetch to call any of these endpoints. Payment is handled automatically.',
      };
      return {
        structuredContent: data,
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        _meta: SEARCH_META,
      };
    } catch (err) {
      const errorData = {
        success: false,
        count: 0,
        resources: [],
        error: err?.message || String(err),
      };
      return {
        structuredContent: errorData,
        content: [{ type: 'text', text: JSON.stringify(errorData, null, 2) }],
        isError: true,
        _meta: SEARCH_META,
      };
    }
  });

  // --- x402_pay ---
  server.registerTool('x402_pay', {
    title: 'x402 Pay & Call',
    description:
      'Call any x402-enabled paid API with automatic USDC payment. ' +
      'Payment is settled through the Dexter facilitator using your authenticated wallet. ' +
      'Supports any x402 resource URL — use x402_search to discover available endpoints.',
    inputSchema: {
      url: z.string().url().describe('The x402 resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      params: z.record(z.any()).optional()
        .describe('For GET: query parameters. For POST/PUT: JSON body fields.'),
      headers: z.record(z.string()).optional().describe('Optional custom request headers'),
    },
    _meta: {
      category: 'x402.payments',
      access: 'member',
      tags: ['x402', 'payments', 'api', 'paid'],
      ...FETCH_META,
    },
  }, async (args, extra) => {
    try {
      const result = await fetchWithSettlement(args, extra, true);
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        _meta: FETCH_META,
      };
    } catch (err) {
      const errorMsg = err.message || String(err);
      const data = {
        status: 500,
        error: errorMsg,
        ...(errorMsg.includes('settlement') ? { help: 'Check wallet balance or facilitator status.' } : {}),
      };
      return {
        structuredContent: data,
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        _meta: FETCH_META,
      };
    }
  });

  // --- x402_fetch ---
  server.registerTool('x402_fetch', {
    title: 'x402 Fetch',
    description:
      'Call any x402 endpoint with authenticated automatic payment and return a normalized fetch-result payload.',
    inputSchema: {
      url: z.string().url().describe('The x402 resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      params: z.record(z.any()).optional().describe('For GET: query params. For POST/PUT: JSON body fields.'),
      headers: z.record(z.string()).optional().describe('Optional custom request headers'),
    },
    _meta: {
      category: 'x402.payments',
      access: 'member',
      tags: ['x402', 'fetch', 'payments'],
      ...FETCH_META,
    },
  }, async (args, extra) => {
    try {
      const result = await fetchWithSettlement(args, extra, true);
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        _meta: FETCH_META,
      };
    } catch (err) {
      const data = { status: 500, error: err.message || String(err) };
      return {
        structuredContent: data,
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        _meta: FETCH_META,
      };
    }
  });

  // --- x402_check ---
  server.registerTool('x402_check', {
    title: 'x402 Check',
    description: 'Check if an endpoint requires x402 payment and return chain-level pricing options.',
    inputSchema: {
      url: z.string().url().describe('The URL to check'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method to probe with'),
    },
    annotations: { readOnlyHint: true },
    _meta: {
      category: 'x402.marketplace',
      access: 'guest',
      tags: ['x402', 'check', 'pricing'],
      ...CHECK_META,
    },
  }, async (args) => {
    try {
      const result = await checkEndpointPricing(args);
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        _meta: CHECK_META,
      };
    } catch (err) {
      const data = { error: true, statusCode: 500, message: err.message || String(err) };
      return {
        structuredContent: data,
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        isError: true,
        _meta: CHECK_META,
      };
    }
  });

  // --- x402_wallet ---
  server.registerTool('x402_wallet', {
    title: 'x402 Wallet',
    description: 'Show active authenticated wallet address and SOL/USDC balances used for x402 payments.',
    annotations: { readOnlyHint: true },
    _meta: {
      category: 'x402.payments',
      access: 'member',
      tags: ['x402', 'wallet', 'balances'],
      ...WALLET_META,
    },
  }, async (_args, extra) => {
    try {
      const result = await getWalletSnapshot(extra);
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        _meta: WALLET_META,
      };
    } catch (err) {
      const data = { error: err.message || String(err) };
      return {
        structuredContent: data,
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        isError: true,
        _meta: WALLET_META,
      };
    }
  });
}
