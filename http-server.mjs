#!/usr/bin/env node
// MCP Streamable HTTP server with optional bearer auth and CORS

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { buildMcpServer } from './common.mjs';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import dotenv from 'dotenv';
import path from 'node:path';

// Ensure env vars are loaded from Dexter repo root, legacy token-ai/.env, and local MCP folder
try {
  const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname));
  const ALPHA_ROOT = path.resolve(HERE, '..');
  const REPO_ROOT = path.resolve(ALPHA_ROOT, '..');
  const LEGACY_TOKEN_AI = path.join(REPO_ROOT, 'token-ai');
  dotenv.config({ path: path.join(REPO_ROOT, '.env') });
  dotenv.config({ path: path.join(LEGACY_TOKEN_AI, '.env') });
  dotenv.config({ path: path.join(HERE, '.env') });
} catch {}

const PORT = Number(process.env.TOKEN_AI_MCP_PORT || 3930);
const TOKEN = process.env.TOKEN_AI_MCP_TOKEN || '';
const CORS_ORIGIN = process.env.TOKEN_AI_MCP_CORS || '*';

// Keep transports per session
const transports = new Map(); // sessionId -> transport
const servers = new Map(); // sessionId -> McpServer instance

function writeCors(res){
  try {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  } catch {}
}

function unauthorized(res){
  writeCors(res);
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc:'2.0', error:{ code:-32000, message:'Unauthorized' }, id:null }));
}

// Some MCP clients cannot set custom headers when using built-in bearer auth fields.
// Normalize the Accept header so the SDK transport does not reject with 406.
function normalizeAcceptHeader(req){
  try {
    const a = String(req.headers['accept'] || '');
    const hasJson = a.includes('application/json');
    const hasSse = a.includes('text/event-stream');
    if (!hasJson || !hasSse) {
      req.headers['accept'] = 'application/json, text/event-stream';
    }
  } catch {}
}

function isAuthorized(req){
  if (!TOKEN) return true;
  try {
    const h = req.headers || {};
    const auth = String(h['authorization'] || '');
    const xApiKey = String(h['x-api-key'] || '');
    const xAuthorization = String(h['x-authorization'] || '');
    const bearer = `Bearer ${TOKEN}`;
    if (auth === bearer || auth === TOKEN) return true;
    if (xAuthorization === bearer || xAuthorization === TOKEN) return true;
    if (xApiKey === TOKEN) return true;
  } catch {}
  return false;
}

async function readBody(req){
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 4*1024*1024) { reject(new Error('body too large')); } });
    req.on('end', () => {
      if (!data) return resolve(undefined);
      try { resolve(JSON.parse(data)); } catch { resolve(undefined); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    writeCors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    if (url.pathname !== '/mcp') { res.writeHead(404).end('Not Found'); return; }
    // Auth strategy:
    // - For new sessions (no Mcp-Session-Id), require a valid token using Authorization: Bearer <token> or X-Api-Key: <token>
    // - For existing sessions (has Mcp-Session-Id and transport exists), allow without Authorization
    if (TOKEN) {
      const sid = req.headers['mcp-session-id'];
      const hasSession = sid && transports.has(sid);
      if (!hasSession && !isAuthorized(req)) { return unauthorized(res); }
    }
    if (req.method === 'GET') {
      normalizeAcceptHeader(req);
      const sessionId = req.headers['mcp-session-id'];
      if (!sessionId || !transports.has(sessionId)) { res.writeHead(400).end('Invalid or missing session ID'); return; }
      const transport = transports.get(sessionId);
      await transport.handleRequest(req, res);
      return;
    }
    if (req.method === 'POST') {
      normalizeAcceptHeader(req);
      const sessionId = req.headers['mcp-session-id'];
      if (sessionId) {
        const transport = transports.get(sessionId);
        if (!transport) { res.writeHead(400).end(JSON.stringify({ jsonrpc:'2.0', error:{ code:-32000, message:'Bad Request: No valid session ID provided' }, id:null })); return; }
        await transport.handleRequest(req, res, await readBody(req));
        return;
      }
      // New session: initialize (allow per-session toolsets via ?tools=)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => { transports.set(sid, transport); },
        onsessionclosed: (sid) => { transports.delete(sid); const s = servers.get(sid); if (s) { try { s.close(); } catch {} servers.delete(sid); } },
        enableDnsRebindingProtection: false,
      });
      let includeToolsets = undefined;
      try {
        const tools = url.searchParams.get('tools');
        if (tools) includeToolsets = tools;
      } catch {}
      const mcpServer = buildMcpServer({ includeToolsets });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, await readBody(req));
      const sid = transport.sessionId;
      if (sid) servers.set(sid, mcpServer);
      return;
    }
    if (req.method === 'DELETE') {
      res.writeHead(405).end(JSON.stringify({ jsonrpc:'2.0', error:{ code:-32000, message:'Method not allowed' }, id:null }));
      return;
    }
    res.writeHead(405).end('Method not allowed');
  } catch (e) {
    try {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc:'2.0', error:{ code:-32603, message: e?.message || 'Internal error' }, id:null }));
    } catch {}
  }
});

server.listen(PORT, () => {
  console.log(`MCP HTTP listening on http://localhost:${PORT}/mcp`);
});
