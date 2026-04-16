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
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });
import { createOpenSessionResolver } from './lib/open-session-resolution.mjs';
import { X402_WIDGET_URIS } from './apps-sdk/widget-uris.mjs';
import {
  capabilitySearch as coreCapabilitySearch,
  buildSearchResponse,
  buildSearchErrorResponse,
  checkEndpointPricing,
} from '@dexterai/x402-core';

const PORT = parseInt(process.env.OPEN_MCP_PORT || '3931', 10);
const DEXTER_API = (process.env.X402_API_URL || 'https://x402.dexter.cash').replace(/\/+$/, '');
const API_BASE_FALLBACK = (process.env.API_BASE_URL || 'http://127.0.0.1:3030').replace(/\/+$/, '');
/**
 * Capability search endpoint — semantic vector search over the x402 corpus
 * with synonym expansion, similarity floor, strong/related tiering, and
 * cross-encoder LLM rerank. Replaces the legacy substring ranker at
 * `/api/facilitator/marketplace/resources` which was removed from dexter-api
 * on 2026-04-15. The new endpoint handles synonym expansion and ranking
 * server-side, so the local fuzzy-broad fallback + tokenize + levenshtein
 * scoring we used to need is gone.
 */
const CAPABILITY_PATH = '/api/x402gle/capability';
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

const SEARCH_META = widgetMeta(X402_WIDGET_URIS.search, 'Searching marketplace…', 'Results ready', 'Shows paid API search results as interactive cards with quality rings, prices, and fetch buttons.');
const PAY_META = widgetMeta(X402_WIDGET_URIS.fetch, 'Processing payment…', 'Payment complete', 'Shows API response data with payment receipt, transaction link, and settlement status.');
const FETCH_META = widgetMeta(X402_WIDGET_URIS.fetch, 'Calling API…', 'Response received', 'Shows API response data with payment receipt, transaction link, and settlement status.');
const ACCESS_META = widgetMeta(X402_WIDGET_URIS.fetch, 'Signing access proof…', 'Access response ready', 'Shows identity-gated API responses with wallet proof details and any follow-up requirements.');
const CHECK_META = widgetMeta(X402_WIDGET_URIS.pricing, 'Checking pricing…', 'Pricing loaded', 'Shows endpoint pricing per blockchain with payment amounts and a pay button.');
const WALLET_META = widgetMeta(X402_WIDGET_URIS.wallet, 'Loading wallet…', 'Wallet loaded', 'Shows wallet addresses with copy button, USDC balances across chains, and deposit QR code.');

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

// formatResource now comes from @dexterai/x402-core — the canonical shared package.
// See import at top of file. The Open MCP's old 40-field version had consumer-specific
// fields (sellerMeta, sellerReputation, authRequired, sessionCompatible, priceAtomic,
// verificationNotes, verificationFixInstructions) that are now all part of the canonical
// FormattedResource type in x402-core.

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

function logX402SearchDebug(stage, details = {}) {
  try {
    console.log(`[x402_search] ${stage} ${JSON.stringify(details)}`);
  } catch {
    console.log(`[x402_search] ${stage}`);
  }
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

// fetchCapabilitySearch + x402Search now use @dexterai/x402-core

// ─── Tool: x402_search ──────────────────────────────────────────────────────

/**
 * Semantic capability search via @dexterai/x402-core.
 * All HTTP logic, formatting, and response building comes from the shared package.
 */
async function x402Search({ query, limit, unverified, testnets, rerank }) {
  const rawQuery = typeof query === 'string' ? query.trim() : '';
  logX402SearchDebug('start', {
    rawQuery,
    limit: limit ?? 20,
    unverified: Boolean(unverified),
    testnets: Boolean(testnets),
    rerank: rerank !== false,
  });

  if (!rawQuery) {
    const empty = buildSearchErrorResponse('Query was empty — pass a natural-language capability description.');
    logX402SearchDebug('result', { rawQuery, mode: 'empty', count: 0 });
    return empty;
  }

  const endpoint = `${DEXTER_API}${CAPABILITY_PATH}`;
  const searchResult = await coreCapabilitySearch({
    query: rawQuery,
    limit,
    unverified,
    testnets,
    rerank,
    endpoint,
  });

  const response = buildSearchResponse(searchResult);

  logX402SearchDebug('result', {
    rawQuery,
    mode: response.searchMeta.mode,
    strongCount: response.strongCount,
    relatedCount: response.relatedCount,
    topSimilarity: response.topSimilarity,
    rerankApplied: response.rerank.applied,
  });

  return response;
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

      const { getSponsoredRecommendations, fireImpressionBeacon } = await import('@dexterai/x402/client');
      const sponsoredRecs = getSponsoredRecommendations(paidRes);
      if (sponsoredRecs) fireImpressionBeacon(paidRes).catch(() => {});

      const result = {
        status: paidRes.status,
        mode: paidRes.ok ? 'session_ready' : 'session_error',
        data,
        payment: settlement ? { settled: true, details: settlement } : { settled: false },
        merchantSettlement: buildMerchantSettlement(requirements),
      };
      if (sponsoredRecs?.length) {
        result.recommendations = sponsoredRecs;
        result._recommendations_hint = `Sponsored: ${sponsoredRecs.map(r => `${r.sponsor} — ${r.description} (${r.resourceUrl})`).join('; ')}. Call with x402_fetch if relevant.`;
      }
      return result;
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
      const sessionResult = {
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
      const bodySponsored = openBody.data?._x402_sponsored;
      if (Array.isArray(bodySponsored) && bodySponsored.length > 0) {
        sessionResult.recommendations = bodySponsored;
        sessionResult._recommendations_hint = `Sponsored: ${bodySponsored.map(r => `${r.sponsor} — ${r.description} (${r.resourceUrl})`).join('; ')}. Call with x402_fetch if relevant.`;
      }
      return sessionResult;
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

// x402_check now uses checkEndpointPricing from @dexterai/x402-core — see import above.

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

// ─── Server instructions + skill resources ──────────────────────────────────

// The opendexter-ide repo lives alongside dexter-mcp under ~/websites/.
// If the repo is there, expose skill files as readable resources.
// If not, degrade gracefully — instructions still work, resources return an error.
const SKILLS_ROOT = (() => {
  try {
    const candidate = join(dirname(fileURLToPath(import.meta.url)),
      '..', 'opendexter-ide', 'opendexter-plugin', 'skills');
    readFileSync(join(candidate, 'opendexter', 'SKILL.md'), 'utf-8');
    return candidate;
  } catch {
    return null;
  }
})();

const SERVER_INSTRUCTIONS = `You are connected to the Dexter x402 Gateway — a public MCP server for searching and paying for x402 APIs.

Tools (use in this order):
1. x402_search — Semantic search over thousands of paid APIs. Pass a natural-language query (e.g. "ETH price feed", "generate an image"). Returns strongResults (high-confidence) and relatedResults (adjacent). Do NOT pre-filter by chain or category — the ranker handles expansion internally.
2. x402_check — Probe an endpoint for pricing per chain without paying. Use before first paid call.
3. x402_fetch — Call any x402 endpoint with automatic USDC payment. Returns the API response + settlement receipt.
4. x402_pay — Alias for x402_fetch.
5. x402_access — Access identity-gated endpoints with wallet proof (Sign-In-With-X) instead of payment.
6. x402_wallet — Create or resume a multi-chain session. Shows deposit addresses and USDC balances across Solana, Base, Polygon, Arbitrum, Optimism, Avalanche.

Workflows:
- "Find an API for X" → x402_search → present results with prices/scores → x402_check to confirm → x402_fetch to call
- "Call this URL" → x402_check first → x402_fetch
- "Check my balance" → x402_wallet

Key facts:
- Supported chains for session funding: Solana, Base, Polygon, Arbitrum, Optimism, Avalanche (the facilitator additionally supports BSC and SKALE Base for paid calls)
- Most endpoints cost $0.01–$0.10/call
- Quality scores: 90-100 excellent, 75-89 good, 50-74 mediocre, <50 untested
- If wallet has no USDC, check x402_wallet first and tell the user to fund
- Search is semantic — typos and synonyms handled. Describe what you want in plain English.
- After a successful paid call, link the transaction hash to the appropriate explorer (Solscan for Solana, Basescan for Base, Polygonscan, Arbiscan, Optimistic Etherscan, Snowtrace for Avalanche)

Read docs://opendexter/workflow, docs://opendexter/protocol, or docs://opendexter/debugging for deeper reference.`;

function createOpenMcpServer() {
  const server = new McpServer({
    name: 'Dexter x402 Gateway',
    version: '1.0.0',
  }, {
    instructions: SERVER_INSTRUCTIONS,
  });

  // ─── Skill-file resources (read from opendexter-ide repo on disk) ──────────

  const SKILL_RESOURCES = [
    { name: 'workflow', uri: 'docs://opendexter/workflow', file: 'opendexter/SKILL.md', description: 'OpenDexter tool reference — search → check → fetch workflow, parameter tables, quality scores, tips' },
    { name: 'protocol', uri: 'docs://opendexter/protocol', file: 'x402-protocol/SKILL.md', description: 'x402 v2 protocol specification — payment flow, core types, CAIP-2 networks, error codes, transport layers' },
    { name: 'debugging', uri: 'docs://opendexter/debugging', file: 'x402-debugging/SKILL.md', description: 'x402 payment debugging — facilitator health, error code reference, common issues and fixes' },
  ];

  for (const res of SKILL_RESOURCES) {
    server.resource(res.name, res.uri, { description: res.description, mimeType: 'text/markdown' }, async () => {
      if (!SKILLS_ROOT) {
        return { contents: [{ uri: res.uri, mimeType: 'text/markdown', text: `Resource unavailable — skills directory not found on this server.` }] };
      }
      try {
        const content = readFileSync(join(SKILLS_ROOT, res.file), 'utf-8');
        return { contents: [{ uri: res.uri, mimeType: 'text/markdown', text: content }] };
      } catch (err) {
        return { contents: [{ uri: res.uri, mimeType: 'text/markdown', text: `Failed to read ${res.file}: ${err?.message}` }] };
      }
    });
  }

  server.registerTool('x402_search', {
    title: 'x402 Search',
    description: 'Semantic capability search over the x402 marketplace across Solana and EVM chains. Pass a natural-language query and get back two tiers: strongResults (high-confidence capability hits) and relatedResults (adjacent services that cleared the similarity floor). The ranker handles synonym expansion and alternate phrasings internally — do NOT pre-filter by chain or category. The top strong results are reordered by a cross-encoder LLM rerank unless rerank:false is passed. Use the searchMeta.mode field to distinguish a direct hit (strong matches present) from related_only (only adjacencies) or empty (nothing in the index). Multi-chain resources expose every payment option they accept via each result\'s chains[] field.',
    inputSchema: {
      query: z.string().describe('Natural-language description of the capability you want. e.g. "check wallet balance on Base", "generate an image", "ETH spot price feed", "translate text". Broad terms are valid — the ranker handles breadth internally. Do NOT pre-filter by chain or category; the search layer handles those semantically.'),
      limit: z.number().min(1).max(50).optional().default(20).describe('Max results across strong + related tiers combined (1-50, default 20)'),
      unverified: z.boolean().optional().describe('Include unverified resources (default false). Leave unset unless the user explicitly wants to see unverified endpoints.'),
      testnets: z.boolean().optional().describe('Include testnet-only resources (default false). Testnets are excluded by default to keep the marketplace view clean.'),
      rerank: z.boolean().optional().describe('Cross-encoder LLM rerank of top strong results (default true). Set false for deterministic order or lowest-latency path.'),
    },
    annotations: { readOnlyHint: true },
    _meta: SEARCH_META,
  }, async (args) => {
    try {
      const data = await x402Search(args);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, _meta: SEARCH_META };
    } catch (err) {
      const data = buildSearchErrorResponse(err?.message || String(err));
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
      const result = await checkEndpointPricing(args);
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
        X402_WIDGET_URIS.search,
        X402_WIDGET_URIS.fetch,
        X402_WIDGET_URIS.pricing,
        X402_WIDGET_URIS.wallet,
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
        { name: 'x402_search', description: 'Semantic capability search over the x402 marketplace. Returns tiered results (strong + related) with cross-encoder LLM rerank.' },
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
  console.log(`[open-mcp] Capability search: ${DEXTER_API}${CAPABILITY_PATH}`);
});
