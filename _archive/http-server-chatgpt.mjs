#!/usr/bin/env node
// DEPRECATED: Legacy MCP Server for ChatGPT with SSE support
// Archived under alpha/dexter-mcp/_archive/. Dexter uses http-server-oauth.mjs on /mcp for both
// JSON and streaming (Streamable HTTP). This file is kept for reference only.

import http from 'node:http';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.TOKEN_AI_MCP_PORT || 3928);
const CORS_ORIGIN = process.env.TOKEN_AI_MCP_CORS || '*';
const PUBLIC_URL = (process.env.TOKEN_AI_MCP_PUBLIC_URL || 'https://dexter.cash/mcp').replace(/\/$/, '');

// OAuth Configuration
// The SSE transport itself does not perform OAuth; Nginx proxies
// /mcp/sse/{authorize,token,userinfo} to the OAuth server on :3928.
// We keep this flag only to control logging. Discovery endpoints are
// always served regardless of this flag.
const OAUTH_ENABLED = process.env.TOKEN_AI_MCP_OAUTH === 'true';
const GITHUB_CLIENT_ID = process.env.TOKEN_AI_MCP_GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.TOKEN_AI_MCP_GITHUB_CLIENT_SECRET || '';
const ALLOWED_GITHUB_USERS = (process.env.TOKEN_AI_MCP_GITHUB_ALLOWED_USERS || '').split(',').filter(Boolean);
const TOKEN = process.env.TOKEN_AI_MCP_TOKEN || '';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_AI_DIR = path.resolve(HERE, '..');
const REPORTS_DIR = path.join(TOKEN_AI_DIR, 'reports', 'ai-token-analyses');

// OAuth token cache
const tokenCache = new Map();

function writeCors(res){
  try {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  } catch {}
}

async function validateGitHubToken(token) {
  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached.user;
  }
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/user',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MCP-Server'
      }
    };
    
    https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const user = JSON.parse(data);
            tokenCache.set(token, { user: user.login, expires: Date.now() + 300000 });
            
            if (ALLOWED_GITHUB_USERS.length > 0 && !ALLOWED_GITHUB_USERS.includes(user.login)) {
              resolve(null);
            } else {
              resolve(user.login);
            }
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null)).end();
  });
}

async function validateAuth(req) {
  const auth = req.headers['authorization'] || '';
  
  if (OAUTH_ENABLED) {
    if (!auth.startsWith('Bearer ')) return false;
    const token = auth.substring(7);
    const user = await validateGitHubToken(token);
    return !!user;
  } else if (TOKEN) {
    return auth === `Bearer ${TOKEN}`;
  }
  
  return true; // No auth configured
}

// Get recent analysis reports
async function getRecentReports(limit = 20) {
  try {
    const files = await fs.readdir(REPORTS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const fileStats = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(REPORTS_DIR, file);
        const stats = await fs.stat(filePath);
        return { file, mtime: stats.mtime };
      })
    );
    
    fileStats.sort((a, b) => b.mtime - a.mtime);
    return fileStats.slice(0, limit).map(f => f.file);
  } catch {
    return [];
  }
}

// Search through reports
async function searchReports(query) {
  const results = [];
  const files = await getRecentReports(50);
  
  for (const file of files) {
    try {
      const filePath = path.join(REPORTS_DIR, file);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Search in various fields
      const searchText = JSON.stringify(data).toLowerCase();
      if (searchText.includes(query.toLowerCase())) {
        const mint = file.replace('.json', '');
        results.push({
          id: mint,
          title: data.symbol || data.name || mint.substring(0, 8) + '...',
          text: data.summary?.substring(0, 200) || 'Token analysis report',
          url: `https://clanka.win/reports/${mint}`
        });
      }
      
      if (results.length >= 10) break;
    } catch {}
  }
  
  return results;
}

// Fetch a specific report
async function fetchReport(id) {
  try {
    const filePath = path.join(REPORTS_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    
    return {
      id: id,
      title: data.symbol || data.name || id,
      text: JSON.stringify(data, null, 2),
      url: `https://clanka.win/reports/${id}`,
      metadata: {
        symbol: data.symbol,
        name: data.name,
        created: data.created_at
      }
    };
  } catch {
    throw new Error(`Report not found: ${id}`);
  }
}

// Handle SSE connections for ChatGPT
async function handleSSE(req, res) {
  writeCors(res);
  
  // NO AUTH FOR SSE - ChatGPT handles auth differently
  // if (!await validateAuth(req)) {
  //   res.writeHead(401);
  //   res.end('Unauthorized');
  //   return;
  // }
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialized',
    params: {
      protocolVersion: '0.1.0',
      serverInfo: {
        name: 'token-ai-mcp',
        version: '1.0.0'
      },
      capabilities: {
        tools: {
          listChanged: true
        }
      }
    }
  })}\n\n`);
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':ping\n\n');
  }, 30000);
  
  // Handle incoming data
  let buffer = '';
  req.on('data', async (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const message = JSON.parse(line);
        
        if (message.method === 'tools/list') {
          res.write(`data: ${JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: [
                {
                  name: 'search',
                  description: 'Search for token analysis reports',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      query: { type: 'string', description: 'Search query' }
                    },
                    required: ['query']
                  }
                },
                {
                  name: 'fetch',
                  description: 'Fetch a complete token analysis report',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: 'Token mint address' }
                    },
                    required: ['id']
                  }
                },
                {
                  name: 'voice_debug_get',
                  description: 'Fetch latest Realtime Voice debug logs from the Live UI server',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      limit: { type: 'integer', description: 'Max lines', default: 100 }
                    }
                  }
                },
                {
                  name: 'voice_debug_save',
                  description: 'Persist Realtime Voice debug logs to server (JSON file)',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      session: { type: 'string', description: 'Optional session id to filter' },
                      note: { type: 'string', description: 'Optional note' }
                    }
                  }
                }
              ]
            }
          })}\n\n`);
        } else if (message.method === 'tools/call') {
          const { name, arguments: args } = message.params;
          
          try {
            let result;
            if (name === 'search') {
              const results = await searchReports(args.query);
              result = { results };
            } else if (name === 'fetch') {
              result = await fetchReport(args.id);
            } else if (name === 'voice_debug_get') {
              const UI_PORT = Number(process.env.TOKEN_AI_UI_PORT || 3013);
              const lim = Math.max(1, Math.min(1000, parseInt(String(args?.limit||'100'),10)||100));
              const sess = args?.session ? `&session=${encodeURIComponent(String(args.session))}` : '';
              const payload = await new Promise((resolve) => {
                const req = http.request({ hostname:'127.0.0.1', port: UI_PORT, path:`/realtime/debug-log?limit=${lim}${sess}`, method:'GET' }, (r) => {
                  let data='';
                  r.on('data', chunk => data+=chunk.toString());
                  r.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ ok:false, error:'bad_json', raw:data }); } });
                });
                req.on('error', (e)=> resolve({ ok:false, error: String(e?.message||e) }));
                req.end();
              });
              result = payload;
            } else if (name === 'voice_debug_save') {
              const UI_PORT = Number(process.env.TOKEN_AI_UI_PORT || 3013);
              const payload = await new Promise((resolve) => {
                const body = JSON.stringify({ session: args?.session || undefined, note: args?.note || undefined });
                const req = http.request({ hostname:'127.0.0.1', port: UI_PORT, path:`/realtime/debug-save`, method:'POST', headers:{ 'content-type':'application/json' } }, (r) => {
                  let data=''; r.on('data', c=> data+=c.toString()); r.on('end', ()=>{ try { resolve(JSON.parse(data)); } catch { resolve({ ok:false, error:'bad_json', raw:data }); } });
                });
                req.on('error', (e)=> resolve({ ok:false, error: String(e?.message||e) }));
                req.write(body); req.end();
              });
              result = payload;
            } else {
              throw new Error(`Unknown tool: ${name}`);
            }
            
            res.write(`data: ${JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(result) }]
              }
            })}\n\n`);
          } catch (error) {
            res.write(`data: ${JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32603, message: error.message }
            })}\n\n`);
          }
        }
      } catch (e) {
        console.error('Error processing message:', e);
      }
    }
  });
  
  req.on('close', () => {
    clearInterval(keepAlive);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    writeCors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    
    // OAuth metadata endpoints for ChatGPT
    if (url.pathname === '/mcp/.well-known/oauth-authorization-server' ||
        url.pathname === '/mcp/sse/.well-known/oauth-authorization-server') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        issuer: PUBLIC_URL,
        authorization_endpoint: `${PUBLIC_URL}/authorize`,
        token_endpoint: `${PUBLIC_URL}/token`,
        userinfo_endpoint: `${PUBLIC_URL}/userinfo`,
        userinfo_endpoint: `${PUBLIC_URL}/userinfo`,
        token_endpoint_auth_methods_supported: ['client_secret_post','client_secret_basic'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: ['openid','profile','email']
      }));
      return;
    }

    if (url.pathname === '/mcp/.well-known/openid-configuration' ||
        url.pathname === '/mcp/sse/.well-known/openid-configuration') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        issuer: PUBLIC_URL,
        authorization_endpoint: `${PUBLIC_URL}/authorize`,
        token_endpoint: `${PUBLIC_URL}/token`,
        userinfo_endpoint: `${PUBLIC_URL}/userinfo`
      }));
      return;
    }
    
    // OAuth callback
    if (url.pathname === '/mcp/callback' || url.pathname === '/mcp/sse/callback') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
        <html><head><title>OAuth Success</title></head>
        <body>
          <h1>Authorization Successful</h1>
          <p>You can close this window and return to ChatGPT.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'oauth-callback', url: window.location.href }, '*');
              window.close();
            }
          </script>
        </body></html>`);
      return;
    }
    
    // ChatGPT SSE endpoint
    if (url.pathname === '/mcp/sse' || url.pathname === '/mcp/sse/') {
      await handleSSE(req, res);
      return;
    }
    
    // Standard MCP endpoint (keep existing functionality)
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'MCP Server',
        endpoints: {
          sse: '/mcp/sse/',
          standard: '/mcp'
        }
      }));
      return;
    }
    
    res.writeHead(404);
    res.end('Not Found');
  } catch (e) {
    try {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    } catch {}
  }
});

server.listen(PORT, () => {
  console.log(`MCP HTTP (SSE) listening on http://localhost:${PORT}`);
  console.log(`ChatGPT SSE endpoint: http://localhost:${PORT}/mcp/sse/`);
  console.log(`OAuth discovery advertised at ${PUBLIC_URL}/.well-known/* (flows proxied to OAuth server)`);
});
