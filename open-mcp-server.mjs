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

const PORT = parseInt(process.env.OPEN_MCP_PORT || '3931', 10);
const DEXTER_API = (process.env.X402_API_URL || 'https://x402.dexter.cash').replace(/\/+$/, '');
const API_BASE_FALLBACK = (process.env.API_BASE_URL || 'http://127.0.0.1:3030').replace(/\/+$/, '');
const MARKETPLACE_PATH = '/api/facilitator/marketplace/resources';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.dexter.cash/api/solana/rpc';
const USDC_MINT_STR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
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

const SEARCH_META = widgetMeta('ui://dexter/x402-marketplace-search', 'Searching marketplace…', 'Results ready', 'Shows paid API search results as interactive cards with quality rings, prices, and fetch buttons.');
const FETCH_META = widgetMeta('ui://dexter/x402-fetch-result', 'Calling API…', 'Response received', 'Shows API response data with payment receipt, transaction link, and settlement status.');
const CHECK_META = widgetMeta('ui://dexter/x402-pricing', 'Checking pricing…', 'Pricing loaded', 'Shows endpoint pricing per blockchain with payment amounts and a pay button.');
const WALLET_META = widgetMeta('ui://dexter/x402-wallet', 'Loading wallet…', 'Wallet loaded', 'Shows wallet address with copy button, USDC/SOL balances, and deposit QR code.');

const ALL_TOOLS = ['x402_search', 'x402_pay', 'x402_fetch', 'x402_check', 'x402_wallet'];
const OPEN_SESSION_HINTS = new Map();
const OPEN_SESSION_CONTEXT = new Map();
const OPEN_SESSION_HINT_TTL_MS = 30 * 60 * 1000;

// Set env vars required by registerAppsSdkResources before importing it
if (!process.env.TOKEN_AI_MCP_PUBLIC_URL) process.env.TOKEN_AI_MCP_PUBLIC_URL = 'https://open.dexter.cash/mcp';
if (!process.env.TOKEN_AI_WIDGET_DOMAIN) process.env.TOKEN_AI_WIDGET_DOMAIN = 'https://dexter.cash';
if (!process.env.TOKEN_AI_APPS_SDK_ASSET_BASE) process.env.TOKEN_AI_APPS_SDK_ASSET_BASE = 'https://dexter.cash/mcp/app-assets/assets';

import { registerAppsSdkResources } from './apps-sdk/register.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(r) {
  if (r.priceLabel) return r.priceLabel;
  if (r.priceUsdc != null) return `$${Number(r.priceUsdc).toFixed(2)}`;
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
    totalCalls: r.totalSettlements ?? 0,
    totalVolume: r.totalVolumeUsdc != null ? `$${Number(r.totalVolumeUsdc).toLocaleString()}` : null,
    seller: r.seller?.displayName || 'Independent',
    sellerReputation: r.reputationScore ?? null,
    authRequired: Boolean(r.authRequired),
    authType: r.authType || null,
    authHint: r.authHint || null,
    sessionCompatible: !r.priceNetwork || r.priceNetwork === 'solana' || (r.priceNetwork || '').startsWith('solana:'),
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

function rememberOpenSessionHint(session) {
  const token = session?.sessionToken;
  if (!token) return;
  OPEN_SESSION_HINTS.set(token, {
    sessionId: session.sessionId || null,
    sessionToken: token,
    funding: normalizeSessionFunding(session.funding),
    expiresAt: session.expiresAt || null,
    createdAt: Date.now(),
  });
}

function extractMcpSessionId(extra) {
  const headerSources = [
    extra?.requestInfo?.headers,
    extra?.httpRequest?.headers,
    extra?.request?.headers,
  ].filter(Boolean);
  for (const headers of headerSources) {
    const value = headers?.['mcp-session-id'] || headers?.['Mcp-Session-Id'] || headers?.['MCP-SESSION-ID'];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function linkSessionToContext(extra, sessionToken) {
  if (!sessionToken) return;
  const sessionId = extractMcpSessionId(extra);
  if (sessionId) OPEN_SESSION_CONTEXT.set(sessionId, sessionToken);
}

function readOpenSessionHint(sessionToken) {
  const hint = OPEN_SESSION_HINTS.get(sessionToken);
  if (!hint) return null;
  if (Date.now() - hint.createdAt > OPEN_SESSION_HINT_TTL_MS) {
    OPEN_SESSION_HINTS.delete(sessionToken);
    return null;
  }
  return {
    sessionId: hint.sessionId,
    sessionToken: hint.sessionToken,
    funding: hint.funding,
    expiresAt: hint.expiresAt,
  };
}

function readContextSessionHint(extra) {
  const mcpSessionId = extractMcpSessionId(extra);
  if (!mcpSessionId) return null;
  const token = OPEN_SESSION_CONTEXT.get(mcpSessionId);
  if (!token) return null;
  const hint = readOpenSessionHint(token);
  if (!hint) {
    OPEN_SESSION_CONTEXT.delete(mcpSessionId);
    return null;
  }
  return hint;
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

async function createOpenSession(targetFundingAtomic, sessionKey) {
  const bases = [DEXTER_API, API_BASE_FALLBACK].filter(Boolean);
  const paths = ['/v2/open/session/create', '/v2/pay/open/session/create'];
  for (const base of bases) {
    for (const path of paths) {
      const sessionRes = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetFundingAtomic,
          sessionKey: sessionKey || undefined,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const sessionBody = await sessionRes.json().catch(() => null);
      if (sessionRes.status === 404) continue;
      if (sessionRes.ok && sessionBody?.ok) return sessionBody;
      return null;
    }
  }
  return null;
}

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

  if (sessionToken) {
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
              sessionToken,
              url,
              method: method || 'GET',
              body: fetchOpts.body ?? null,
              requestId: randomUUID(),
            }),
            signal: AbortSignal.timeout(30000),
          });
          const parsed = await attempt.json().catch(() => null);
          if (attempt.status !== 404) {
            openRes = attempt;
            openBody = parsed;
            break;
          }
        }
        if (openRes) break;
      }

      if (!openRes || !openRes.ok || !openBody?.ok) {
        console.error(`[open-mcp] x402_fetch API failed: status=${openRes?.status} ok=${openBody?.ok} error=${openBody?.error} url=${url}`, JSON.stringify(openBody)?.slice(0, 500));
        const sessionHint = sessionToken ? readOpenSessionHint(sessionToken) : null;
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
            session: sessionHint ? { ...sessionHint, state: openBody?.state || 'pending_funding' } : {
              sessionToken,
              state: openBody?.state || 'pending_funding',
            },
            details: openBody || null,
          };
        }
        return {
          status: openRes?.status || 500,
          mode: 'session_error',
          error: openBody?.error || 'open_session_fetch_failed',
          details: openBody || null,
          requirements,
          merchantSettlement: buildMerchantSettlement(requirements),
        };
      }
      if (openBody?.session?.sessionToken) {
        rememberOpenSessionHint(openBody.session);
        linkSessionToContext(extra, openBody.session.sessionToken);
      } else if (sessionToken) {
        linkSessionToContext(extra, sessionToken);
      }
      return {
        status: openBody.status ?? 200,
        mode: openBody.paid ? 'session_ready' : 'session_error',
        data: openBody.data,
        payment: openBody.payment?.settlement
          ? { settled: true, details: openBody.payment.settlement }
          : { settled: Boolean(openBody.paid) },
        session: { ...(openBody.session ?? { sessionToken }), funding: undefined },
        sessionFunding: normalizeSessionFunding(openBody.session?.funding || readOpenSessionHint(sessionToken)?.funding),
        merchantSettlement: buildMerchantSettlement(requirements),
      };
    } catch (err) {
      console.error(`[open-mcp] x402_fetch exception: url=${url} error=${err?.message || String(err)}`, err?.stack || '');
      return {
        status: 500,
        mode: 'session_error',
        error: `Open canonical fetch failed: ${err?.message || String(err)}`,
        requirements,
        merchantSettlement: buildMerchantSettlement(requirements),
      };
    }
  }

  const firstAccept = Array.isArray(accepts) ? accepts[0] : null;
  const baseAtomic = firstAccept ? Number(firstAccept.maxAmountRequired || firstAccept.amount || 0) : 0;
  const suggestedAtomic = Number.isFinite(baseAtomic) && baseAtomic > 0
    ? String(Math.max(baseAtomic * 10, 1_000_000))
    : '1000000';
  try {
    const sessionBody = await createOpenSession(suggestedAtomic, sessionKey || extractMcpSessionId(extra));
    if (sessionBody?.ok) {
      rememberOpenSessionHint(sessionBody);
      linkSessionToContext(extra, sessionBody.sessionToken);
      return {
        status: 402,
        mode: 'session_required',
        message: 'OpenDexter requires an anonymous funded spend session for canonical x402 fetch.',
        requirements,
        merchantSettlement: buildMerchantSettlement(requirements),
        sessionFunding: normalizeSessionFunding(sessionBody.funding),
        session: sessionBody,
      };
    }
  } catch {}

  return {
    status: 402,
    mode: 'session_required',
    message: 'Payment required. Create or provide a funded OpenDexter session token.',
    requirements,
    merchantSettlement: buildMerchantSettlement(requirements),
  };
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

async function resolveSessionByToken(sessionToken) {
  const bases = [DEXTER_API, API_BASE_FALLBACK].filter(Boolean);
  const paths = ['/v2/open/session/resolve', '/v2/pay/open/session/resolve'];
  for (const base of bases) {
    for (const path of paths) {
      try {
        const res = await fetch(`${base}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ sessionToken }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const body = await res.json().catch(() => null);
          if (body?.ok && body.sessionId) return body;
        }
        if (res.status === 404) return null;
      } catch {}
    }
  }
  return null;
}

async function x402Wallet(args, extra) {
  let session = args?.sessionToken ? readOpenSessionHint(args.sessionToken) : readContextSessionHint(extra);
  if (session && args?.sessionToken) linkSessionToContext(extra, args.sessionToken);

  // If hint not in memory but token was provided, try resolving from dexter-api (DB-backed)
  if (!session && args?.sessionToken) {
    const resolved = await resolveSessionByToken(args.sessionToken);
    if (resolved) {
      session = {
        sessionId: resolved.sessionId,
        sessionToken: args.sessionToken,
        funding: resolved.funding || null,
        expiresAt: resolved.expiresAt || null,
      };
      rememberOpenSessionHint({ ...session, ...resolved });
      linkSessionToContext(extra, args.sessionToken);
    }
  }

  // No token provided and no context hint -- create a new session
  if (!session) {
    const sessionBody = await createOpenSession('1000000', extractMcpSessionId(extra));
    if (sessionBody?.ok) {
      rememberOpenSessionHint(sessionBody);
      linkSessionToContext(extra, sessionBody.sessionToken);
      session = {
        sessionId: sessionBody.sessionId,
        sessionToken: sessionBody.sessionToken,
        funding: sessionBody.funding || null,
        expiresAt: sessionBody.expiresAt || null,
      };
    }
  }

  if (!session) {
    return {
      error: 'session_unavailable',
      mode: 'session_error',
      message: 'Could not initialize an OpenDexter spend session.',
    };
  }

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
  const walletAddress = funding?.walletAddress || liveState?.funding?.walletAddress || session.funding?.walletAddress || null;

  return {
    mode: state === 'active' || state === 'depleted' ? 'session_ready' : 'session_required',
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    state,
    address: walletAddress,
    network: 'solana',
    networkName: 'Solana',
    sessionFunding: funding,
    balances: {
      usdc: usdcAvailable,
      sol: 0,
      fundedAtomic: String(fundedAtomic),
      spentAtomic: String(spentAtomic),
      availableAtomic: String(availableAtomic),
    },
    expiresAt: liveState?.expiresAt || session.expiresAt || null,
    tip: state === 'active'
      ? 'Session is funded and ready. Use x402_fetch or x402_pay to call paid APIs.'
      : state === 'depleted'
        ? 'Session balance exhausted. Fund again or create a new session.'
        : 'Fund the session via txUrl or solanaPayUrl. OpenDexter will then settle merchant payments automatically.',
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
    description: 'Search the Dexter x402 marketplace for paid API resources. If exact matches are empty, automatically retries with a broad scan and returns closest related results with explicit fallback metadata.',
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
    description: 'Alias for x402_fetch. Prefer x402_fetch for all paid API calls. This tool exists for backward compatibility and returns identical results.',
    inputSchema: {
      url: z.string().url().describe('The x402 resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      body: z.any().optional().describe('Request body (for POST/PUT). Can be object or string.'),
      sessionToken: z.string().optional().describe('Anonymous OpenDexter session token for canonical x402 settlement when no local key is configured.'),
      sessionKey: z.string().optional().describe('Optional stable session key for reusable OpenDexter sessions (for example, caller-hash on phone).'),
    },
  }, async (args, extra) => {
    try {
      const result = await x402Pay(args, extra);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
    }
  });

  server.registerTool('x402_fetch', {
    title: 'x402 Fetch',
    description: 'Call any x402-protected API with canonical x402 settlement using an anonymous OpenDexter session token. sessionFunding fields are for user top-up; merchantSettlement.payTo is destination settled by the session.',
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
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result, _meta: FETCH_META };
    } catch (err) {
      const msg = err.cause?.code === 'ENOTFOUND' ? `Could not reach ${args.url}` : err.message || String(err);
      const data = { status: 500, error: msg };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: FETCH_META };
    }
  });

  server.registerTool('x402_check', {
    title: 'x402 Check',
    description: 'Check if an endpoint requires x402 payment. Returns pricing per chain, input/output schema, and payment requirements. Does NOT make a payment.',
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

  server.registerTool('x402_wallet', {
    title: 'x402 Wallet',
    description: 'OpenDexter session dashboard. Returns or creates the active anonymous spend session, including funding rails and current session balance state.',
    inputSchema: {
      sessionToken: z.string().optional().describe('Pass an existing session token to check its status and balance instead of creating a new session.'),
    },
    annotations: { readOnlyHint: true },
    _meta: WALLET_META,
  }, async (args, extra) => {
    try {
      const result = await x402Wallet(args, extra);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result, _meta: WALLET_META };
    } catch (err) {
      const data = { error: err?.message || String(err) };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: WALLET_META };
    }
  });

  // ─── Widget Resource Registration (uses same system as authenticated MCP) ──

  try {
    registerAppsSdkResources(server, {
      allowedTemplateUris: [
        'ui://dexter/x402-marketplace-search',
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
        { name: 'x402_search', description: 'Search paid APIs with exact+fallback matching and explicit search metadata.' },
        { name: 'x402_pay', description: 'Canonical x402 pay-and-call flow (same execution path as x402_fetch).' },
        { name: 'x402_fetch', description: 'Call any x402 API with canonical settlement via funded OpenDexter session (or local key if configured).' },
        { name: 'x402_check', description: 'Preview endpoint pricing without paying.' },
        { name: 'x402_wallet', description: 'Create/read active anonymous spend session and funding rails.' },
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
