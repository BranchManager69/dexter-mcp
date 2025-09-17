#!/usr/bin/env node
// MCP Streamable HTTP server with OAuth support (Generic OIDC)

import http from 'node:http';
import https from 'node:https';
import { randomUUID, createHash, createHmac, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { buildMcpServer } from './common.mjs';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import dotenv from 'dotenv';
import path from 'node:path';

// Load env from repo root (Dexter), legacy token-ai/.env, and local MCP overrides
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
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

// OAuth Configuration (Generic OIDC)
const OAUTH_ENABLED = process.env.TOKEN_AI_MCP_OAUTH === 'true';
const PUBLIC_URL = process.env.TOKEN_AI_MCP_PUBLIC_URL || '';

// Generic OIDC provider settings (preferred)
const OIDC_ISSUER = process.env.TOKEN_AI_OIDC_ISSUER || '';
const OIDC_AUTHORIZATION_ENDPOINT = process.env.TOKEN_AI_OIDC_AUTHORIZATION_ENDPOINT || '';
const OIDC_TOKEN_ENDPOINT = process.env.TOKEN_AI_OIDC_TOKEN_ENDPOINT || '';
const OIDC_USERINFO_ENDPOINT = process.env.TOKEN_AI_OIDC_USERINFO || '';
const OIDC_JWKS_URI = process.env.TOKEN_AI_OIDC_JWKS_URI || '';
const OIDC_REGISTRATION_ENDPOINT = process.env.TOKEN_AI_OIDC_REGISTRATION_ENDPOINT || '';
const OIDC_SCOPES = process.env.TOKEN_AI_OIDC_SCOPES || 'openid profile email';
const OIDC_CLIENT_ID = process.env.TOKEN_AI_OIDC_CLIENT_ID || '';
const OIDC_IDENTITY_CLAIM = process.env.TOKEN_AI_OIDC_IDENTITY_CLAIM || 'sub';
const OIDC_ALLOWED_USERS = (process.env.TOKEN_AI_OIDC_ALLOWED_USERS || '').split(',').filter(Boolean);

// Allowlist of known safe public redirect URIs (in addition to registered clients)
// Defaults include Claude and ChatGPT connector callback URLs. Can be extended via env.
const DEFAULT_ALLOWED_REDIRECTS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://chatgpt.com/connector_platform_oauth_redirect',
  'https://chat.openai.com/connector_platform_oauth_redirect'
];
const ENV_ALLOWED_REDIRECTS = (process.env.TOKEN_AI_MCP_ALLOWED_REDIRECTS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ALLOWED_REDIRECTS = Array.from(new Set([...DEFAULT_ALLOWED_REDIRECTS, ...ENV_ALLOWED_REDIRECTS]));

// Deprecated GitHub fallback (used only if explicitly configured)
const GITHUB_CLIENT_ID = process.env.TOKEN_AI_MCP_GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.TOKEN_AI_MCP_GITHUB_CLIENT_SECRET || '';
const ALLOWED_GITHUB_USERS = (process.env.TOKEN_AI_MCP_GITHUB_ALLOWED_USERS || '').split(',').filter(Boolean);

// Development override: allow any bearer without validation (NOT recommended for public exposure)
// Simplify env: if demo mode is on, treat allow-any as enabled by default
const DEMO_MODE = ['1','true','yes','on'].includes(String(process.env.TOKEN_AI_DEMO_MODE||'').toLowerCase());
const OAUTH_ALLOW_ANY = (
  ['1','true','yes','on'].includes(String(process.env.TOKEN_AI_MCP_OAUTH_ALLOW_ANY||'').toLowerCase())
  || DEMO_MODE
);

// ID Token/JWKS support (optional)
const ID_TOKEN_ENABLED = ['1','true','yes','on'].includes(String(process.env.TOKEN_AI_OIDC_ID_TOKEN||'1').toLowerCase());
const HS256_SECRET = process.env.TOKEN_AI_OIDC_ID_TOKEN_SECRET || process.env.MCP_USER_JWT_SECRET || '';
const RSA_PRIVATE_PEM = process.env.TOKEN_AI_OIDC_RSA_PRIVATE_KEY || '';
const RSA_KID = process.env.TOKEN_AI_OIDC_RSA_KID || 'mcp-key-1';

let rsaPrivateKey = null;
let rsaPublicJwk = null;
if (RSA_PRIVATE_PEM) {
  try {
    rsaPrivateKey = createPrivateKey({ key: RSA_PRIVATE_PEM });
    const pub = createPublicKey(rsaPrivateKey);
    // Export JWK for JWKS endpoint
    const jwk = pub.export({ format: 'jwk' });
    rsaPublicJwk = { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig', kid: RSA_KID };
  } catch {}
}

// Keep transports per session
const transports = new Map(); // sessionId -> transport
const servers = new Map(); // sessionId -> McpServer instance
const sessionUsers = new Map(); // sessionId -> identity (from IdP) or token preview
const sessionIdentity = new Map(); // sessionId -> { issuer, sub, email }
// Simple in-process OAuth data stores (built-in provider)
const oauthCodes = new Map(); // code -> { codeChallenge, method, scope, client_id, redirect_uri, state, createdAt }
const issuedTokens = new Map(); // token -> { sub, scope, createdAt, expiresAt, refreshToken }
const refreshTokens = new Map(); // refreshToken -> { sub, scope, createdAt, clientId }
const registeredClients = new Map(); // client_id -> { client_secret, redirect_uris, grant_types, response_types, scope, contacts, client_name }

// OAuth token cache (to avoid hitting IdP API on every request)
const tokenCache = new Map(); // token -> { user, claims, expires }

function writeCors(res){
  try {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type, Authorization, X-Authorization, X-Api-Key, X-User-Token, Mcp-Session-Id, Mcp-Protocol-Version');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  } catch {}
}

function effectiveBaseUrl(req){
  // Prefer explicit PUBLIC_URL; else derive from request
  if (PUBLIC_URL) return PUBLIC_URL.replace(/\/$/, '');
  try {
    const host = String(req.headers['x-forwarded-host'] || req.headers['host'] || '').trim();
    const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase() || 'http';
    if (host) return `${proto}://${host}/mcp`.replace(/\/$/, '');
  } catch {}
  return `http://localhost:${PORT}/mcp`;
}

function getProviderConfig(req) {
  // Prefer OIDC if configured
  if (OIDC_AUTHORIZATION_ENDPOINT || OIDC_TOKEN_ENDPOINT || OIDC_USERINFO_ENDPOINT || OIDC_ISSUER) {
    return {
      type: 'oidc',
      issuer: OIDC_ISSUER || undefined,
      authorization_endpoint: OIDC_AUTHORIZATION_ENDPOINT,
      token_endpoint: OIDC_TOKEN_ENDPOINT,
      registration_endpoint: OIDC_REGISTRATION_ENDPOINT || undefined,
      userinfo_endpoint: OIDC_USERINFO_ENDPOINT,
      jwks_uri: OIDC_JWKS_URI || undefined,
      client_id: OIDC_CLIENT_ID,
      scopes: OIDC_SCOPES,
      identity_claim: OIDC_IDENTITY_CLAIM,
      allowed_users: OIDC_ALLOWED_USERS,
    };
  }
  // Fallback to GitHub only if explicitly configured (avoid surprising defaults)
  if (GITHUB_CLIENT_ID || GITHUB_CLIENT_SECRET) {
    return {
      type: 'github',
      issuer: 'https://github.com',
      authorization_endpoint: 'https://github.com/login/oauth/authorize',
      token_endpoint: 'https://github.com/login/oauth/access_token',
      userinfo_endpoint: 'https://api.github.com/user',
      client_id: GITHUB_CLIENT_ID,
      scopes: 'read:user',
      identity_claim: 'login',
      allowed_users: ALLOWED_GITHUB_USERS,
    };
  }
  // Built-in lightweight provider (no external IdP) if OAuth is enabled but nothing configured
  if (OAUTH_ENABLED) {
    const baseSupabase = SUPABASE_URL || (req ? effectiveBaseUrl(req) : (PUBLIC_URL||`http://localhost:${PORT}/mcp`));
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      return {
        type: 'supabase',
        issuer: SUPABASE_URL,
        authorization_endpoint: null,
        token_endpoint: null,
        userinfo_endpoint: `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`,
        client_id: 'dexter-supabase',
        scopes: 'wallet.read wallet.trade',
        identity_claim: 'sub',
        allowed_users: [],
      };
    }
    const base = (req ? effectiveBaseUrl(req) : (PUBLIC_URL||`http://localhost:${PORT}/mcp`)).replace(/\/$/,'');
    return {
      type: 'oidc',
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      userinfo_endpoint: `${base}/userinfo`,
      jwks_uri: rsaPublicJwk ? `${base}/jwks.json` : undefined,
      client_id: OIDC_CLIENT_ID || 'clanka-mcp',
      scopes: OIDC_SCOPES || 'openid profile email',
      identity_claim: OIDC_IDENTITY_CLAIM || 'sub',
      allowed_users: OIDC_ALLOWED_USERS,
      builtin: true,
    };
  }
  return null;
}

function base64urlSha256(input) {
  const hash = createHash('sha256').update(input).digest('base64');
  return hash.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function randomToken(prefix = 'tok') {
  return `${prefix}_${randomUUID().replace(/-/g,'')}`;
}

function base64UrlDecode(input) {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? normalized : normalized + '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(pad, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = base64UrlDecode(parts[1]);
    if (!payload) return null;
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function validateSupabaseToken(token) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json().catch(() => null);
    if (!data?.id) return null;
    const payload = decodeJwtPayload(token) || {};
    const expSeconds = typeof payload.exp === 'number' ? payload.exp : null;
    const expires = expSeconds ? expSeconds * 1000 : Date.now() + 5 * 60 * 1000;
    const entry = {
      user: String(data.id),
      claims: { sub: data.id, email: data.email || null, issuer: SUPABASE_URL },
      expires,
    };
    return entry;
  } catch (err) {
    console.warn('[oauth] supabase user fetch failed', err?.message || err);
    return null;
  }
}

function unauthorized(res, message = 'Unauthorized', req){
  writeCors(res);
  try {
    const base = effectiveBaseUrl(req);
    const redirect = `${base}/callback`;
    const prov = getProviderConfig(req);
    if (prov) {
      const authz = prov.authorization_endpoint || '';
      const token = prov.token_endpoint || '';
      const client = prov.client_id || '';
      const scope = prov.scopes || '';
      const issuer = prov.issuer || '';
      res.setHeader('WWW-Authenticate', `Bearer realm="MCP", authorization_uri="${authz}", token_uri="${token}", client_id="${client}", redirect_uri="${redirect}", scope="${scope}", issuer="${issuer}"`);
    } else {
      res.setHeader('WWW-Authenticate', `Bearer realm="MCP"`);
    }
    res.setHeader('Cache-Control','no-store');
  } catch {}
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc:'2.0', error:{ code:-32000, message }, id:null }));
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

function buildIdentityForRequest(sessionId, req){
  try {
    if (sessionId && sessionIdentity.has(sessionId)) {
      const ident = sessionIdentity.get(sessionId);
      try { console.log(`[identity] hit cache sid=${sessionId} issuer=${ident?.issuer||''} sub=${ident?.sub||''}`); } catch {}
      return ident;
    }
  } catch {}
  try {
    const issuer = req?.headers?.['x-user-issuer'] || effectiveBaseUrl(req);
    const sub = req?.headers?.['x-user-sub'] || '';
    const email = req?.headers?.['x-user-email'] || '';
    try { console.log(`[identity] headers sid=${sessionId||'∅'} issuer=${issuer||''} sub=${sub||''}`); } catch {}
    return { issuer, sub, email };
  } catch { return null; }
}

function injectIdentityIntoBody(body, identity){
  try {
    if (!body || typeof body !== 'object') return body;
    if (!identity) return body;
    if (body.method === 'tools/call' && body.params && typeof body.params === 'object') {
      if (!body.params.arguments || typeof body.params.arguments !== 'object') body.params.arguments = {};
      body.params.arguments.__issuer = String(identity.issuer||'');
      body.params.arguments.__sub = String(identity.sub||'');
      if (identity.email) body.params.arguments.__email = String(identity.email);
    }
  } catch {}
  return body;
}

// Validate OAuth token via OIDC userinfo endpoint (preferred) or GitHub API when configured.
async function validateTokenAndClaims(token) {
  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached;
  }
  const supabaseEntry = await validateSupabaseToken(token);
  if (supabaseEntry) {
    tokenCache.set(token, supabaseEntry);
    return supabaseEntry;
  }
  const prov = getProviderConfig();
  if (!prov) return null;
  try { console.log('[oauth] validate token start', { token: token.slice(0, 8) + '…' }); } catch {}

  if (OAUTH_ALLOW_ANY) {
    // In allow-any demo mode, only accept the server-injected bearer token
    // (used by /mcp-proxy). This avoids accepting arbitrary public tokens
    // while keeping the demo flow working.
    try {
      const SERVER_BEARER = process.env.TOKEN_AI_MCP_TOKEN || '';
      if (SERVER_BEARER && token === SERVER_BEARER) {
        const preview = `bearer:${token.slice(0,4)}…${token.slice(-4)}`;
        const entry = { user: preview, claims: { sub: preview }, expires: Date.now() + 300000 };
        tokenCache.set(token, entry);
        return entry;
      }
    } catch {}
    // Fall through to OIDC/GitHub validation if configured; otherwise deny
  }

  if (prov.type === 'oidc') {
    // Accept locally minted tokens when using the built-in provider
    if (prov.builtin) {
      const t = issuedTokens.get(token);
      if (t && (!t.expiresAt || t.expiresAt > Date.now())) {
        const subject = String(t.sub || '');
        const display = subject || `local:${token.slice(0,4)}…`;
        const entry = { user: subject || display, claims: { sub: subject, scope: t.scope }, expires: Date.now() + 300000 };
        tokenCache.set(token, entry);
        return entry;
      }
    }
    try {
      const url = new URL(prov.userinfo_endpoint);
      const options = { hostname: url.hostname, path: url.pathname + (url.search||''), method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } };
      return await new Promise((resolve) => {
        const req = (url.protocol === 'https:' ? https : http).request(options, (r) => {
          let data='';
          r.on('data', c=> data+=c.toString());
          r.on('end', () => {
            try {
              if (r.statusCode === 200) {
                const claims = JSON.parse(data);
                const idClaim = prov.identity_claim || 'sub';
                const user = String(claims[idClaim] || claims.sub || '');
                if (!user) return resolve(null);
                if (Array.isArray(prov.allowed_users) && prov.allowed_users.length > 0 && !prov.allowed_users.includes(user)) {
                  return resolve(null);
                }
                const entry = { user, claims, expires: Date.now() + 300000 };
                tokenCache.set(token, entry);
                resolve(entry);
              } else {
                resolve(null);
              }
            } catch { resolve(null); }
          });
        });
        req.on('error', () => resolve(null));
        req.end();
      });
    } catch {
      return null;
    }
  }

  if (prov.type === 'github') {
    return await new Promise((resolve) => {
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
              const identity = user?.login || '';
              if (!identity) return resolve(null);
              if (Array.isArray(prov.allowed_users) && prov.allowed_users.length > 0 && !prov.allowed_users.includes(identity)) {
                return resolve(null);
              }
              const entry = { user: identity, claims: user, expires: Date.now() + 300000 };
              tokenCache.set(token, entry);
              resolve(entry);
            } else {
              resolve(null);
            }
          } catch { resolve(null); }
        });
      }).on('error', () => resolve(null)).end();
    });
  }

  return null;
}

// OAuth metadata endpoints (served at both root and /mcp/.well-known for compatibility)
function serveOAuthMetadata(pathname, res, req) {
  writeCors(res);
  const isAuthMeta = (pathname === '/.well-known/oauth-authorization-server' || pathname === '/mcp/.well-known/oauth-authorization-server');
  const isOidcMeta = (pathname === '/.well-known/openid-configuration' || pathname === '/mcp/.well-known/openid-configuration');
  const isJwks = (pathname === '/.well-known/jwks.json' || pathname === '/mcp/jwks.json' || pathname === '/jwks.json' || pathname === '/mcp/.well-known/jwks.json');

  if (isJwks) {
    // Serve JWKS only if RS256 configured
    if (!rsaPublicJwk) { res.writeHead(404).end('Not Found'); return true; }
    try { console.log(`[oauth-meta] serve jwks for ${pathname} ua=${req?.headers?.['user-agent']||''}`); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control':'no-store' });
    res.end(JSON.stringify({ keys: [rsaPublicJwk] }));
    return true;
  }

  if (isAuthMeta) {
    try { console.log(`[oauth-meta] serve auth metadata for ${pathname} ua=${req?.headers?.['user-agent']||''}`); } catch {}
    const prov = getProviderConfig(req);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control':'no-store' });
    res.end(JSON.stringify({
      issuer: prov?.issuer || 'custom',
      authorization_endpoint: prov?.authorization_endpoint || '',
      token_endpoint: prov?.token_endpoint || '',
      registration_endpoint: prov?.registration_endpoint || `${effectiveBaseUrl(req)}/register`,
      userinfo_endpoint: prov?.userinfo_endpoint || '',
      token_endpoint_auth_methods_supported: ['none','client_secret_post', 'client_secret_basic'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: (prov?.scopes || '').split(/\s+/).filter(Boolean),
      id_token_signing_alg_values_supported: rsaPublicJwk ? ['RS256'] : (HS256_SECRET ? ['HS256'] : []),
      mcp: { client_id: prov?.client_id || '', redirect_uri: `${effectiveBaseUrl(req)}/callback` }
    }));
    return true;
  }

  if (isOidcMeta) {
    try { console.log(`[oauth-meta] serve oidc metadata for ${pathname} ua=${req?.headers?.['user-agent']||''}`); } catch {}
    const prov = getProviderConfig(req);
    const scopes = (prov?.scopes || '').split(/\s+/).filter(Boolean);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control':'no-store' });
    res.end(JSON.stringify({
      issuer: prov?.issuer || 'custom',
      authorization_endpoint: prov?.authorization_endpoint || '',
      token_endpoint: prov?.token_endpoint || '',
      registration_endpoint: prov?.registration_endpoint || `${effectiveBaseUrl(req)}/register`,
      userinfo_endpoint: prov?.userinfo_endpoint || '',
      jwks_uri: rsaPublicJwk ? `${effectiveBaseUrl(req)}/jwks.json` : undefined,
      token_endpoint_auth_methods_supported: ['none','client_secret_post', 'client_secret_basic'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: scopes,
      id_token_signing_alg_values_supported: rsaPublicJwk ? ['RS256'] : (HS256_SECRET ? ['HS256'] : []),
      mcp: { client_id: prov?.client_id || '', redirect_uri: `${effectiveBaseUrl(req)}/callback` }
    }));
    return true;
  }

  return false;
}

// OAuth callback handler
function handleOAuthCallback(url, res) {
  writeCors(res);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>OAuth Success</title></head>
    <body>
      <h1>Authorization Successful</h1>
      <p>You can now close this window and return to your MCP client.</p>
      <script>
        // Try to communicate back to parent window if opened as popup
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth-callback', url: window.location.href }, '*');
          window.close();
        }
      </script>
    </body>
    </html>
  `);
}

const server = http.createServer(async (req, res) => {
  try {
    writeCors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    
    // Health endpoint (JSON)
    if (url.pathname === '/mcp/health' || url.pathname === '/health') {
      try { console.log(`[mcp] health check ua=${req?.headers?.['user-agent']||''}`); } catch {}
      const base = effectiveBaseUrl(req);
      const prov = getProviderConfig(req);
      const body = {
        ok: true,
        status: 'ok',
        oauth: !!OAUTH_ENABLED,
        issuer: prov?.issuer || base,
        base,
        port: PORT,
        sessions: {
          transports: Array.isArray(transports) ? transports.length : (typeof transports?.size === 'number' ? transports.size : undefined),
          servers: typeof servers?.size === 'number' ? servers.size : undefined
        },
        timestamp: new Date().toISOString()
      };
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control':'no-store' });
      res.end(JSON.stringify(body));
      return;
    }

    // Serve OAuth metadata
    if (OAUTH_ENABLED && serveOAuthMetadata(url.pathname, res, req)) {
      return;
    }
    
    // Built-in OAuth provider endpoints
    if (OAUTH_ENABLED && (url.pathname === '/mcp/authorize' || url.pathname === '/authorize')) {
      try { console.log(`[oauth] authorize request query=${url.search}`); } catch {}
      const q = Object.fromEntries(url.searchParams.entries());
      const clientId = q.client_id || '';
      const redirectUri = q.redirect_uri || '';
      const state = q.state || '';
      const scope = q.scope || 'openid profile email';
      const codeChallenge = q.code_challenge || '';
      const codeMethod = (q.code_challenge_method || 'S256').toUpperCase();
      const responseType = q.response_type || 'code';
      const nonce = q.nonce || '';
      // Always auto-approve for built-in provider to maximize connector compatibility
      const approved = true;

      // Basic validation
      if (responseType !== 'code' || !clientId || !redirectUri || !codeChallenge || codeMethod !== 'S256') {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid authorization request');
        return;
      }
      
      // Validate redirect URI for registered clients or allowlisted public redirects
      const claudeCallbackUri = 'https://claude.ai/api/mcp/auth_callback';
      const registeredClient = registeredClients.get(clientId);
      const base = effectiveBaseUrl(req);
      const selfCallback = `${base}/callback`;
      
      // Allow our own /callback, localhost, and known public connector redirects (Claude/ChatGPT) even for unregistered clients
      const isValidRedirect = (
        ALLOWED_REDIRECTS.includes(redirectUri) ||
        redirectUri === selfCallback ||
        redirectUri.startsWith('http://localhost') ||
        (registeredClient && registeredClient.redirect_uris.includes(redirectUri))
      );
      
      if (!isValidRedirect) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid redirect_uri');
        return;
      }

      // Consent UI skipped (auto-approve)

      // Issue an authorization code
      const code = randomToken('code');
      oauthCodes.set(code, { codeChallenge, method: codeMethod, scope, client_id: clientId, redirect_uri: redirectUri, state, nonce, createdAt: Date.now() });
      const sep = redirectUri.includes('?') ? '&' : '?';
      const loc = `${redirectUri}${sep}code=${encodeURIComponent(code)}${state?`&state=${encodeURIComponent(state)}`:''}`;
      res.writeHead(302, { 'Location': loc, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    if (OAUTH_ENABLED && (url.pathname === '/mcp/token' || url.pathname === '/token')) {
      // Read x-www-form-urlencoded
      const raw = await new Promise((resolve) => { let data=''; req.on('data', c=> data+=c.toString()); req.on('end', ()=> resolve(data)); req.on('error', ()=> resolve('')); });
      const params = new URLSearchParams(raw);
      const grantType = params.get('grant_type') || '';
      try { console.log(`[oauth] token grant type=${grantType}`); } catch {}
      const body = Object.fromEntries(params);
      const code = body.code || '';
      const verifier = body.code_verifier || '';
      let clientId = body.client_id || '';
      const redirectUri = body.redirect_uri || '';
      // Support client_secret_basic (optional)
      try {
        const authz = String(req.headers['authorization']||'');
        if (authz.startsWith('Basic ')) {
          const decoded = Buffer.from(authz.slice(6), 'base64').toString('utf8');
          const [cid, csec] = decoded.split(':');
          if (cid) clientId = cid;
          // Optionally validate secret if we have a registration
          const reg = registeredClients.get(cid);
          if (reg && reg.client_secret && csec !== reg.client_secret) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_client' }));
            return;
          }
        }
      } catch {}

      // Handle refresh token grant
      if (grantType === 'refresh_token') {
        const refreshToken = body.refresh_token || '';
        if (!refreshToken) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_request' }));
          return;
        }
        
        const refreshData = refreshTokens.get(refreshToken);
        if (!refreshData) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_grant' }));
          return;
        }
        
        // Issue new access token
        const newAccessToken = randomToken('atk');
        const ttl = 3600;
        issuedTokens.set(newAccessToken, { 
          sub: refreshData.sub, 
          scope: refreshData.scope, 
          createdAt: Date.now(), 
          expiresAt: Date.now() + ttl * 1000,
          refreshToken 
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ 
          access_token: newAccessToken, 
          token_type: 'Bearer', 
          expires_in: ttl,
          refresh_token: refreshToken, // Return same refresh token
          scope: refreshData.scope 
        }));
        return;
      }
      
      // Handle authorization code grant
      if (grantType !== 'authorization_code' || !code || !verifier) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request' }));
        return;
      }
      const entry = oauthCodes.get(code);
      if (!entry) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      if (clientId && entry.client_id && clientId !== entry.client_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_client' }));
        return;
      }
      // Enforce redirect_uri if provided
      if (redirectUri && entry.redirect_uri && redirectUri !== entry.redirect_uri) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' }));
        return;
      }
      // Verify PKCE S256
      const expected = entry.codeChallenge;
      const actual = base64urlSha256(verifier);
      if (expected !== actual) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      oauthCodes.delete(code);
      // Mint access token and refresh token
      const accessToken = randomToken('atk');
      const refreshToken = randomToken('rtk');
      const ttl = 3600; // seconds
      const sub = `user:${accessToken.slice(-12)}`;

      // Store refresh token
      refreshTokens.set(refreshToken, { sub, scope: entry.scope, createdAt: Date.now(), clientId: entry.client_id });

      // Store access token with reference to refresh token
      issuedTokens.set(accessToken, { sub, scope: entry.scope, createdAt: Date.now(), expiresAt: Date.now()+ttl*1000, refreshToken });
      // Optional ID token (HS256 or RS256)
      let idToken = undefined;
      if (ID_TOKEN_ENABLED) {
        try {
          const iss = effectiveBaseUrl(req);
          const aud = clientId || entry.client_id || 'clanka-mcp';
          const now = Math.floor(Date.now()/1000);
          const payload = { iss, aud, sub, iat: now, exp: now + ttl, nonce: entry.nonce || undefined, scope: entry.scope };
          if (rsaPrivateKey && rsaPublicJwk) {
            const header = { alg: 'RS256', typ: 'JWT', kid: RSA_KID };
            const enc = (obj)=> Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
            const input = `${enc(header)}.${enc(payload)}`;
            const signature = sign('RSA-SHA256', Buffer.from(input), rsaPrivateKey).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
            idToken = `${input}.${signature}`;
          } else if (HS256_SECRET) {
            const header = { alg: 'HS256', typ: 'JWT' };
            const enc = (obj)=> Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
            const input = `${enc(header)}.${enc(payload)}`;
            const h = createHmac('sha256', HS256_SECRET).update(input).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
            idToken = `${input}.${h}`;
          }
        } catch {}
      }

      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      const tokenResp = { 
        access_token: accessToken, 
        token_type: 'Bearer', 
        expires_in: ttl, 
        refresh_token: refreshToken,
        scope: entry.scope 
      };
      if (idToken) tokenResp.id_token = idToken;
      res.end(JSON.stringify(tokenResp));
      return;
    }

    if (OAUTH_ENABLED && (url.pathname === '/mcp/userinfo' || url.pathname === '/userinfo')) {
      const authz = String(req.headers['authorization']||'');
      if (!authz.startsWith('Bearer ')) { res.writeHead(401).end('Unauthorized'); return; }
      const token = authz.slice(7);
      const t = issuedTokens.get(token);
      if (!t || (t.expiresAt && t.expiresAt < Date.now())) { res.writeHead(401).end('Unauthorized'); return; }
      const claims = { sub: t.sub, scope: t.scope };
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(claims));
      return;
    }

    // Dynamic Client Registration endpoint
    if (OAUTH_ENABLED && (url.pathname === '/mcp/register' || url.pathname === '/register')) {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
      }
      
      const raw = await new Promise((resolve) => { 
        let data=''; 
        req.on('data', c=> data+=c.toString()); 
        req.on('end', ()=> resolve(data)); 
        req.on('error', ()=> resolve('{}'));
      });
      
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Invalid JSON' }));
        return;
      }
      
      // Generate client credentials
      const clientId = randomToken('cid');
      const clientSecret = randomToken('cs');
      
      // Extract and normalize redirect URIs, augment with known safe public redirects
      const redirectUris = Array.isArray(body.redirect_uris) ? [...body.redirect_uris] : [];
      for (const uri of ALLOWED_REDIRECTS) {
        if (!redirectUris.includes(uri)) redirectUris.push(uri);
      }
      
      // Store client registration
      registeredClients.set(clientId, {
        client_secret: clientSecret,
        redirect_uris: redirectUris,
        grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
        response_types: body.response_types || ['code'],
        scope: body.scope || 'openid profile email',
        contacts: body.contacts || [],
        client_name: body.client_name || 'MCP Client',
        created_at: Math.floor(Date.now() / 1000)
      });
      
      // Return client information
      res.writeHead(201, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: body.scope || 'openid profile email',
        client_name: body.client_name || 'MCP Client',
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0 // Never expires
      }));
      return;
    }
    
    // Handle OAuth callback (support both /callback and /mcp/callback)
    if (OAUTH_ENABLED && (url.pathname === '/mcp/callback' || url.pathname === '/callback')) {
      handleOAuthCallback(url, res);
      return;
    }
    
    if (url.pathname !== '/mcp') { res.writeHead(404).end('Not Found'); return; }
    
    // Authentication check (supports session reuse without repeating Authorization)
    const auth = String(req.headers['authorization'] || '');
    const sidIn = req.headers['mcp-session-id'];
    const hasSession = sidIn && transports.has(sidIn);
    if (OAUTH_ENABLED) {
      if (!hasSession) {
        // New session: require bearer. Accept either:
        // 1) Server bearer (TOKEN_AI_MCP_TOKEN) for non-OAuth clients
        // 2) OAuth bearer validated via OIDC/GitHub
        if (!auth.startsWith('Bearer ')) return unauthorized(res, 'OAuth token required', req);
        const token = auth.substring(7).trim();
        if (!token || token === 'undefined') {
          try { console.log('[oauth] empty bearer for new session', { sid: sidIn || '∅' }); } catch {}
          return unauthorized(res, 'Invalid token or user not authorized', req);
        }
        const SERVER_BEARER = String(process.env.TOKEN_AI_MCP_TOKEN||'');
        if (SERVER_BEARER && token === SERVER_BEARER) {
          const preview = `bearer:${token.slice(0,4)}…${token.slice(-4)}`;
          req.oauthUser = preview;
        } else {
          const entry = await validateTokenAndClaims(token);
          if (!entry) { console.log('[oauth] token rejected', { token: token.slice(0, 8) + '…' }); return unauthorized(res, 'Invalid token or user not authorized', req); }
          req.oauthUser = entry.user;
          try {
            console.log('[oauth] token accepted', { user: entry.user, claims: entry.claims });
            const prov = getProviderConfig(req);
            if (prov) req.headers['x-user-issuer'] = prov.issuer || effectiveBaseUrl(req);
            if (entry?.claims?.sub) req.headers['x-user-sub'] = String(entry.claims.sub);
            if (entry?.claims?.email) req.headers['x-user-email'] = String(entry.claims.email);
            if (!req.headers['x-user-sub'] && entry?.user) req.headers['x-user-sub'] = String(entry.user);
          } catch {}
        }
      } else {
        // Existing session: allow missing Authorization; user comes from sessionUsers
        const remembered = sessionUsers.get(sidIn);
        if (remembered) req.oauthUser = remembered;
        if (remembered) {
          try {
            if (!req.headers['x-user-sub']) req.headers['x-user-sub'] = String(remembered);
            if (!req.headers['x-user-issuer']) req.headers['x-user-issuer'] = effectiveBaseUrl(req);
          } catch {}
        }
        // If Authorization present, refresh identity cache
        if (auth.startsWith('Bearer ')) {
          const token = auth.substring(7).trim();
          if (!token || token === 'undefined') {
            try { console.log('[oauth] empty bearer on existing session', { sid: sidIn || '∅' }); } catch {}
          } else {
            const SERVER_BEARER = String(process.env.TOKEN_AI_MCP_TOKEN||'');
            if (SERVER_BEARER && token === SERVER_BEARER) {
              const preview = `bearer:${token.slice(0,4)}…${token.slice(-4)}`;
              req.oauthUser = preview;
            } else {
              const entry = await validateTokenAndClaims(token);
              if (entry) {
                req.oauthUser = entry.user;
                try {
                  const prov = getProviderConfig(req);
                  if (prov) req.headers['x-user-issuer'] = prov.issuer || effectiveBaseUrl(req);
                  if (entry?.claims?.sub) req.headers['x-user-sub'] = String(entry.claims.sub);
                  if (entry?.claims?.email) req.headers['x-user-email'] = String(entry.claims.email);
                  if (!req.headers['x-user-sub'] && entry?.user) req.headers['x-user-sub'] = String(entry.user);
                } catch {}
              }
            }
          }
        }
      }
    } else if (TOKEN) {
      // Fallback to simple bearer token for new sessions; allow reuse for existing sessions
      if (!hasSession) {
        if (!auth || auth !== `Bearer ${TOKEN}`) return unauthorized(res, 'Unauthorized', req);
      }
    }
    
    if (req.method === 'GET') {
      normalizeAcceptHeader(req);
      const sessionId = req.headers['mcp-session-id'];
      if (!sessionId || !transports.has(sessionId)) {
        try { console.log(`[mcp] GET without valid session id (path=${url.pathname}) ua=${req.headers['user-agent']||''}`); } catch {}
        res.writeHead(400).end('Invalid or missing session ID');
        return;
      }
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
        // Propagate x-user-token for wallet resolution (map identity or raw bearer)
        try {
          if (!req.headers['x-user-token']) {
            const raw = typeof req.oauthUser === 'string' && req.oauthUser ? req.oauthUser : (String(req.headers['authorization']||'').startsWith('Bearer ') ? String(req.headers['authorization']).slice(7) : '');
            if (raw) req.headers['x-user-token'] = raw;
          }
          // Also propagate per-session identity (issuer/sub/email) if known
          const ident = sessionIdentity.get(sessionId);
          if (ident) {
            if (ident.issuer && !req.headers['x-user-issuer']) req.headers['x-user-issuer'] = String(ident.issuer);
            if (ident.sub && !req.headers['x-user-sub']) req.headers['x-user-sub'] = String(ident.sub);
            if (ident.email && !req.headers['x-user-email']) req.headers['x-user-email'] = String(ident.email);
            // Seed per-session wallet override if not set yet
            try {
              const { sessionWalletOverrides } = await import('./tools/wallet-auth.mjs');
              if (!sessionWalletOverrides.get(sessionId)) {
                const { PrismaClient } = await import('@prisma/client');
                const prisma = new PrismaClient();
                const link = await prisma.oauth_user_wallets.findFirst({ where: { provider: String(ident.issuer), subject: String(ident.sub), default_wallet: true } });
                if (link?.wallet_id) sessionWalletOverrides.set(sessionId, String(link.wallet_id));
              }
            } catch {}
          }
        } catch {}
        {
          const body = await readBody(req);
          const ident = buildIdentityForRequest(sessionId, req);
          const patched = injectIdentityIntoBody(body, ident);
          await transport.handleRequest(req, res, patched);
        }
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
      // Propagate x-user-token on initialization, too
      try {
       if (!req.headers['x-user-token']) {
         const raw = typeof req.oauthUser === 'string' && req.oauthUser ? req.oauthUser : (String(req.headers['authorization']||'').startsWith('Bearer ') ? String(req.headers['authorization']).slice(7) : '');
         if (raw) req.headers['x-user-token'] = raw;
       }
        // Seed per-session identity fields from current request
        if (!req.headers['x-user-issuer']) {
          const prov = getProviderConfig(req);
          if (prov) req.headers['x-user-issuer'] = prov.issuer || effectiveBaseUrl(req);
        }
        if (!req.headers['x-user-sub'] && req.oauthUser) {
          req.headers['x-user-sub'] = String(req.oauthUser);
        }
      } catch {}
      {
        const body = await readBody(req);
        const ident = buildIdentityForRequest(null, req);
        const patched = injectIdentityIntoBody(body, ident);
        await transport.handleRequest(req, res, patched);
      }
      const sid = transport.sessionId;
      if (sid) {
        servers.set(sid, mcpServer);
        // Remember user for session so subsequent calls can omit Authorization
        if (req.oauthUser) {
          sessionUsers.set(sid, req.oauthUser);
          try {
            const issuer = req.headers['x-user-issuer'] || effectiveBaseUrl(req);
            const sub = req.headers['x-user-sub'] || (req.oauthUser ? String(req.oauthUser) : '');
            const email = req.headers['x-user-email'] || '';
            sessionIdentity.set(sid, { issuer, sub, email });
          } catch {}
          // Seed per-session wallet override from OAuth mapping (if exists)
          try {
            const { sessionWalletOverrides } = await import('./tools/wallet-auth.mjs');
            const { PrismaClient } = await import('@prisma/client');
            const prisma = new PrismaClient();
            const ident = sessionIdentity.get(sid) || {};
            const link = ident.issuer && ident.sub ? await prisma.oauth_user_wallets.findFirst({ where: { provider: String(ident.issuer), subject: String(ident.sub), default_wallet: true } }) : null;
            if (link?.wallet_id) sessionWalletOverrides.set(sid, String(link.wallet_id));
          } catch {}
          try { console.log(`[mcp] initialize ok user=${req.oauthUser} sid=${sid}`); } catch {}
        } else {
          try {
            const auth = String(req.headers['authorization']||'');
            const hasAuth = auth.startsWith('Bearer ');
            console.log(`[mcp] initialize ok user=unknown sid=${sid} authHeader=${hasAuth?'yes':'no'}`);
          } catch {}
        }
      }
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
  if (OAUTH_ENABLED) {
    const prov = getProviderConfig({ headers: {} });
    if (prov?.type === 'oidc') {
      console.log(`OAuth (OIDC) enabled. Issuer: ${prov.issuer || 'custom'} Client ID: ${prov.client_id || ''}`);
    } else if (prov?.type === 'github') {
      console.log(`OAuth (GitHub) enabled. Client ID: ${GITHUB_CLIENT_ID}`);
    } else if (OAUTH_ALLOW_ANY) {
      console.log(`OAuth allow-any mode enabled (NOT recommended for public use).`);
    } else {
      console.log(`OAuth enabled but no provider configured. Set TOKEN_AI_OIDC_* envs.`);
    }
    const base = PUBLIC_URL || 'http://localhost:'+PORT+'/mcp';
    console.log(`OAuth metadata: ${base.replace(/\/$/,'')}/.well-known/oauth-authorization-server`);
  }
});

//
