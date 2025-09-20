#!/usr/bin/env node
// MCP Streamable HTTP server with OAuth support (Generic OIDC)

import http from 'node:http';
import https from 'node:https';
import { randomUUID, createPrivateKey, createPublicKey } from 'node:crypto';
import { buildMcpServer } from './common.mjs';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Load env from repo root and local MCP overrides
try {
  const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname));
  const CANDIDATES = [
    path.resolve(HERE, '../dexter-ops/.env'),
    path.resolve(HERE, '..', '.env'),
    path.resolve(HERE, '.env'),
  ];
  for (const candidate of CANDIDATES) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
    }
  }
} catch {}

const PORT = Number(process.env.TOKEN_AI_MCP_PORT || 3930);
const TOKEN = process.env.TOKEN_AI_MCP_TOKEN || '';
const CORS_ORIGIN = process.env.TOKEN_AI_MCP_CORS || '*';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';
const RAW_CONNECTOR_API_BASE = process.env.DEXTER_API_BASE_URL || process.env.API_BASE_URL || 'https://dexter.cash/api';
const CONNECTOR_API_BASE = RAW_CONNECTOR_API_BASE.replace(/\/+$/, '');

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
const OIDC_CLIENT_ID_CHATGPT = process.env.TOKEN_AI_OIDC_CLIENT_ID_CHATGPT || '';
const OIDC_IDENTITY_CLAIM = process.env.TOKEN_AI_OIDC_IDENTITY_CLAIM || 'sub';
const OIDC_ALLOWED_USERS = (process.env.TOKEN_AI_OIDC_ALLOWED_USERS || '').split(',').filter(Boolean);

const CHATGPT_HOSTNAMES = new Set(
  (process.env.TOKEN_AI_OIDC_CHATGPT_HOSTS || 'mcp.dexter.cash')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

const USING_EXTERNAL_OIDC = Boolean(
  OIDC_AUTHORIZATION_ENDPOINT ||
  OIDC_TOKEN_ENDPOINT ||
  OIDC_USERINFO_ENDPOINT ||
  OIDC_ISSUER
);

if (OAUTH_ENABLED) {
  const missing = [];

  if (USING_EXTERNAL_OIDC) {
    if (!OIDC_AUTHORIZATION_ENDPOINT) missing.push('TOKEN_AI_OIDC_AUTHORIZATION_ENDPOINT');
    if (!OIDC_TOKEN_ENDPOINT) missing.push('TOKEN_AI_OIDC_TOKEN_ENDPOINT');
    if (!OIDC_USERINFO_ENDPOINT) missing.push('TOKEN_AI_OIDC_USERINFO');
  } else {
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  }

  if (missing.length) {
    console.error(`[oauth] missing required env for OAuth provider: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!OIDC_CLIENT_ID) {
    console.warn('[oauth] TOKEN_AI_OIDC_CLIENT_ID is not set; metadata will omit a default client_id.');
  }
}

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
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
const rawHost = forwardedHost || String(req?.headers?.host || '').split(',')[0].trim();
const protoHeader = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
const proto = protoHeader || (req?.connection?.encrypted ? 'https' : 'http');

  const pathnameHint = (() => {
    try {
      const pathname = new URL(req?.url || '', 'http://local').pathname || '/';
      if (pathname.startsWith('/mcp')) return '/mcp';
      return '';
    } catch {
      return '';
    }
  })();

  const pathSuffix = pathnameHint || '/mcp';

  if (PUBLIC_URL) {
    try {
      const configured = new URL(PUBLIC_URL);
      const configuredPath = configured.pathname.replace(/\/$/, '');
      if (!rawHost || rawHost === configured.host) {
        return `${configured.origin}${configuredPath}`;
      }
    } catch {}
  }

  if (rawHost) {
    const base = `${proto || 'http'}://${rawHost}${pathSuffix}`;
    return base.replace(/\/$/, '');
  }

  return `http://localhost:${PORT}${pathSuffix}`.replace(/\/$/, '');
}

function normalizedHost(req){
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  const rawHost = forwardedHost || String(req?.headers?.host || '').split(',')[0].trim();
  return rawHost.toLowerCase();
}

function resolveClientId(req){
  // Revert to a single OIDC client id (cid_*). Do not vary by host.
  return OIDC_CLIENT_ID;
}

function getAdvertisedOAuthEndpoints(req) {
  // Advertise OAuth under the same base as the MCP URL (per-client discovery expectations)
  const base = effectiveBaseUrl(req).replace(/\/$/, '');
  return {
    authorization: `${base}/authorize`,
    token: `${base}/token`,
  };
}

function buildConnectorApiUrl(pathname, search) {
  const normalizedPath = pathname.replace(/^\/+/, '');
  const target = new URL(normalizedPath, `${CONNECTOR_API_BASE}/`);
  if (search) target.search = search;
  return target.toString();
}

function getProviderConfig(req) {
  if (!OAUTH_ENABLED) return null;

  if (USING_EXTERNAL_OIDC) {
    return {
      type: 'oidc',
      issuer: OIDC_ISSUER || undefined,
      authorization_endpoint: OIDC_AUTHORIZATION_ENDPOINT,
      token_endpoint: OIDC_TOKEN_ENDPOINT,
      registration_endpoint: OIDC_REGISTRATION_ENDPOINT || undefined,
      userinfo_endpoint: OIDC_USERINFO_ENDPOINT,
      jwks_uri: OIDC_JWKS_URI || undefined,
      client_id: resolveClientId(req),
      scopes: OIDC_SCOPES,
      identity_claim: OIDC_IDENTITY_CLAIM,
      allowed_users: OIDC_ALLOWED_USERS,
    };
  }

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const base = SUPABASE_URL.replace(/\/$/, '');
    return {
      type: 'oidc',
      issuer: SUPABASE_URL,
      authorization_endpoint: `${base}/auth/v1/authorize`,
      token_endpoint: `${base}/auth/v1/token`,
      userinfo_endpoint: `${base}/auth/v1/user`,
      jwks_uri: `${base}/auth/v1/jwks`,
      client_id: resolveClientId(req),
      scopes: OIDC_SCOPES,
      identity_claim: OIDC_IDENTITY_CLAIM,
      allowed_users: OIDC_ALLOWED_USERS,
    };
  }

  return null;
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
    const fwdHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
    const rawHost = fwdHost || String(req?.headers?.host || '').split(',')[0].trim();
    const protoHeader = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const scheme = protoHeader || (req?.connection?.encrypted ? 'https' : 'http');
    const origin = rawHost ? `${scheme}://${rawHost}` : '';
    const prmUrl = origin ? `${origin}/.well-known/oauth-protected-resource/mcp` : '';
    const redirect = `${base}/callback`;
    const prov = getProviderConfig(req);
    if (prov) {
      const advertised = getAdvertisedOAuthEndpoints(req);
      const client = resolveClientId(req) || prov.client_id || '';
      const issuer = prov.issuer || '';
    const rawScopes = (prov.scopes || '').split(/\s+/).filter(Boolean);
    const walletScopes = rawScopes.filter((s) => s.startsWith('wallet.'));
    const baseScopes = walletScopes.length ? walletScopes : rawScopes;
    const advertisedScope = includeOpenId(baseScopes).join(' ');
      res.setHeader('WWW-Authenticate', `Bearer realm="MCP", authorization_uri="${advertised.authorization}", token_uri="${advertised.token}", client_id="${client}", redirect_uri="${redirect}", scope="${advertisedScope}", issuer="${issuer}"`);
    } else {
      res.setHeader('WWW-Authenticate', `Bearer realm="MCP"`);
    }
    res.setHeader('Cache-Control','no-store');
    // Ensure MCP-required PRM pointer in WWW-Authenticate
    try {
      if (prmUrl && typeof res.getHeader === 'function') {
        const curr = res.getHeader('WWW-Authenticate');
        if (typeof curr === 'string') {
          if (!curr.includes('resource_metadata=')) {
            res.setHeader('WWW-Authenticate', `${curr}, resource_metadata="${prmUrl}"`);
          }
        } else if (!curr) {
          res.setHeader('WWW-Authenticate', `Bearer realm="MCP", resource_metadata="${prmUrl}"`);
        }
      }
    } catch {}
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

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
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

function includeOpenId(scopesArr) {
  try {
    const set = new Set((scopesArr || []).map(String));
    set.add('openid');
    return Array.from(set);
  } catch { return scopesArr || ['openid']; }
}

function requestPrefersHtml(req) {
  const accept = String(req.headers['accept'] || '').toLowerCase();
  if (accept.includes('text/html') || accept.includes('text/plain')) return true;
  const fetchMode = String(req.headers['sec-fetch-mode'] || '').toLowerCase();
  return fetchMode === 'navigate';
}

async function forwardAuthorize(req, res) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const targetUrl = buildConnectorApiUrl('connector/oauth/authorize', url.search);
  let apiResponse;
  try {
    apiResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'accept': 'application/json',
        'content-type': req.headers['content-type'] || undefined,
        'authorization': req.headers['authorization'] || undefined,
        'cookie': req.headers['cookie'] || undefined,
      },
    });
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'connector_authorize_unreachable', message: error?.message || String(error) }));
    return;
  }

  const contentType = apiResponse.headers.get('content-type') || '';
  const text = await apiResponse.text();

  if (!apiResponse.ok) {
    const status = apiResponse.status || 502;
    if (requestPrefersHtml(req)) {
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(text || 'Authorization failed');
    } else {
      res.writeHead(status, { 'Content-Type': contentType || 'application/json' });
      res.end(text);
    }
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  // Always issue a 302 to the IdP login_url when available so non-browser clients
  // (like ChatGPT resolvers) see a proper redirect during discovery/validation.
  if (parsed?.login_url) {
    res.writeHead(302, { Location: parsed.login_url });
    res.end();
    return;
  }

  res.writeHead(apiResponse.status, { 'Content-Type': contentType || 'application/json' });
  res.end(text);
}

async function forwardToken(req, res) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const targetUrl = buildConnectorApiUrl('connector/oauth/token', url.search);
  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await readRawBody(req);
  }
  let apiResponse;
  try {
    apiResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'accept': 'application/json',
        'content-type': req.headers['content-type'] || undefined,
        'authorization': req.headers['authorization'] || undefined,
        'cookie': req.headers['cookie'] || undefined,
      },
      body,
    });
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'connector_token_unreachable', message: error?.message || String(error) }));
    return;
  }

  const headersObj = {};
  apiResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    headersObj[key] = value;
  });
  const buffer = Buffer.from(await apiResponse.arrayBuffer());
  res.writeHead(apiResponse.status, headersObj);
  res.end(buffer);
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

  if (prov.type === 'oidc') {
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
  const isAuthMeta = (
    pathname === '/.well-known/oauth-authorization-server' ||
    pathname === '/mcp/.well-known/oauth-authorization-server' ||
    pathname === '/.well-known/oauth-authorization-server/mcp'
  );
  const isProtectedMeta = (
    pathname === '/.well-known/oauth-protected-resource'
    || pathname === '/.well-known/oauth-protected-resource/mcp'
    || pathname === '/mcp/.well-known/oauth-protected-resource'
  );
  const isOidcMeta = (pathname === '/.well-known/openid-configuration' || pathname === '/mcp/.well-known/openid-configuration');
  const isMcpManifest = (pathname === '/.well-known/mcp.json' || pathname === '/mcp/.well-known/mcp.json');
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
    const scopes = (prov?.scopes || '').split(/\s+/).filter(Boolean);
    const advertisedScopes = scopes.filter((scope) => scope.startsWith('wallet.'));
    const publishScopes = advertisedScopes.length ? advertisedScopes : scopes;
    const publishWithOpenId = includeOpenId(publishScopes);
    const advertised = getAdvertisedOAuthEndpoints(req);
    const issuer = effectiveBaseUrl(req);
    const clientId = resolveClientId(req);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control':'no-store' });
    res.end(JSON.stringify({
      issuer,
      authorization_endpoint: advertised.authorization,
      token_endpoint: advertised.token,
      registration_endpoint: prov?.registration_endpoint || undefined,
      userinfo_endpoint: prov?.userinfo_endpoint || (SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/,'')}/auth/v1/user` : ''),
      token_endpoint_auth_methods_supported: ['none','client_secret_post', 'client_secret_basic'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: publishWithOpenId,
      id_token_signing_alg_values_supported: rsaPublicJwk ? ['RS256'] : (HS256_SECRET ? ['HS256'] : []),
      mcp: { client_id: clientId || '', redirect_uri: `${effectiveBaseUrl(req)}/callback` }
    }));
    return true;
  }

  if (isProtectedMeta) {
    try { console.log(`[oauth-meta] serve protected metadata for ${pathname} ua=${req?.headers?.['user-agent']||''}`); } catch {}
    const base = effectiveBaseUrl(req).replace(/\/$/, '');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control':'no-store' });
    res.end(JSON.stringify({
      resource: base,
      // RFC 9728 requires authorization_servers to list AS issuer identifiers, not metadata URLs
      authorization_servers: [base],
      scopes_supported: ['wallet.read', 'wallet.trade'],
    }));
    return true;
  }

  if (isOidcMeta) {
    try { console.log(`[oauth-meta] serve oidc metadata for ${pathname} ua=${req?.headers?.['user-agent']||''}`); } catch {}
    const supa = (SUPABASE_URL || '').replace(/\/$/, '');
    if (supa) {
      const target = `${supa}/auth/v1/.well-known/openid-configuration`;
      res.writeHead(302, { Location: target, 'Cache-Control': 'no-store' });
      res.end();
      return true;
    }
    // Fallback if SUPABASE_URL not configured
    const prov = getProviderConfig(req);
    const scopes = (prov?.scopes || '').split(/\s+/).filter(Boolean);
    const advertisedScopes = scopes.filter((scope) => scope.startsWith('wallet.'));
    const publishScopes = advertisedScopes.length ? advertisedScopes : scopes;
    const publishWithOpenId = includeOpenId(publishScopes);
    const advertised = getAdvertisedOAuthEndpoints(req);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control':'no-store' });
    res.end(JSON.stringify({
      issuer: effectiveBaseUrl(req),
      authorization_endpoint: advertised.authorization,
      token_endpoint: advertised.token,
      token_endpoint_auth_methods_supported: ['none','client_secret_post', 'client_secret_basic'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: publishWithOpenId
    }));
    return true;
  }

  if (isMcpManifest) {
    try { console.log(`[oauth-meta] serve mcp manifest for ${pathname} ua=${req?.headers?.['user-agent']||''}`); } catch {}
    const prov = getProviderConfig(req);
    const base = effectiveBaseUrl(req);
    const scopes = (prov?.scopes || '').split(/\s+/).filter(Boolean);
    const advertisedScopes = scopes.filter((scope) => scope.startsWith('wallet.'));
    const publishScopes = advertisedScopes.length ? advertisedScopes : scopes;
    const publishWithOpenId = includeOpenId(publishScopes);
    const advertised = getAdvertisedOAuthEndpoints(req);
    const clientId = resolveClientId(req);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control':'no-store' });
    res.end(JSON.stringify({
      name: process.env.MCP_SERVER_NAME || 'dexter-mcp',
      url: base,
      description: 'Dexter MCP toolsets',
      version: process.env.MCP_SERVER_VERSION || '0.1.0',
      authorization: prov ? {
        type: 'oauth',
        authorization_url: advertised.authorization,
        token_url: advertised.token,
        client_id: clientId || '',
        redirect_uri: `${base}/callback`,
        scopes: publishWithOpenId,
        pkce_required: true,
        code_challenge_methods: ['S256'],
      } : null,
      // Expose client info here as well for clients that read only mcp.json
      mcp: { client_id: clientId || '', redirect_uri: `${base}/callback` },
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
    if (OAUTH_ENABLED && (url.pathname === '/authorize' || url.pathname === '/mcp/authorize')) {
      await forwardAuthorize(req, res);
      return;
    }
    if (OAUTH_ENABLED && (url.pathname === '/token' || url.pathname === '/mcp/token')) {
      await forwardToken(req, res);
      return;
    }
    // Handle OAuth callback (support both /callback and /mcp/callback)
    if (OAUTH_ENABLED && (url.pathname === '/mcp/callback' || url.pathname === '/callback')) {
      handleOAuthCallback(url, res);
      return;
    }
    
    const rawPath = url.pathname || '/';
    const normalizedPath = rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '');
    const isRootEndpoint = normalizedPath === '/';
    const isMcpEndpoint = normalizedPath === '/mcp';
    if (!isRootEndpoint && !isMcpEndpoint) { res.writeHead(404).end('Not Found'); return; }
    
    // Authentication check (supports session reuse without repeating Authorization)
    const auth = String(req.headers['authorization'] || '');
    const sidIn = req.headers['mcp-session-id'];
    const hasSession = sidIn && transports.has(sidIn);
    if (OAUTH_ENABLED) {
      if (!hasSession) {
        // New session: require bearer. Accept either:
        // 1) Server bearer (TOKEN_AI_MCP_TOKEN) for non-OAuth clients
        // 2) OAuth bearer validated via external OIDC provider
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
              const { sessionWalletOverrides } = await import('./toolsets/wallet/index.mjs');
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
            const { sessionWalletOverrides } = await import('./toolsets/wallet/index.mjs');
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
    } else {
      console.log(`OAuth enabled but provider configuration is incomplete.`);
    }
    const base = PUBLIC_URL || `http://localhost:${PORT}/mcp`;
    console.log(`OAuth metadata: ${base.replace(/\/$/,'')}/.well-known/oauth-authorization-server`);
  }
});

//
