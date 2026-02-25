/**
 * Dexter Open MCP Server — x402 Gateway
 *
 * Public, no-auth MCP server with two tools:
 *   - x402_search: Discover x402 resources in the Dexter marketplace
 *   - x402_pay:    Call any x402 resource with the payment flow
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

// ─── MCP Server Setup ───────────────────────────────────────────────────────

function createOpenMcpServer() {
  const server = new McpServer({
    name: 'Dexter x402 Gateway',
    version: '1.0.0',
  });

  server.tool(
    'x402_search',
    'Search the Dexter x402 marketplace for paid API resources. ' +
    'Returns services with pricing, quality scores, verification status, ' +
    'settlement volume, and seller reputation. Use this to discover APIs ' +
    'an agent can pay for and call with x402_pay.',
    {
      query: z.string().optional().describe('What are you looking for? e.g. "token analysis", "image generation", "video"'),
      category: z.string().optional().describe('Filter by category (e.g. "api", "games", "creative")'),
      network: z.string().optional().describe('Filter by payment network: "solana", "base", "polygon"'),
      maxPriceUsdc: z.number().optional().describe('Maximum price per call in USDC'),
      verifiedOnly: z.boolean().optional().describe('Only return verified (quality-checked) endpoints'),
      sort: z.enum(['relevance', 'quality_score', 'settlements', 'volume', 'recent']).optional()
        .describe('Sort by (default: relevance when searching, settlements otherwise)'),
      limit: z.number().optional().default(20).describe('Max results (default: 20, max: 50)'),
    },
    async (args) => {
      try {
        const result = await x402Search(args);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              count: result.resources.length,
              resources: result.resources,
              source: 'Dexter x402 Marketplace (https://dexter.cash)',
              tip: 'Use x402_pay to call any of these endpoints.',
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    },
  );

  server.tool(
    'x402_pay',
    'Call any x402-enabled paid API. Two-phase flow:\n' +
    '1. Call without paymentSignature → returns payment requirements (price, network, payTo address).\n' +
    '2. Sign the payment with your wallet, then call again with paymentSignature to execute.\n\n' +
    'Use x402_search to discover available endpoints first.',
    {
      url: z.string().url().describe('The x402 resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      body: z.any().optional().describe('Request body (for POST/PUT). Can be object or string.'),
      paymentSignature: z.string().optional().describe('Signed payment from your wallet. Omit on first call to get payment requirements.'),
    },
    async (args) => {
      try {
        const result = await x402Pay(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    },
  );

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
      tools: ['x402_search', 'x402_pay'],
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
        'Public x402 gateway. Search and pay for any x402 resource ' +
        'through two MCP tools. No authentication required.',
      version: '1.0.0',
      tools: [
        {
          name: 'x402_search',
          description: 'Search the Dexter x402 marketplace for paid API resources.',
        },
        {
          name: 'x402_pay',
          description: 'Call any x402-enabled paid API with payment handling.',
        },
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
  console.log(`[open-mcp] Tools: x402_search, x402_pay`);
  console.log(`[open-mcp] Auth: none (public)`);
  console.log(`[open-mcp] Marketplace: ${DEXTER_API}${MARKETPLACE_PATH}`);
});
