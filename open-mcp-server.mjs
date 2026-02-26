/**
 * Dexter Open MCP Server — x402 Gateway
 *
 * Public, no-auth MCP server with five tools:
 *   - x402_search: Discover x402 resources in the Dexter marketplace
 *   - x402_pay:    Call any x402 resource with manual payment flow (legacy)
 *   - x402_fetch:  Call any x402 resource with automatic payment
 *   - x402_check:  Preview endpoint pricing without paying
 *   - x402_wallet: Show wallet address and USDC balance
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
const MARKETPLACE_PATH = '/api/facilitator/marketplace/resources';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.dexter.cash/api/solana/rpc';
const USDC_MINT_STR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const WIDGET_DOMAIN = 'https://dexter.cash';
const WIDGET_CSP = {
  resource_domains: ['https://cdn.dexscreener.com', 'https://raw.githubusercontent.com', 'https://metadata.jup.ag', 'https://cdn.jsdelivr.net', 'https://dexter.cash', 'https://api.qrserver.com'],
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
    seller: r.seller?.displayName || null,
    sellerReputation: r.reputationScore ?? null,
  };
}

// ─── Tool: x402_search ──────────────────────────────────────────────────────

async function x402Search({ query, category, network, maxPriceUsdc, verifiedOnly, sort, limit }) {
  const params = new URLSearchParams();
  if (query) params.set('search', query);
  if (category) params.set('category', category);
  if (network) params.set('network', network);
  if (maxPriceUsdc != null) params.set('maxPrice', String(maxPriceUsdc));
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

// ─── Tool: x402_pay ─────────────────────────────────────────────────────────

async function x402Pay({ url, method, body, paymentSignature }) {
  const headers = { 'Content-Type': 'application/json' };

  if (paymentSignature) {
    headers['X-PAYMENT'] = paymentSignature;
  }

  const fetchOptions = { method: method || 'GET', headers };

  if (body && method && method.toUpperCase() !== 'GET') {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(url, fetchOptions);

  // 402 → extract payment requirements for the caller to sign
  if (res.status === 402) {
    let requirements = null;
    let bodyData = null;

    try {
      bodyData = await res.json();
    } catch {
      try { bodyData = await res.text(); } catch {}
    }

    // x402 v1/v2: requirements live in the response body under `accepts`
    if (bodyData?.accepts && Array.isArray(bodyData.accepts)) {
      requirements = {
        accepts: bodyData.accepts,
        x402Version: bodyData.x402Version ?? 1,
      };
    } else {
      // Fallback: check header
      const paymentRequired = res.headers.get('payment-required') || res.headers.get('PAYMENT-REQUIRED');
      if (paymentRequired) {
        try { requirements = JSON.parse(atob(paymentRequired)); } catch {
          try { requirements = JSON.parse(paymentRequired); } catch {
            requirements = { raw: paymentRequired };
          }
        }
      }
    }

    return {
      status: 402,
      message: 'Payment required. Sign the payment with your wallet and call again with paymentSignature.',
      requirements,
      body: bodyData,
    };
  }

  // Success or other status
  const paymentResponse = res.headers.get('payment-response') || res.headers.get('PAYMENT-RESPONSE');
  let settlement = null;
  if (paymentResponse) {
    try { settlement = JSON.parse(atob(paymentResponse)); } catch {
      try { settlement = JSON.parse(paymentResponse); } catch {}
    }
  }

  let responseData;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    try { responseData = await res.json(); } catch { responseData = await res.text(); }
  } else {
    responseData = await res.text();
  }

  return { status: res.status, data: responseData, settlement };
}

// ─── Tool: x402_fetch (auto-pay) ─────────────────────────────────────────────

async function x402Fetch({ url, method, body }) {
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

      return { status: paidRes.status, data, payment: settlement ? { settled: true, details: settlement } : { settled: false } };
    } catch (err) {
      return { status: 402, error: `Payment failed: ${err.message}`, requirements };
    }
  }

  // No wallet — try QR pay session for Solana endpoints
  const firstAccept = accepts?.[0];
  if (firstAccept && String(firstAccept.network || '').includes('solana')) {
    try {
      const sessionRes = await fetch(`${DEXTER_API}/v2/pay/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payTo: firstAccept.payTo,
          amount: String(firstAccept.amount || firstAccept.maxAmountRequired),
          asset: firstAccept.asset,
          feePayer: firstAccept.extra?.feePayer || '',
          resourceUrl: url,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const session = await sessionRes.json();
      if (session.ok) {
        return {
          status: 402,
          mode: 'qr',
          message: 'Scan the QR code with Phantom or Solflare to pay.',
          qr: { solanaPayUrl: session.solanaPayUrl, nonce: session.nonce, expiresAt: session.expiresAt },
          pollUrl: `${DEXTER_API}/v2/pay/status/${session.nonce}`,
          requirements,
        };
      }
    } catch {}
  }

  return { status: 402, message: 'Payment required. Set DEXTER_PRIVATE_KEY to enable auto-pay, or use a Solana wallet to scan the QR code.', requirements };
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

  return { requiresPayment: true, statusCode: 402, x402Version: body?.x402Version ?? 2, paymentOptions, resource: body?.resource };
}

// ─── Tool: x402_wallet ───────────────────────────────────────────────────────

async function x402Wallet() {
  const walletKey = process.env.DEXTER_PRIVATE_KEY || process.env.SOLANA_PRIVATE_KEY;
  if (!walletKey) {
    return { error: 'No wallet configured', tip: 'Set DEXTER_PRIVATE_KEY env var.' };
  }

  const { Connection, PublicKey, Keypair } = await import('@solana/web3.js');
  const { getAssociatedTokenAddress } = await import('@solana/spl-token');
  const bs58 = (await import('bs58')).default;
  const USDC_MINT = new PublicKey(USDC_MINT_STR);

  let keypair;
  try {
    try { keypair = Keypair.fromSecretKey(bs58.decode(walletKey)); }
    catch { keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(walletKey))); }
  } catch {
    return { error: 'Invalid private key format' };
  }

  const address = keypair.publicKey.toBase58();
  let sol = 0, usdc = 0;
  try {
    const conn = new Connection(SOLANA_RPC, 'confirmed');
    sol = (await conn.getBalance(keypair.publicKey).catch(() => 0)) / 1e9;
    try {
      const ata = await getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
      const info = await conn.getTokenAccountBalance(ata);
      usdc = Number(info.value.uiAmount ?? 0);
    } catch { usdc = 0; }
  } catch {}

  return {
    address,
    network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    networkName: 'Solana Mainnet',
    balances: { sol, usdc },
    tip: usdc === 0 ? `Deposit USDC (Solana) to ${address} to start paying for x402 APIs.` : undefined,
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
    description: 'Search the Dexter x402 marketplace for paid API resources. Returns services with pricing, quality scores, verification status, settlement volume, and seller reputation. Use this to discover APIs an agent can pay for and call with x402_fetch.',
    inputSchema: {
      query: z.string().optional().describe('What are you looking for? e.g. "token analysis", "image generation", "video"'),
      category: z.string().optional().describe('Filter by category (e.g. "api", "games", "creative")'),
      network: z.string().optional().describe('Filter by payment network: "solana", "base", "polygon"'),
      maxPriceUsdc: z.number().optional().describe('Maximum price per call in USDC'),
      verifiedOnly: z.boolean().optional().describe('Only return verified (quality-checked) endpoints'),
      sort: z.enum(['relevance', 'quality_score', 'settlements', 'volume', 'recent']).optional().describe('Sort by (default: settlements)'),
      limit: z.number().optional().default(20).describe('Max results (default: 20, max: 50)'),
    },
    annotations: { readOnlyHint: true },
    _meta: SEARCH_META,
  }, async (args) => {
    try {
      const result = await x402Search(args);
      const data = { success: true, count: result.resources.length, resources: result.resources, tip: 'Use x402_fetch to call any of these endpoints.' };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, _meta: SEARCH_META };
    } catch (err) {
      const data = { success: false, count: 0, resources: [], error: err?.message || String(err) };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: SEARCH_META };
    }
  });

  server.registerTool('x402_pay', {
    title: 'x402 Pay (Legacy)',
    description: 'Call any x402-enabled paid API. Two-phase flow: 1. Call without paymentSignature to get payment requirements. 2. Sign the payment, then call again with paymentSignature to execute. Use x402_search to discover endpoints first.',
    inputSchema: {
      url: z.string().url().describe('The x402 resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      body: z.any().optional().describe('Request body (for POST/PUT). Can be object or string.'),
      paymentSignature: z.string().optional().describe('Signed payment from your wallet. Omit on first call to get payment requirements.'),
    },
  }, async (args) => {
    try {
      const result = await x402Pay(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
    }
  });

  server.registerTool('x402_fetch', {
    title: 'x402 Fetch',
    description: 'Call any x402-protected API with automatic payment. If a wallet is configured (DEXTER_PRIVATE_KEY), signs and pays automatically. Otherwise returns a QR code for Solana Pay. Use x402_search to discover endpoints first.',
    inputSchema: {
      url: z.string().url().describe('The x402 resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      body: z.string().optional().describe('JSON request body for POST/PUT'),
    },
    _meta: FETCH_META,
  }, async (args) => {
    try {
      const result = await x402Fetch(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result, _meta: FETCH_META };
    } catch (err) {
      const msg = err.cause?.code === 'ENOTFOUND' ? `Could not reach ${args.url}` : err.message || String(err);
      const data = { status: 500, error: msg };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: FETCH_META };
    }
  });

  server.registerTool('x402_check', {
    title: 'x402 Check',
    description: 'Check if an endpoint requires x402 payment and see its pricing per chain. Does NOT make a payment — just probes for requirements.',
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
    description: 'Show wallet address, USDC balance, and SOL balance. The wallet is used to automatically pay for x402 API calls via x402_fetch.',
    annotations: { readOnlyHint: true },
    _meta: WALLET_META,
  }, async () => {
    try {
      const result = await x402Wallet();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result, _meta: WALLET_META };
    } catch (err) {
      const data = { error: err?.message || String(err) };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true, _meta: WALLET_META };
    }
  });

  // ─── Widget Resource Registration (uses same system as authenticated MCP) ──

  try {
    registerAppsSdkResources(server);
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
        'Public x402 gateway. Search, pay, and call any x402 resource. ' +
        'Five tools, no authentication required.',
      version: '1.1.0',
      tools: [
        { name: 'x402_search', description: 'Search the Dexter x402 marketplace for paid API resources.' },
        { name: 'x402_pay', description: 'Call any x402-enabled paid API with manual payment flow.' },
        { name: 'x402_fetch', description: 'Call any x402 API with automatic payment (if wallet configured).' },
        { name: 'x402_check', description: 'Preview endpoint pricing without paying.' },
        { name: 'x402_wallet', description: 'Show wallet address and USDC/SOL balance.' },
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
