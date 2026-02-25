/**
 * x402-client toolset — user-facing search & pay for any x402 resource
 *
 * x402_search:  Discover paid APIs in the Dexter marketplace.
 * x402_pay:     Call any x402-enabled endpoint with automatic payment
 *               settlement via the Dexter facilitator (authenticated users).
 */

import { z } from 'zod';
import { fetchWithX402Json } from '../../clients/x402Client.mjs';

const DEXTER_API = (
  process.env.X402_API_URL ||
  'https://x402.dexter.cash'
).replace(/\/+$/, '');

const MARKETPLACE_PATH = '/api/facilitator/marketplace/resources';

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
    },
  }, async (args) => {
    try {
      const result = await searchMarketplace(args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            count: result.resources.length,
            resources: result.resources,
            source: 'Dexter x402 Marketplace (https://dexter.cash)',
            tip: 'Use x402_pay to call any of these endpoints. Payment is handled automatically.',
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }],
        isError: true,
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
    },
  }, async (args, extra) => {
    const { url, method = 'GET', params, headers: customHeaders } = args;
    const startTime = Date.now();

    try {
      const authToken = resolveAuthToken(extra);
      const requestHeaders = {
        Accept: 'application/json',
        ...(customHeaders || {}),
      };
      if (authToken) {
        requestHeaders.Authorization = `Bearer ${authToken}`;
      }

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
        if (!requestHeaders['Content-Type']) {
          requestHeaders['Content-Type'] = 'application/json';
        }
      }

      const { response, json, text, paymentReceipt } = await fetchWithX402Json(
        targetUrl,
        { method, headers: requestHeaders, body },
        { authHeaders: requestHeaders, metadata: { tool: 'x402_pay', resourceUrl: url } },
      );

      const result = {
        success: response.ok,
        status: response.status,
        data: json ?? text ?? null,
        responseTimeMs: Date.now() - startTime,
      };

      if (paymentReceipt) {
        result.payment = {
          network: paymentReceipt.requirement?.network ?? 'unknown',
          amount: paymentReceipt.requirement?.maxAmountRequired ?? null,
          wallet: paymentReceipt.walletAddress ?? null,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const errorMsg = err.message || String(err);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMsg,
            responseTimeMs: Date.now() - startTime,
            ...(errorMsg.includes('settlement') ? { help: 'Check wallet balance or facilitator status.' } : {}),
          }, null, 2),
        }],
        isError: true,
      };
    }
  });
}
