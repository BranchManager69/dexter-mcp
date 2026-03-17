// Sentry instrumentation (must be before all other imports)
import './instrument.open-mcp.mjs';

/**
 * Dexter Open MCP Server — x402 Gateway
 *
 * Public, no-auth MCP server with five tools:
 *   - x402_search: Discover x402 resources in the Dexter marketplace
 *   - x402_pay:    Call any x402 resource with canonical settlement (alias of x402_fetch)
 *   - x402_fetch:  Call any x402 resource with automatic payment
 *   - x402_check:  Preview endpoint pricing without paying
 *   - x402_access: Access identity-gated endpoints with wallet proof
 *   - x402_wallet: Session dashboard for anonymous spend funding/status
 *
 * Completely separate from the authenticated MCP server (http-server-oauth.mjs).
 * Shares no state, no sessions, no auth.
 *
 * Usage:
 *   OPEN_MCP_PORT=3931 node open-mcp-server.mjs
 */

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });
import { createOpenSessionResolver } from './lib/open-session-resolution.mjs';

const PORT = parseInt(process.env.OPEN_MCP_PORT || '3931', 10);
const DEXTER_API = (process.env.X402_API_URL || 'https://x402.dexter.cash').replace(/\/+$/, '');
const API_BASE_FALLBACK = (process.env.API_BASE_URL || 'http://127.0.0.1:3030').replace(/\/+$/, '');
const MARKETPLACE_PATH = '/api/facilitator/marketplace/resources';
const WIDGET_DOMAIN = 'https://dexter.cash';
const WIDGET_CSP = {
  resource_domains: [
    'https://api.dexter.cash',
    'https://cdn.dexscreener.com', 'https://raw.githubusercontent.com', 'https://metadata.jup.ag',
    'https://cdn.jsdelivr.net', 'https://dexter.cash', 'https://api.qrserver.com',
    'https://*.digitaloceanspaces.com', 'https://*.cloudfront.net', 'https://*.amazonaws.com',
    'https://*.cloudflare.com', 'https://*.r2.dev', 'https://*.blob.core.windows.net',
    'https://*.supabase.co', 'https://*.imgix.net', 'https://*.vercel.app',
    'https://*.replicate.delivery', 'https://*.openai.com', 'https://images.unsplash.com',
  ],
  connect_domains: ['https://x402.dexter.cash', 'https://api.dexter.cash', 'https://open.dexter.cash', 'https://dexter.cash'],
};

function widgetMeta(templateUri, invoking, invoked, description) {
  return {
    ui: { resourceUri: templateUri, visibility: ['model', 'app'] },
    'openai/outputTemplate': templateUri,
    'openai/resultCanProduceWidget': true,
    'openai/widgetAccessible': true,
    'openai/widgetDomain': WIDGET_DOMAIN,
    'openai/widgetPrefersBorder': true,
    'openai/widgetCSP': WIDGET_CSP,
    'openai/toolInvocation/invoking': invoking,
    'openai/toolInvocation/invoked': invoked,
    'openai/widgetDescription': description,
  };
}

const SEARCH_META = widgetMeta('ui://dexter/x402-marketplace-search-v6', 'Searching marketplace…', 'Results ready', 'Shows paid API search results as interactive cards with quality rings, prices, and fetch buttons.');
const PAY_META = widgetMeta('ui://dexter/x402-fetch-result', 'Processing payment…', 'Payment complete', 'Shows API response data with payment receipt, transaction link, and settlement status.');
const FETCH_META = widgetMeta('ui://dexter/x402-fetch-result', 'Calling API…', 'Response received', 'Shows API response data with payment receipt, transaction link, and settlement status.');
const ACCESS_META = widgetMeta('ui://dexter/x402-fetch-result', 'Signing access proof…', 'Access response ready', 'Shows identity-gated API responses with wallet proof details and any follow-up requirements.');
const CHECK_META = widgetMeta('ui://dexter/x402-pricing', 'Checking pricing…', 'Pricing loaded', 'Shows endpoint pricing per blockchain with payment amounts and a pay button.');
const WALLET_META = widgetMeta('ui://dexter/x402-wallet', 'Loading wallet…', 'Wallet loaded', 'Shows wallet addresses with copy button, USDC balances across chains, and deposit QR code.');

const ALL_TOOLS = ['x402_search', 'x402_pay', 'x402_fetch', 'x402_check', 'x402_access', 'x402_wallet'];
const OPEN_SESSION_HINT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Set env vars required by registerAppsSdkResources before importing it
if (!process.env.TOKEN_AI_MCP_PUBLIC_URL) process.env.TOKEN_AI_MCP_PUBLIC_URL = 'https://open.dexter.cash/mcp';
if (!process.env.TOKEN_AI_WIDGET_DOMAIN) process.env.TOKEN_AI_WIDGET_DOMAIN = 'https://dexter.cash';
if (!process.env.TOKEN_AI_APPS_SDK_ASSET_BASE) process.env.TOKEN_AI_APPS_SDK_ASSET_BASE = 'https://dexter.cash/mcp/app-assets/assets';

import { registerAppsSdkResources } from './apps-sdk/register.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SESSION_SUPPORTED_NETWORKS = new Set([
  'solana', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  'base', 'eip155:8453',
  'polygon', 'eip155:137',
  'arbitrum', 'eip155:42161',
  'optimism', 'eip155:10',
  'avalanche', 'eip155:43114',
]);

function isSessionSupportedNetwork(network) {
  if (!network) return true;
  return SESSION_SUPPORTED_NETWORKS.has(network.toLowerCase().trim());
}

function formatPrice(r) {
  if (r.priceLabel) return r.priceLabel;
  if (r.priceUsdc != null) return `$${Number(r.priceUsdc).toFixed(2)}`;
  return 'free';
}

function encodeMarketplaceResourceId(payTo, resourceUrl) {
  return Buffer.from(`${payTo}:${resourceUrl}`).toString('base64');
}

function formatChainOptions(r) {
  const accepts = Array.isArray(r.accepts) ? r.accepts : [];
  if (!accepts.length) {
    return [{
      network: r.priceNetwork || null,
      asset: r.priceAsset || null,
      priceAtomic: r.priceAtomic ?? null,
      priceUsdc: r.priceUsdc ?? null,
      priceLabel: r.priceLabel ?? formatPrice(r),
    }];
  }

  return accepts.map((accept) => {
    const atomic = accept?.maxAmountRequired ?? accept?.amount ?? null;
    const numericAtomic = atomic != null ? Number(atomic) : null;
    const derivedPriceUsdc = numericAtomic != null && Number.isFinite(numericAtomic)
      ? numericAtomic / 1_000_000
      : null;
    return {
      network: accept?.network || null,
      asset: accept?.asset || r.priceAsset || null,
      priceAtomic: atomic != null ? String(atomic) : null,
      priceUsdc: derivedPriceUsdc ?? r.priceUsdc ?? null,
      priceLabel: derivedPriceUsdc != null
        ? `$${derivedPriceUsdc.toFixed(derivedPriceUsdc < 0.01 ? 4 : 2)}`
        : (r.priceLabel ?? formatPrice(r)),
    };
  });
}

function formatResource(r) {
  return {
    resourceId: encodeMarketplaceResourceId(r.payTo || r.seller?.payTo || 'unknown', r.resourceUrl),
    name: r.displayName || r.resourceUrl,
    url: r.resourceUrl,
    method: r.method || 'GET',
    price: formatPrice(r),
    priceAtomic: r.priceAtomic ?? null,
    priceUsdc: r.priceUsdc ?? null,
    priceAsset: r.priceAsset ?? null,
    network: r.priceNetwork || null,
    chains: formatChainOptions(r),
    description: r.description || '',
    category: r.category || 'uncategorized',
    qualityScore: r.qualityScore ?? null,
    verified: r.verificationStatus === 'pass',
    verificationStatus: r.verificationStatus ?? null,
    verificationNotes: r.verificationNotes ?? null,
    verificationFixInstructions: r.verificationFixInstructions ?? null,
    lastVerifiedAt: r.lastVerifiedAt ?? null,
    totalCalls: r.totalSettlements ?? 0,
    totalVolume: r.totalVolumeUsdc != null ? `$${Number(r.totalVolumeUsdc).toLocaleString()}` : null,
    totalVolumeUsdc: r.totalVolumeUsdc ?? null,
    iconUrl: r.iconUrl ?? null,
    seller: r.seller?.displayName || null,
    sellerMeta: {
      payTo: r.seller?.payTo || r.payTo || null,
      displayName: r.seller?.displayName || null,
      logoUrl: r.seller?.logoUrl || null,
      twitterHandle: r.seller?.twitterHandle || null,
    },
    sellerReputation: r.reputationScore ?? null,
    authRequired: Boolean(r.authRequired),
    authType: r.authType || null,
    authHint: r.authHint || null,
    sessionCompatible: !r.priceNetwork || isSessionSupportedNetwork(r.priceNetwork),
  };
}

function normalizeSearchQuery(query) {
  if (typeof query !== 'string') return '';
  const trimmed = query.trim();
  if (!trimmed) return '';
  // Wildcard-only terms are treated as "show me what's available".
  if (/^[*%_\-.\s]+$/.test(trimmed)) return '';
  return trimmed;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[rows - 1][cols - 1];
}

function scoreResourceMatch(resource, queryTokens) {
  if (!queryTokens.length) return 0;
  const text = `${resource.name || ''} ${resource.description || ''} ${resource.category || ''}`.toLowerCase();
  const words = tokenize(text);
  let score = 0;

  for (const token of queryTokens) {
    if (text.includes(token)) {
      score += 4;
      continue;
    }
    if (token.length >= 5 && text.includes(token.slice(0, -1))) {
      score += 2;
      continue;
    }
    if (token.length >= 5 && words.some((w) => Math.abs(w.length - token.length) <= 1 && levenshtein(w, token) <= 1)) {
      score += 1;
    }
  }
  return score;
}

function buildMerchantSettlement(requirements) {
  const accepts = requirements?.accepts;
  if (!Array.isArray(accepts)) return [];
  return accepts.map((entry) => ({
    network: entry?.network || null,
    asset: entry?.asset || null,
    amountAtomic: String(entry?.maxAmountRequired ?? entry?.amount ?? ''),
    payTo: entry?.payTo || null,
  }));
}

function normalizeSessionFunding(funding) {
  if (!funding || typeof funding !== 'object') return null;
  const walletAddress = funding.walletAddress || funding.payTo || null;
  return {
    ...funding,
    walletAddress,
    payTo: funding.payTo || walletAddress,
    escrowNote: "This is the session escrow address. Fund it to enable x402 payments. Merchant payTo addresses are shown in merchantSettlement after a paid call.",
  };
}

const sessionResolver = createOpenSessionResolver({
  dexterApi: DEXTER_API,
  apiBaseFallback: API_BASE_FALLBACK,
  openSessionHintTtlMs: OPEN_SESSION_HINT_TTL_MS,
  normalizeSessionFunding,
});
const {
  extractMcpSessionId,
  linkSessionToContext,
  readOpenSessionHint,
  rememberOpenSessionHint,
  resolveOrCreateSessionForWallet,
  resolveSessionForPayment,
} = sessionResolver;

async function fetchMarketplaceResources({ query, category, network, maxPriceUsdc, verifiedOnly, sort, limit }) {
  const params = new URLSearchParams();
  if (query) params.set('search', query);
  if (category) params.set('category', category);
  if (network) params.set('network', network);
  if (maxPriceUsdc != null) params.set('maxPrice', String(maxPriceUsdc));
  if (verifiedOnly) params.set('verified', 'true');
  params.set('sort', sort || 'marketplace');
  params.set('order', 'desc');
  params.set('limit', String(Math.min(limit || 20, 50)));

  const url = `${DEXTER_API}${MARKETPLACE_PATH}?${params}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    throw new Error(`Marketplace returned ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  }

  const data = await res.json();
  return (data.resources || []).map(formatResource);
}

// ─── Tool: x402_search ──────────────────────────────────────────────────────

async function x402Search({ query, category, network, maxPriceUsdc, verifiedOnly, sort, limit }) {
  const rawQuery = typeof query === 'string' ? query.trim() : '';
  const normalizedQuery = normalizeSearchQuery(rawQuery);
  const primaryResources = await fetchMarketplaceResources({
    query: normalizedQuery,
    category,
    network,
    maxPriceUsdc,
    verifiedOnly,
    sort,
    limit,
  });

  if (primaryResources.length > 0 || !normalizedQuery) {
    const fallbackUsed = Boolean(rawQuery && !normalizedQuery);
    return {
      resources: primaryResources,
      total: primaryResources.length,
      searchMeta: fallbackUsed
        ? {
            mode: 'normalized_browse',
            note: 'Wildcard-only query was normalized to a broad marketplace browse.',
          }
        : { mode: 'direct' },
    };
  }

  // No direct matches: fetch broad catalog and rank fuzzy token matches.
  const broadResources = await fetchMarketplaceResources({
    query: '',
    category,
    network,
    maxPriceUsdc,
    verifiedOnly,
    sort,
    limit: 50,
  });
  const tokens = tokenize(normalizedQuery);
  const ranked = broadResources
    .map((resource) => ({ resource, score: scoreResourceMatch(resource, tokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(limit || 20, 50))
    .map((row) => row.resource);

  return {
    resources: ranked,
    total: ranked.length,
    searchMeta: ranked.length
      ? {
          mode: 'fuzzy_broad',
          note: `No exact matches for "${normalizedQuery}". Showing closest related results from a broader marketplace scan.`,
        }
      : {
          mode: 'empty_after_fallback',
          note: `No exact or close matches found for "${normalizedQuery}" after broad fallback.`,
        },
  };
}

// ─── Tool: x402_pay ─────────────────────────────────────────────────────────

async function x402Pay({ url, method, body, sessionToken, sessionKey }, extra) {
  const result = await x402Fetch({ url, method, body, sessionToken, sessionKey }, extra);
  return {
    ...result,
    tool: 'x402_pay',
    canonicalFlow: true,
  };
}

// ─── Tool: x402_fetch (auto-pay) ─────────────────────────────────────────────

async function x402Fetch({ url, method, body, sessionToken, sessionKey }, extra) {
  const fetchOpts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) };
  if (body && method && method.toUpperCase() !== 'GET') {
    fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const probeRes = await fetch(url, fetchOpts);

  if (probeRes.status !== 402) {
    const ct = probeRes.headers.get('content-type') || '';
    let data;
    if (ct.includes('json')) { try { data = await probeRes.json(); } catch { data = await probeRes.text(); } }
    else { data = await probeRes.text(); }
    return { status: probeRes.status, data };
  }

  let body402 = null;
  try { body402 = await probeRes.json(); } catch { try { body402 = await probeRes.text(); } catch {} }

  const accepts = body402?.accepts;
  const requirements = accepts && Array.isArray(accepts)
    ? { accepts, x402Version: body402.x402Version ?? 2, resource: body402.resource }
    : null;

  const walletKey = process.env.DEXTER_PRIVATE_KEY || process.env.SOLANA_PRIVATE_KEY;
  if (walletKey) {
    try {
      const { wrapFetch } = await import('@dexterai/x402/client');
      const x402FetchFn = wrapFetch(fetch, { walletPrivateKey: walletKey });
      const paidRes = await x402FetchFn(url, fetchOpts);
      const ct = paidRes.headers.get('content-type') || '';
      let data;
      if (ct.includes('json')) { try { data = await paidRes.json(); } catch { data = await paidRes.text(); } }
      else { data = await paidRes.text(); }

      let settlement = null;
      const payHeader = paidRes.headers.get('payment-response') || paidRes.headers.get('PAYMENT-RESPONSE');
      if (payHeader) { try { settlement = JSON.parse(atob(payHeader)); } catch { try { settlement = JSON.parse(payHeader); } catch {} } }

      return {
        status: paidRes.status,
        mode: paidRes.ok ? 'session_ready' : 'session_error',
        data,
        payment: settlement ? { settled: true, details: settlement } : { settled: false },
        merchantSettlement: buildMerchantSettlement(requirements),
      };
    } catch (err) {
      console.error(`[open-mcp] Direct payment failed: url=${url} error=${err?.message || String(err)}`, err?.stack || '');
      return {
        status: 402,
        mode: 'session_error',
        error: `Payment failed: ${err.message}`,
        requirements,
        merchantSettlement: buildMerchantSettlement(requirements),
      };
    }
  }

  const paymentSession = await resolveSessionForPayment({ sessionToken, sessionKey }, extra);
  if (paymentSession.error) {
    return {
      ...paymentSession.error,
      requirements,
      merchantSettlement: buildMerchantSettlement(requirements),
      sessionResolution: paymentSession.sessionResolution,
    };
  }

  const resolvedSessionToken = paymentSession.session?.sessionToken || null;
  if (resolvedSessionToken) {
    try {
      const bases = [DEXTER_API, API_BASE_FALLBACK].filter(Boolean);
      const paths = ['/v2/open/x402/fetch', '/v2/pay/open/x402/fetch'];
      let openRes = null;
      let openBody = null;
      for (const base of bases) {
        for (const path of paths) {
          const attempt = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionToken: resolvedSessionToken,
              url,
              method: method || 'GET',
              body: fetchOpts.body ?? null,
              requestId: randomUUID(),
            }),
            signal: AbortSignal.timeout(30000),
          });
          const parsed = await attempt.json().catch(() => null);
          const is404PathNotFound = attempt.status === 404 && !parsed?.error;
          if (!is404PathNotFound) {
            openRes = attempt;
            openBody = parsed;
            break;
          }
        }
        if (openRes) break;
      }

      if (!openRes || !openRes.ok || !openBody?.ok) {
        console.error(`[open-mcp] x402_fetch API failed: status=${openRes?.status} ok=${openBody?.ok} error=${openBody?.error} url=${url}`, JSON.stringify(openBody)?.slice(0, 500));
        const sessionHint = resolvedSessionToken ? readOpenSessionHint(resolvedSessionToken) : null;
        const looksUnfunded = openBody?.error === 'session_not_funded' || openBody?.state === 'pending_funding';
        if (looksUnfunded) {
          const funding = normalizeSessionFunding(openBody?.funding || openBody?.session?.funding || sessionHint?.funding);
          return {
            status: 402,
            mode: 'session_required',
            error: 'session_not_funded',
            message: 'OpenDexter session exists but is not funded yet.',
            requirements,
            merchantSettlement: buildMerchantSettlement(requirements),
            sessionFunding: funding,
            sessionResolution: paymentSession.sessionResolution,
            session: sessionHint ? { ...sessionHint, state: openBody?.state || 'pending_funding' } : {
              sessionToken: resolvedSessionToken,
              state: openBody?.state || 'pending_funding',
            },
            details: openBody || null,
          };
        }
        const rawError = openBody?.error || 'open_session_fetch_failed';
        const isExpired = rawError === 'session_expired' || openBody?.state === 'expired';
        const isNotFound = rawError === 'session_not_found' || openRes?.status === 404;
        const errorCode = isExpired ? 410 : isNotFound ? 404 : (openRes?.status || 500);
        const errorMessage = isExpired
          ? 'Session has expired. Create a new session with x402_wallet().'
          : isNotFound
            ? 'Session not found. The token may be invalid or the session may have been cleaned up.'
            : `Session payment failed: ${rawError}`;
        return {
          status: errorCode,
          mode: 'session_error',
          error: rawError,
          message: errorMessage,
          hint: 'Call x402_wallet() with no arguments to create a new session.',
          details: openBody || null,
          requirements,
          merchantSettlement: buildMerchantSettlement(requirements),
          sessionResolution: paymentSession.sessionResolution,
        };
      }
      if (openBody?.session?.sessionToken) {
        rememberOpenSessionHint(openBody.session);
        linkSessionToContext(extra, openBody.session.sessionToken);
      } else if (resolvedSessionToken) {
        linkSessionToContext(extra, resolvedSessionToken);
      }
      return {
        status: openBody.status ?? 200,
        mode: openBody.paid ? 'session_ready' : 'session_error',
        data: openBody.data,
        payment: openBody.payment?.settlement
          ? { settled: true, details: openBody.payment.settlement }
          : { settled: Boolean(openBody.paid) },
        session: { ...(openBody.session ?? { sessionToken: resolvedSessionToken }), funding: undefined },
        sessionFunding: normalizeSessionFunding(openBody.session?.funding || readOpenSessionHint(resolvedSessionToken)?.funding),
        merchantSettlement: buildMerchantSettlement(requirements),
        sessionResolution: paymentSession.sessionResolution,
      };
    } catch (err) {
      console.error(`[open-mcp] x402_fetch exception: url=${url} error=${err?.message || String(err)}`, err?.stack || '');
      return {
        status: 500,
        mode: 'session_error',
        error: `Open canonical fetch failed: ${err?.message || String(err)}`,
        requirements,
        merchantSettlement: buildMerchantSettlement(requirements),
        sessionResolution: paymentSession.sessionResolution,
      };
    }
  }
}

// ─── Tool: x402_access (wallet-proof auth) ──────────────────────────────────

async function x402Access({ url, method, body, sessionToken, sessionKey, network }, extra) {
  const fetchOpts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) };
  if (body && method && method.toUpperCase() !== 'GET') {
    fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const sessionResolution = await resolveOrCreateSessionForWallet({ sessionToken, sessionKey }, extra);
  if (sessionResolution.error) {
    return {
      ...sessionResolution.error,
      sessionResolution: sessionResolution.sessionResolution,
    };
  }

  const resolvedSessionToken = sessionResolution.session?.sessionToken || null;
  const sessionHint = resolvedSessionToken ? readOpenSessionHint(resolvedSessionToken) : null;

  try {
    const bases = [DEXTER_API, API_BASE_FALLBACK].filter(Boolean);
    const paths = ['/v2/open/x402/access', '/v2/pay/open/x402/access'];
    let accessRes = null;
    let accessBody = null;
    for (const base of bases) {
      for (const path of paths) {
        const attempt = await fetch(`${base}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: resolvedSessionToken,
            url,
            method: method || 'GET',
            body: fetchOpts.body ?? null,
            network: network || undefined,
          }),
          signal: AbortSignal.timeout(30000),
        });
        const parsed = await attempt.json().catch(() => null);
        const is404PathNotFound = attempt.status === 404 && !parsed?.error;
        if (!is404PathNotFound) {
          accessRes = attempt;
          accessBody = parsed;
          break;
        }
      }
      if (accessRes) break;
    }

    if (!accessRes || !accessRes.ok || !accessBody?.ok) {
      const rawError = accessBody?.error || 'open_session_access_failed';
      return {
        status: accessRes?.status || 500,
        mode: 'session_error',
        error: rawError,
        message: accessBody?.message || `Access flow failed: ${rawError}`,
        hint: rawError === 'no_siwx_extension'
          ? 'This endpoint may be payment-gated rather than identity-gated. Use x402_check or x402_fetch instead.'
          : undefined,
        details: accessBody || null,
        session: sessionHint || (resolvedSessionToken ? { sessionToken: resolvedSessionToken } : null),
        sessionResolution: sessionResolution.sessionResolution,
      };
    }

    if (resolvedSessionToken) {
      linkSessionToContext(extra, resolvedSessionToken);
    }

    return {
      status: accessBody.status ?? 200,
      mode: 'session_ready',
      data: accessBody.data,
      auth: accessBody.auth || null,
      requirements: accessBody.requirements || null,
      session: { ...(accessBody.session ?? { sessionToken: resolvedSessionToken }), funding: undefined },
      sessionFunding: normalizeSessionFunding(accessBody.session?.funding || sessionHint?.funding),
      sessionResolution: sessionResolution.sessionResolution,
    };
  } catch (err) {
    return {
      status: 500,
      mode: 'session_error',
      error: `Open access flow failed: ${err?.message || String(err)}`,
      session: sessionHint || (resolvedSessionToken ? { sessionToken: resolvedSessionToken } : null),
      sessionResolution: sessionResolution.sessionResolution,
    };
  }
}

// ─── Tool: x402_check (pricing) ──────────────────────────────────────────────

async function x402Check({ url, method }) {
  const res = await fetch(url, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: (method || 'GET') !== 'GET' ? '{}' : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (res.status !== 402) {
    if (res.status === 401 || res.status === 403) {
      const bodyText = await res.text().catch(() => '');
      return {
        error: true,
        statusCode: res.status,
        authRequired: true,
        message: bodyText || 'Provider authentication required before x402 payment flow.',
      };
    }
    if (res.status >= 500) return { error: true, statusCode: res.status, message: 'Server error' };
    if (res.status >= 400) return { error: true, statusCode: res.status, message: `Client error: ${res.status}` };
    return { requiresPayment: false, statusCode: res.status, free: true };
  }

  let body = null;
  try { body = await res.json(); } catch {}
  const accepts = body?.accepts;
  if (!accepts?.length) return { requiresPayment: true, statusCode: 402, error: 'No payment options found' };

  const paymentOptions = accepts.map(a => {
    const amount = Number(a.amount || a.maxAmountRequired || 0);
    const decimals = Number(a.extra?.decimals ?? 6);
    const price = amount / Math.pow(10, decimals);
    return { price, priceFormatted: `$${price.toFixed(decimals > 2 ? 4 : 2)}`, network: a.network, scheme: a.scheme, asset: a.asset, payTo: a.payTo };
  });

  const schema = accepts[0]?.outputSchema || null;
  return { requiresPayment: true, statusCode: 402, x402Version: body?.x402Version ?? 2, paymentOptions, resource: body?.resource, schema };
}

// ─── Tool: x402_wallet ───────────────────────────────────────────────────────

async function x402Wallet(args, extra) {
  const resolution = await resolveOrCreateSessionForWallet(args, extra);
  if (resolution.error) {
    return {
      ...resolution.error,
      sessionResolution: resolution.sessionResolution,
    };
  }

  const session = resolution.session;

  // Query dexter-api for current session state (funding, spend, balance)
  let liveState = null;
  if (session.sessionId) {
    const bases = [DEXTER_API, API_BASE_FALLBACK].filter(Boolean);
    const statusPaths = ['/v2/open/session/status/', '/v2/pay/open/session/status/'];
    for (const base of bases) {
      for (const path of statusPaths) {
        try {
          const res = await fetch(`${base}${path}${session.sessionId}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            liveState = await res.json().catch(() => null);
            break;
          }
        } catch {}
      }
      if (liveState) break;
    }
  }

  const state = liveState?.state || 'pending_funding';
  const fundedAtomic = liveState?.fundedAtomic || liveState?.funding?.amountAtomic || '0';
  const spentAtomic = liveState?.spentAtomic || '0';
  const availableAtomic = liveState?.availableAtomic || String(Math.max(0, Number(fundedAtomic) - Number(spentAtomic)));
  const funding = normalizeSessionFunding(liveState?.funding || session.funding);

  const usdcAvailable = Number(availableAtomic) / 1e6;
  const solanaAddress = funding?.walletAddress || liveState?.solanaAddress || liveState?.funding?.walletAddress || session.funding?.walletAddress || null;
  const evmAddress = liveState?.evmAddress || null;
  const chainBalances = liveState?.chainBalances || {};

  // Compute per-chain display info for the widget
  const chainDisplay = {};
  const CHAIN_NAMES = {
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': { name: 'Solana', tier: 'first' },
    'eip155:8453': { name: 'Base', tier: 'first' },
    'eip155:137': { name: 'Polygon', tier: 'second' },
    'eip155:42161': { name: 'Arbitrum', tier: 'second' },
    'eip155:10': { name: 'Optimism', tier: 'second' },
    'eip155:43114': { name: 'Avalanche', tier: 'second' },
  };
  for (const [caip2, meta] of Object.entries(CHAIN_NAMES)) {
    const bal = chainBalances[caip2] || '0';
    chainDisplay[caip2] = { available: String(bal), name: meta.name, tier: meta.tier };
  }

  const totalUsdc = Object.values(chainBalances).reduce((sum, v) => sum + Number(v || 0), 0) / 1e6;

  return {
    mode: state === 'active' || state === 'depleted' ? 'session_ready' : 'session_required',
    sessionId: session.sessionId,
    _sessionToken: session.sessionToken,
    sessionResolution: resolution.sessionResolution,
    state,
    solanaAddress,
    evmAddress,
    // This is the canonical wallet payload shape consumed by ChatGPT widgets.
    // Other wallet-producing surfaces should converge on these field names even
    // if some optional fields remain null until their backend can resolve them.
    address: solanaAddress,
    network: 'multichain',
    networkName: 'Multi-Chain',
    sessionFunding: funding,
    chainBalances: chainDisplay,
    balances: {
      usdc: totalUsdc || usdcAvailable,
      fundedAtomic: String(fundedAtomic),
      spentAtomic: String(spentAtomic),
      availableAtomic: String(availableAtomic),
    },
    expiresAt: liveState?.expiresAt || session.expiresAt || null,
    tip: state === 'active'
      ? 'Session is funded and ready. Use x402_fetch to call paid APIs on any supported chain.'
      : state === 'depleted'
        ? 'Session balance exhausted. Send USDC to either address to continue.'
        : 'Send USDC on any supported chain (Solana, Base, Polygon, Arbitrum, Optimism, Avalanche) to either the Solana or EVM address.',
  };
}

// ─── MCP Server Setup ───────────────────────────────────────────────────────

function createOpenMcpServer() {
  const server = new McpServer({
    name: 'Dexter x402 Gateway',
    version: '1.0.0',
  });

  server.registerTool('x402_search', {
    title: 'x402 Search',
    description: 'Search the x402 marketplace for paid API resources across Solana and EVM chains (Base, Polygon, Arbitrum, Optimism, Avalanche). Returns verified endpoints with pricing, quality scores, and input/output schemas. Results span multiple chains — the session handles chain selection automatically at payment time.',
    inputSchema: {
      query: z.string().optional().describe('What are you looking for? e.g. "token analysis", "image generation", "video"'),
      category: z.string().optional().describe('Filter by category (e.g. "api", "games", "creative")'),
      network: z.string().optional().describe('Filter by payment network: "solana", "base", "polygon"'),
      maxPriceUsdc: z.number().optional().describe('Maximum price per call in USDC'),
      verifiedOnly: z.boolean().optional().describe('Only return verified (quality-checked) endpoints'),
      sort: z.enum(['marketplace', 'relevance', 'quality_score', 'settlements', 'volume', 'recent']).optional().describe('Sort by (default: marketplace)'),
      limit: z.number().optional().default(20).describe('Max results (default: 20, max: 50)'),
    },
    annotations: { readOnlyHint: true },
    _meta: SEARCH_META,
  }, async (args) => {
    try {
      const result = await x402Search(args);
      const data = {
        success: true,
        count: result.resources.length,
        resources: result.resources,
        searchMeta: result.searchMeta || { mode: 'direct' },
        tip: 'Use x402_fetch or x402_pay to call any of these endpoints.',
      };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, _meta: SEARCH_META };
    } catch (err) {
      const data = { success: false, count: 0, resources: [], error: err?.message || String(err) };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: SEARCH_META };
    }
  });

  server.registerTool('x402_pay', {
    title: 'x402 Pay',
    description: 'Alias for x402_fetch. Prefer x402_fetch for all paid API calls. Requires an active OpenDexter session; use x402_wallet to create or resume one first when needed.',
    inputSchema: {
      url: z.string().url().describe('The x402 resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      body: z.any().optional().describe('Request body (for POST/PUT). Can be object or string.'),
      sessionToken: z.string().optional().describe('Anonymous OpenDexter session token for canonical x402 settlement when no local key is configured.'),
      sessionKey: z.string().optional().describe('Optional stable session key for reusable OpenDexter sessions (for example, caller-hash on phone).'),
    },
    _meta: PAY_META,
  }, async (args, extra) => {
    try {
      const result = await x402Pay(args, extra);
      const meta = { ...PAY_META };
      if (result.session?.sessionToken) {
        meta.sessionToken = result.session.sessionToken;
        const { sessionToken: _drop, ...cleanSession } = result.session;
        result.session = cleanSession;
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result, _meta: meta };
    } catch (err) {
      const msg = err?.cause?.code === 'ENOTFOUND' ? `Could not reach ${args.url}` : err?.message || String(err);
      const data = { status: 500, error: msg };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: PAY_META };
    }
  });

  server.registerTool('x402_fetch', {
    title: 'x402 Fetch',
    description: 'Call any x402-protected API and pay automatically from the active OpenDexter session. Use x402_wallet to create or resume a session first. The session checks balances across all funded chains (Solana, Base, Polygon, Arbitrum, Optimism, Avalanche) and picks the best-funded chain that the endpoint accepts — no chain parameter needed.',
    inputSchema: {
      url: z.string().url().describe('The x402 resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      body: z.string().optional().describe('JSON request body for POST/PUT'),
      sessionToken: z.string().optional().describe('Anonymous OpenDexter session token for canonical x402 settlement when no local key is configured.'),
      sessionKey: z.string().optional().describe('Optional stable session key for reusable OpenDexter sessions (for example, caller-hash on phone).'),
    },
    annotations: { destructiveHint: true },
    annotations: { destructiveHint: true },
    _meta: FETCH_META,
  }, async (args, extra) => {
    try {
      const result = await x402Fetch(args, extra);
      // Strip sessionToken from session object so model never sees it
      const meta = { ...FETCH_META };
      if (result.session?.sessionToken) {
        meta.sessionToken = result.session.sessionToken;
        const { sessionToken: _drop, ...cleanSession } = result.session;
        result.session = cleanSession;
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result, _meta: meta };
    } catch (err) {
      const msg = err.cause?.code === 'ENOTFOUND' ? `Could not reach ${args.url}` : err.message || String(err);
      const data = { status: 500, error: msg };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: FETCH_META };
    }
  });

  server.registerTool('x402_check', {
    title: 'x402 Check',
    description: 'Probe an endpoint for x402 payment requirements without paying. Returns pricing options per chain (Solana, Base, and others if supported), input/output schema, and the payTo address for each chain. Use this to preview costs before calling x402_fetch.',
    inputSchema: {
      url: z.string().url().describe('The URL to check'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method to probe with'),
    },
    annotations: { readOnlyHint: true },
    _meta: CHECK_META,
  }, async (args) => {
    try {
      const result = await x402Check(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result, _meta: CHECK_META };
    } catch (err) {
      const data = { error: true, statusCode: 500, message: err?.message || String(err) };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: CHECK_META };
    }
  });

  server.registerTool('x402_access', {
    title: 'x402 Access',
    description: 'Access an identity-gated endpoint using wallet proof instead of immediate payment. Use this when an endpoint requires Sign-In-With-X or wallet-based authentication rather than a direct paid call.',
    inputSchema: {
      url: z.string().url().describe('The protected resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      body: z.string().optional().describe('JSON request body for POST/PUT'),
      sessionToken: z.string().optional().describe('Existing OpenDexter session token. If omitted, OpenDexter will create or resume a session.'),
      sessionKey: z.string().optional().describe('Optional stable session key for reusable OpenDexter sessions.'),
      network: z.string().optional().describe('Optional preferred auth network, e.g. solana:... or eip155:8453'),
    },
    _meta: ACCESS_META,
  }, async (args, extra) => {
    try {
      const result = await x402Access(args, extra);
      const meta = { ...ACCESS_META };
      if (result.session?.sessionToken) {
        meta.sessionToken = result.session.sessionToken;
        const { sessionToken: _drop, ...cleanSession } = result.session;
        result.session = cleanSession;
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result, _meta: meta };
    } catch (err) {
      const data = { status: 500, error: err?.message || String(err) };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: ACCESS_META };
    }
  });

  server.registerTool('x402_wallet', {
    title: 'x402 Wallet',
    description: 'Create or resume an OpenDexter multi-chain session. Each session has both a Solana wallet and an EVM wallet (same address on Base, Polygon, Arbitrum, Optimism, Avalanche). Returns whether the session was newly created or resumed, plus balances, deposit addresses, and a Solana Pay QR code for funding.',
    inputSchema: {
      sessionToken: z.string().optional().describe('Pass an existing session token to check its status and balance instead of creating a new session.'),
    },
    annotations: { readOnlyHint: true },
    _meta: WALLET_META,
  }, async (args, extra) => {
    try {
      const result = await x402Wallet(args, extra);
      const { _sessionToken, ...publicResult } = result;
      const meta = { ...WALLET_META };
      if (_sessionToken) meta.sessionToken = _sessionToken;
      return { content: [{ type: 'text', text: JSON.stringify(publicResult, null, 2) }], structuredContent: publicResult, _meta: meta };
    } catch (err) {
      const data = { error: err?.message || String(err) };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: WALLET_META };
    }
  });

  // ─── Widget Resource Registration (uses same system as authenticated MCP) ──

  try {
    registerAppsSdkResources(server, {
      allowedTemplateUris: [
        'ui://dexter/x402-marketplace-search-v6',
        'ui://dexter/x402-fetch-result',
        'ui://dexter/x402-pricing',
        'ui://dexter/x402-wallet',
      ],
    });
  } catch (err) {
    console.warn('[open-mcp] Failed to register widget resources:', err?.message || err);
  }

  return server;
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────

const transports = new Map();

function writeCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
}

const httpServer = http.createServer(async (req, res) => {
  writeCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === '/health' || url.pathname === '/mcp/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      name: 'Dexter x402 Gateway',
      tools: ALL_TOOLS,
      auth: false,
      sessions: transports.size,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // MCP manifest
  if (url.pathname === '/.well-known/mcp.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Dexter x402 Gateway',
      url: 'https://open.dexter.cash/mcp',
      description:
        'Public x402 gateway. Search, pay, and call any x402 resource with canonical settlement. ' +
        'Five tools, no authentication required.',
      version: '1.1.0',
      tools: [
        { name: 'x402_search', description: 'Search the x402 marketplace for paid APIs across Solana and EVM chains.' },
        { name: 'x402_pay', description: 'Alias for x402_fetch. Pays and calls an x402 endpoint.' },
        { name: 'x402_fetch', description: 'Call any x402 API — auto-selects the best funded chain for payment.' },
        { name: 'x402_check', description: 'Preview endpoint pricing and payment options per chain without paying.' },
        { name: 'x402_access', description: 'Use wallet proof to access identity-gated endpoints that advertise Sign-In-With-X.' },
        { name: 'x402_wallet', description: 'Multi-chain session with Solana + EVM wallets. Fund any chain, pay on any chain.' },
      ],
    }));
    return;
  }

  // Only handle /mcp and root
  if (url.pathname !== '/' && url.pathname !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // ─── GET: SSE / session resume ──────────────────────────────────────
  if (req.method === 'GET') {
    const sessionId = req.headers['mcp-session-id'];
    // Browser visit (no MCP session, accepts HTML) → redirect to OpenDexter page
    const acceptsHtml = (req.headers.accept || "").includes("text/html");
    if (acceptsHtml && !sessionId) {
      res.writeHead(301, { Location: "https://dexter.cash/opendexter" });
      res.end();
      return;
    }
    if (!sessionId || !transports.has(sessionId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active session. Send a POST to initialize.' }));
      return;
    }
    const transport = transports.get(sessionId);
    await transport.handleRequest(req, res);
    return;
  }

  // ─── POST: MCP JSON-RPC ────────────────────────────────────────────
  if (req.method === 'POST') {
    const sessionId = req.headers['mcp-session-id'];

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId);
      await transport.handleRequest(req, res);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports.set(sid, transport);
        console.log(`[open-mcp] session created: ${sid} (active: ${transports.size})`);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        transports.delete(sid);
        console.log(`[open-mcp] session closed: ${sid} (active: ${transports.size})`);
      }
    };

    const mcpServer = createOpenMcpServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  // ─── DELETE: close session ──────────────────────────────────────────
  if (req.method === 'DELETE') {
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId);
      await transport.handleRequest(req, res);
      transports.delete(sessionId);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
    }
    return;
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
});

// Reap stale sessions every 10 minutes
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [sid, transport] of transports) {
    if (transport._lastActivity && now - transport._lastActivity > SESSION_MAX_AGE_MS) {
      transports.delete(sid);
      console.log(`[open-mcp] reaped stale session: ${sid}`);
    }
  }
}, 10 * 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`[open-mcp] Dexter x402 Gateway listening on :${PORT}`);
  console.log(`[open-mcp] Tools: ${ALL_TOOLS.join(', ')}`);
  console.log(`[open-mcp] Auth: none (public)`);
  console.log(`[open-mcp] Marketplace: ${DEXTER_API}${MARKETPLACE_PATH}`);
});
