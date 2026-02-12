/**
 * Dexter Open MCP Server — x402 Gateway
 *
 * Public, no-auth MCP server with two tools:
 *   - x402_search: Discover x402 resources in the Dexter marketplace
 *   - x402_pay:    Call any x402 resource with proper payment flow
 *
 * This is completely separate from the authenticated MCP server
 * (http-server-oauth.mjs). It shares no state, no sessions, no auth.
 *
 * Usage:
 *   PORT=3931 node open-mcp-server.mjs
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
const DEXTER_API = process.env.DEXTER_API_URL || 'https://api.dexter.cash';

// ─── Tool: x402_search ──────────────────────────────────────────────────────

async function x402Search({ query, category, maxPriceUsdc, limit }) {
  const params = new URLSearchParams();
  if (query) params.set('search', query);
  if (category) params.set('category', category);
  if (maxPriceUsdc) params.set('maxPrice', String(maxPriceUsdc));
  params.set('limit', String(limit || 20));
  params.set('sort', 'quality_score');
  params.set('order', 'desc');

  const url = `${DEXTER_API}/api/facilitator/marketplace/resources?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { error: `Marketplace API returned ${res.status}`, results: [] };
  }

  const data = await res.json();
  const resources = (data.resources || []).map((r) => ({
    name: r.displayName || r.resourceUrl,
    description: r.description || '',
    url: r.resourceUrl,
    method: r.method || 'GET',
    priceUsdc: r.priceUsdc,
    priceLabel: r.priceLabel,
    category: r.category || '',
    qualityScore: r.qualityScore,
    verificationStatus: r.verificationStatus,
    totalSettlements: r.totalSettlements,
    totalVolumeUsdc: r.totalVolumeUsdc,
    payTo: r.payTo,
    seller: r.seller?.displayName || null,
    reputationScore: r.reputationScore,
  }));

  return {
    count: resources.length,
    results: resources,
  };
}

// ─── Tool: x402_pay ─────────────────────────────────────────────────────────

async function x402Pay({ url, method, body, paymentSignature }) {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Phase 2: caller provided a signed payment — attach it and execute
  if (paymentSignature) {
    headers['Payment-Signature'] = paymentSignature;
  }

  const fetchOptions = {
    method: method || 'GET',
    headers,
  };

  if (body && method && method.toUpperCase() !== 'GET') {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(url, fetchOptions);

  // Phase 1: resource returned 402 — extract payment requirements for the caller
  if (res.status === 402) {
    const paymentRequired = res.headers.get('payment-required') || res.headers.get('PAYMENT-REQUIRED');
    const xQuoteHash = res.headers.get('x-quote-hash');

    let requirements = null;
    if (paymentRequired) {
      try {
        requirements = JSON.parse(atob(paymentRequired));
      } catch {
        // Try parsing as plain JSON
        try {
          requirements = JSON.parse(paymentRequired);
        } catch {
          requirements = { raw: paymentRequired };
        }
      }
    }

    // Also try reading requirements from response body
    let bodyData = null;
    try {
      bodyData = await res.json();
    } catch {
      try {
        bodyData = await res.text();
      } catch {}
    }

    return {
      status: 402,
      message: 'Payment required. Sign the payment with your wallet and call again with paymentSignature.',
      requirements,
      quoteHash: xQuoteHash,
      body: bodyData,
    };
  }

  // Success or other status — return the response
  const paymentResponse = res.headers.get('payment-response') || res.headers.get('PAYMENT-RESPONSE');
  let settlement = null;
  if (paymentResponse) {
    try {
      settlement = JSON.parse(atob(paymentResponse));
    } catch {
      try {
        settlement = JSON.parse(paymentResponse);
      } catch {}
    }
  }

  let responseData;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    try {
      responseData = await res.json();
    } catch {
      responseData = await res.text();
    }
  } else {
    responseData = await res.text();
  }

  return {
    status: res.status,
    data: responseData,
    settlement,
  };
}

// ─── MCP Server Setup ───────────────────────────────────────────────────────

function createOpenMcpServer() {
  const server = new McpServer({
    name: 'Dexter x402 Gateway',
    version: '1.0.0',
  });

  server.tool(
    'x402_search',
    'Search the Dexter x402 marketplace for paid API resources. Returns available services with descriptions, prices, and URLs.',
    {
      query: z.string().describe('What are you looking for? e.g. "token analysis", "image generation", "sentiment"'),
      category: z.string().optional().describe('Filter by category'),
      maxPriceUsdc: z.number().optional().describe('Maximum price per call in USDC'),
      limit: z.number().optional().default(20).describe('Max results to return'),
    },
    async ({ query, category, maxPriceUsdc, limit }) => {
      try {
        const result = await x402Search({ query, category, maxPriceUsdc, limit });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    },
  );

  server.tool(
    'x402_pay',
    'Call any x402 paid resource. First call without paymentSignature to get the price and payment requirements. Then sign the payment with your wallet and call again with paymentSignature to execute and get the result.',
    {
      url: z.string().url().describe('The x402 resource URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
      body: z.any().optional().describe('Request body (for POST/PUT)'),
      paymentSignature: z.string().optional().describe('Signed payment from your wallet. Omit on first call to get payment requirements.'),
    },
    async ({ url, method, body, paymentSignature }) => {
      try {
        const result = await x402Pay({ url, method, body, paymentSignature });
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
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // MCP manifest
  if (url.pathname === '/.well-known/mcp.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Dexter x402 Gateway',
      url: `https://open.dexter.cash/mcp`,
      description: 'Public x402 gateway. Search and pay for any x402 resource through two MCP tools. No authentication required.',
      version: '1.0.0',
    }));
    return;
  }

  // Only handle /mcp and root
  if (url.pathname !== '/' && url.pathname !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // ─── GET: SSE or session resume ────────────────────────────────────────
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

  // ─── POST: MCP JSON-RPC ───────────────────────────────────────────────
  if (req.method === 'POST') {
    const sessionId = req.headers['mcp-session-id'];

    if (sessionId && transports.has(sessionId)) {
      // Existing session
      const transport = transports.get(sessionId);
      await transport.handleRequest(req, res);
      return;
    }

    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports.set(sid, transport);
        console.log(`[open-mcp] Session created: ${sid}`);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        transports.delete(sid);
        console.log(`[open-mcp] Session closed: ${sid}`);
      }
    };

    const mcpServer = createOpenMcpServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  // ─── DELETE: close session ─────────────────────────────────────────────
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

httpServer.listen(PORT, () => {
  console.log(`[open-mcp] Dexter x402 Gateway listening on port ${PORT}`);
  console.log(`[open-mcp] Tools: x402_search, x402_pay`);
  console.log(`[open-mcp] Auth: none (public)`);
});
