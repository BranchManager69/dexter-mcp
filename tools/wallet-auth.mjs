import { z } from 'zod';

// Per-session wallet overrides (for HTTP sessions) and a shared fallback for stdio
// Keyed by MCP session id when available; otherwise 'stdio'.
export const sessionWalletOverrides = new Map(); // sessionKey -> wallet_id

// Auth + Wallet resolution helpers
export function getBearerFromHeaders(headers){
  try {
    const h = headers || {};
    // Highest priority: explicit user token header
    const xUserToken = String(h['x-user-token'] || h['X-User-Token'] || '');
    if (xUserToken) return xUserToken.trim();
    // Next: X-Authorization (supports either raw token or Bearer <token>)
    const xAuthorization = String(h['x-authorization'] || h['X-Authorization'] || '');
    if (xAuthorization.startsWith('Bearer ')) return xAuthorization.slice(7).trim();
    if (xAuthorization) return xAuthorization.trim();
    // Fallback: standard Authorization header
    const auth = String(h['authorization'] || h['Authorization'] || '');
    if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
    // As a last resort accept X-Api-Key
    const xApiKey = String(h['x-api-key'] || h['X-Api-Key'] || '');
    if (xApiKey) return xApiKey.trim();
  } catch {}
  return null;
}

export function parseBearerMap(){
  // Supports JSON: { "tokenA": "wallet-id-1", ... } or csv: tokenA:walletA,tokenB:walletB
  try {
    const j = process.env.TOKEN_AI_MCP_BEARER_MAP_JSON;
    if (j) { const obj = JSON.parse(j); if (obj && typeof obj === 'object') return obj; }
  } catch {}
  try {
    const s = process.env.TOKEN_AI_MCP_BEARER_MAP || '';
    if (s) {
      const out = {};
      for (const part of s.split(',')) {
        const [k, v] = part.split(':');
        if (k && v) out[k.trim()] = v.trim();
      }
      return out;
    }
  } catch {}
  return {};
}

const BEARER_MAP = parseBearerMap();

function headersFromExtra(extra){
  try {
    if (extra?.requestInfo?.headers) return extra.requestInfo.headers;
  } catch {}
  try {
    if (extra?.request?.headers) return extra.request.headers;
  } catch {}
  try {
    if (extra?.httpRequest?.headers) return extra.httpRequest.headers;
  } catch {}
  return {};
}

export function resolveWalletForRequest(extra){
  // 1) OAuth identity mapping via oauth_user_wallets
  try {
    const headers = headersFromExtra(extra);
    const issuer = String(headers['x-user-issuer'] || '').trim();
    const subject = String(headers['x-user-sub'] || '').trim();
    if (issuer && subject) {
      // lookup default mapping
      const doLookup = async () => {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const map = await prisma.oauth_user_wallets.findFirst({ where: { provider: issuer, subject, default_wallet: true } });
        if (map?.wallet_id) return String(map.wallet_id);
        // If no default, pick first mapping
        const any = await prisma.oauth_user_wallets.findFirst({ where: { provider: issuer, subject }, orderBy: { created_at: 'asc' } });
        return any?.wallet_id ? String(any.wallet_id) : null;
      };
      // Note: resolveWalletForRequest is sync; return placeholder and let callers do async resolution when needed.
      // For most tool entry points we call resolveWalletForRequest then recheck if null.
      // To preserve sync signature, cache to a side-channel header that tools can read.
      // Here we just mark intent; tools will re-resolve if missing.
    }
  } catch {}
  // 0) Session override takes precedence when set
  try {
    const sid = String(headersFromExtra(extra)['mcp-session-id'] || 'stdio');
    if (sessionWalletOverrides.has(sid)) {
      const wid = sessionWalletOverrides.get(sid);
      if (wid) return { wallet_id: wid, source: 'session' };
    }
  } catch {}
  try {
    // HTTP transport: extract from request headers
    const bearer = getBearerFromHeaders(headersFromExtra(extra));
    if (bearer && BEARER_MAP[bearer]) {
      return { wallet_id: BEARER_MAP[bearer], source: 'bearer' };
    }
  } catch {}
  // STDIO or fallback: allow env to carry a bearer-like token
  try {
    const envToken = process.env.MCP_BEARER_TOKEN || process.env.TOKEN_AI_BEARER_TOKEN || '';
    if (envToken && BEARER_MAP[envToken]) {
      return { wallet_id: BEARER_MAP[envToken], source: 'bearer' };
    }
  } catch {}
  // Default env wallet id
  const envDefault = process.env.TOKEN_AI_DEFAULT_WALLET_ID || '';
  if (envDefault) return { wallet_id: envDefault, source: 'env' };
  return { wallet_id: null, source: 'none' };
}

async function getIdentity(extra){
  const headers = headersFromExtra(extra);
  // Prefer Supabase user id from X-User-Token (JWT signed by UI server)
  let supabaseUserId = null;
  try {
    const tok = String(headers['x-user-token'] || headers['X-User-Token'] || '').trim();
    const secret = process.env.MCP_USER_JWT_SECRET || process.env.TOKEN_AI_EVENTS_TOKEN || '';
    if (tok && secret) {
      const { jwtVerifyHS256 } = await import('../../server/utils/jwt.js');
      const payload = jwtVerifyHS256(tok, secret);
      if (payload && (payload.sub || payload.user_id)) supabaseUserId = String(payload.sub || payload.user_id);
    }
  } catch {}
  // Also capture OAuth provider identity if present (HTTP OAuth path)
  let issuer = null, subject = null;
  try {
    issuer = String(headers['x-user-issuer'] || headers['X-User-Issuer'] || '').trim() || null;
    subject = String(headers['x-user-sub'] || headers['X-User-Sub'] || '').trim() || null;
  } catch {}
  return { supabaseUserId, issuer, subject };
}

export async function userOwnsWallet(walletId, extra){
  try {
    const wid = String(walletId || '').trim();
    if (!wid) return false;
    const ident = await getIdentity(extra);
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    // Prefer Supabase mapping when available
    if (ident.supabaseUserId) {
      const row = await prisma.oauth_user_wallets.findFirst({ where: { wallet_id: wid, supabase_user_id: ident.supabaseUserId } });
      if (row) return true;
    }
    if (ident.issuer && ident.subject) {
      const row = await prisma.oauth_user_wallets.findFirst({ where: { wallet_id: wid, provider: ident.issuer, subject: ident.subject } });
      if (row) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function parseAdmins(){
  const emails = (process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  const subs = (process.env.ADMIN_OAUTH_SUBS||'').split(',').map(s=>s.trim()).filter(Boolean);
  const bearers = (process.env.ADMIN_BEARERS||'').split(',').map(s=>s.trim()).filter(Boolean);
  return { emails, subs, bearers };
}

function isAdminFromHeaders(headers){
  try {
    const { emails, subs, bearers } = parseAdmins();
    const email = String(headers['x-user-email']||'').toLowerCase();
    const sub = String(headers['x-user-sub']||'');
    const auth = String(headers['authorization']||'');
    const bearer = auth.startsWith('Bearer ')? auth.slice(7): '';
    if (email && emails.includes(email)) return true;
    if (sub && subs.includes(sub)) return true;
    if (bearer && bearers.includes(bearer)) return true;
  } catch {}
  return false;
}

export function registerWalletAuthTools(server) {
  // Auth helper: resolve current wallet for this session
  server.registerTool('resolve_wallet', {
    title: 'Resolve Wallet',
    description: 'Returns the effective wallet_id for this caller based on bearer token or env default.',
    outputSchema: { wallet_id: z.string().nullable(), source: z.string() }
  }, async (_args, extra) => {
    const r = resolveWalletForRequest(extra);
    try { console.log(`[wallet-auth] resolve_wallet sid=${extra?.sessionId||'∅'} wallet=${r.wallet_id||'∅'} source=${r.source}`); } catch {}
    return { structuredContent: r, content:[{ type:'text', text: r.wallet_id || 'none' }] };
  });

  // List my wallets (OAuth identity bound)
  server.registerTool('list_my_wallets', {
    title: 'List My Wallets',
    description: 'List wallets linked to the current authenticated user and indicate the default.',
    outputSchema: { wallets: z.array(z.object({ id: z.string(), public_key: z.string(), wallet_name: z.string().nullable(), is_default: z.boolean() })) }
  }, async (args, extra) => {
    try {
      const headers = headersFromExtra(extra);
      const issuer = String(args?.__issuer || headers['x-user-issuer']||'');
      const subject = String(args?.__sub || headers['x-user-sub']||'');
      if (!issuer || !subject) {
        // Fallback: return the currently resolved effective wallet (env/session/bearer)
        try {
          const r = resolveWalletForRequest(extra);
          if (r?.wallet_id) {
            const { PrismaClient } = await import('@prisma/client');
            const prisma = new PrismaClient();
            const w = await prisma.managed_wallets.findUnique({ where: { id: String(r.wallet_id) } });
            if (w) {
              const wallets = [{ id: String(w.id), public_key: w.public_key, wallet_name: w.label, is_default: true }];
              return { structuredContent: { wallets }, content:[{ type:'text', text: JSON.stringify(wallets) }] };
            }
          }
        } catch {}
        return { content:[{ type:'text', text:'no_oauth_identity' }], isError:true };
      }
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      // Attempt to resolve canonical Supabase user id for broader match during migration
      let supabaseUserId = null;
      try {
        const link = await prisma.account_links.findUnique({ where: { oauth_provider_oauth_subject: { oauth_provider: issuer, oauth_subject: subject } } });
        supabaseUserId = link?.supabase_user_id || null;
      } catch {}
      const where = supabaseUserId
        ? { OR: [{ provider: issuer, subject }, { supabase_user_id: supabaseUserId }] }
        : { provider: issuer, subject };
      const links = await prisma.oauth_user_wallets.findMany({ where, include: { wallet: true }, orderBy: { created_at: 'asc' } });
      const wallets = links.map(l => ({ id: l.wallet_id, public_key: l.wallet?.public_key || '', wallet_name: l.wallet?.label || null, is_default: !!l.default_wallet }));
      return { structuredContent: { wallets }, content:[{ type:'text', text: JSON.stringify(wallets) }] };
    } catch (e) { return { content:[{ type:'text', text: e?.message||'list_failed' }], isError:true }; }
  });

  // Link a wallet to current user
  server.registerTool('link_wallet_to_me', {
    title: 'Link Wallet To Me',
    description: 'Associate an existing managed wallet with the current OAuth user.',
    inputSchema: { wallet_id: z.string(), make_default: z.boolean().optional() },
    outputSchema: { ok: z.boolean() }
  }, async ({ wallet_id, make_default, __issuer, __sub }, extra) => {
    try {
      const headers = headersFromExtra(extra);
      const issuer = String(__issuer || headers['x-user-issuer']||'');
      const subject = String(__sub || headers['x-user-sub']||'');
      if (!issuer || !subject) return { content:[{ type:'text', text:'no_oauth_identity' }], isError:true };
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      // Enforce per-user cap for non-admins
      const admin = isAdminFromHeaders(headers);
      if (!admin) {
        const count = await prisma.oauth_user_wallets.count({ where: { provider: issuer, subject } });
        if (count >= 10) return { content:[{ type:'text', text:'max_wallets_reached' }], isError:true };
      }
      // Ensure wallet exists
      const w = await prisma.managed_wallets.findUnique({ where: { id: String(wallet_id) } });
      if (!w) return { content:[{ type:'text', text:'wallet_not_found' }], isError:true };
      // Resolve canonical Supabase user id for this OAuth identity (if linked)
      let supabaseUserId = null;
      try {
        const link = await prisma.account_links.findUnique({ where: { oauth_provider_oauth_subject: { oauth_provider: issuer, oauth_subject: subject } } });
        supabaseUserId = link?.supabase_user_id || null;
      } catch {}
      // Upsert link and anchor supabase_user_id when available
      await prisma.oauth_user_wallets.upsert({
        where: { provider_subject_wallet_id: { provider: issuer, subject, wallet_id: String(wallet_id) } },
        update: { ...(supabaseUserId ? { supabase_user_id: supabaseUserId } : {}) },
        create: { provider: issuer, subject, wallet_id: String(wallet_id), default_wallet: false, ...(supabaseUserId ? { supabase_user_id: supabaseUserId } : {}) }
      });
      if (make_default) {
        await prisma.oauth_user_wallets.updateMany({ where: { provider: issuer, subject }, data: { default_wallet: false } });
        await prisma.oauth_user_wallets.update({ where: { provider_subject_wallet_id: { provider: issuer, subject, wallet_id: String(wallet_id) } }, data: { default_wallet: true } });
      }
      return { structuredContent: { ok: true }, content:[{ type:'text', text:'ok' }] };
    } catch (e) { return { content:[{ type:'text', text: e?.message||'link_failed' }], isError:true }; }
  });

  server.registerTool('set_my_default_wallet', {
    title: 'Set My Default Wallet',
    description: 'Set the default wallet for the current OAuth user.',
    inputSchema: { wallet_id: z.string() },
    outputSchema: { ok: z.boolean() }
  }, async ({ wallet_id, __issuer, __sub }, extra) => {
    try {
      const headers = headersFromExtra(extra);
      const issuer = String(__issuer || headers['x-user-issuer']||'');
      const subject = String(__sub || headers['x-user-sub']||'');
      if (!issuer || !subject) return { content:[{ type:'text', text:'no_oauth_identity' }], isError:true };
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const exists = await prisma.oauth_user_wallets.findUnique({ where: { provider_subject_wallet_id: { provider: issuer, subject, wallet_id: String(wallet_id) } } });
      if (!exists) return { content:[{ type:'text', text:'not_linked' }], isError:true };
      await prisma.oauth_user_wallets.updateMany({ where: { provider: issuer, subject }, data: { default_wallet: false } });
      await prisma.oauth_user_wallets.update({ where: { provider_subject_wallet_id: { provider: issuer, subject, wallet_id: String(wallet_id) } }, data: { default_wallet: true } });
      return { structuredContent: { ok: true }, content:[{ type:'text', text:'ok' }] };
    } catch (e) { return { content:[{ type:'text', text: e?.message||'set_default_failed' }], isError:true }; }
  });

  server.registerTool('unlink_wallet_from_me', {
    title: 'Unlink Wallet From Me',
    description: 'Remove association between current OAuth user and a wallet.',
    inputSchema: { wallet_id: z.string() },
    outputSchema: { ok: z.boolean() }
  }, async ({ wallet_id, __issuer, __sub }, extra) => {
    try {
      const headers = headersFromExtra(extra);
      const issuer = String(__issuer || headers['x-user-issuer']||'');
      const subject = String(__sub || headers['x-user-sub']||'');
      if (!issuer || !subject) return { content:[{ type:'text', text:'no_oauth_identity' }], isError:true };
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.oauth_user_wallets.delete({ where: { provider_subject_wallet_id: { provider: issuer, subject, wallet_id: String(wallet_id) } } });
      return { structuredContent: { ok: true }, content:[{ type:'text', text:'ok' }] };
    } catch (e) { return { content:[{ type:'text', text: e?.message||'unlink_failed' }], isError:true }; }
  });

  // Session-scoped wallet override (without changing bearer/env)
  server.registerTool('set_session_wallet', {
    title: 'Set Session Wallet',
    description: 'Override the effective wallet_id for this MCP session only. Use resolve_wallet to inspect.',
    inputSchema: { wallet_id: z.string().optional(), clear: z.boolean().optional() },
    outputSchema: { ok: z.boolean(), wallet_id: z.string().nullable(), cleared: z.boolean().optional() }
  }, async ({ wallet_id, clear }, extra) => {
    try {
      const sid = String(extra?.requestInfo?.headers?.['mcp-session-id'] || 'stdio');
      if (clear) {
        sessionWalletOverrides.delete(sid);
        return { structuredContent: { ok: true, wallet_id: null, cleared: true }, content:[{ type:'text', text:'cleared' }] };
      }
      if (!wallet_id) return { content:[{ type:'text', text:'missing wallet_id' }], isError:true };
      // Enforce ownership: only allow setting a wallet linked to this user/session
      const owns = await userOwnsWallet(String(wallet_id), extra);
      if (!owns) return { content:[{ type:'text', text:'forbidden_wallet' }], isError:true };
      sessionWalletOverrides.set(sid, String(wallet_id));
      return { structuredContent: { ok: true, wallet_id: String(wallet_id) }, content:[{ type:'text', text:String(wallet_id) }] };
    } catch (e) {
      return { content:[{ type:'text', text: e?.message || 'set_failed' }], isError:true };
    }
  });

  // Auth info for diagnostics
  server.registerTool('auth_info', {
    title: 'Auth Info',
    description: 'Diagnostics for wallet resolution and bearer/header state for this session.',
    outputSchema: {
      source: z.string(),
      wallet_id: z.string().nullable(),
      session_id: z.string().nullable(),
      transport: z.string().nullable(),
      issuer: z.string().nullable(),
      subject: z.string().nullable(),
      default_wallet: z.string().nullable(),
      bearer_header: z.string().nullable(),
      bearer_preview: z.string().nullable(),
      mapping_hit: z.boolean().optional(),
    }
  }, async (args, extra) => {
    const headers = headersFromExtra(extra);
    const session_id = String(headers['mcp-session-id'] || 'stdio');
    const injectedIssuer = args?.__issuer ? String(args.__issuer) : null;
    const injectedSub = args?.__sub ? String(args.__sub) : null;
    const issuer = injectedIssuer || (headers['x-user-issuer'] ? String(headers['x-user-issuer']) : null);
    const subject = injectedSub || (headers['x-user-sub'] ? String(headers['x-user-sub']) : null);
    const transport = issuer || subject || headers['mcp-session-id'] ? 'http' : 'stdio';
    const def = process.env.TOKEN_AI_DEFAULT_WALLET_ID || null;
    const bear = getBearerFromHeaders(headers);
    const bearPrev = bear ? `${bear.slice(0,4)}…${bear.slice(-4)}` : null;
    const map = parseBearerMap();
    const hit = !!(bear && map[bear]);
    const resolved = resolveWalletForRequest(extra);
    return { 
      structuredContent: { 
        source: resolved.source, 
        wallet_id: resolved.wallet_id, 
        session_id, 
        transport,
        issuer,
        subject,
        default_wallet: def, 
        bearer_header: bear || null, 
        bearer_preview: bearPrev, 
        mapping_hit: hit 
      }, 
      content:[{ type:'text', text: JSON.stringify({ source: resolved.source, wallet_id: resolved.wallet_id, session_id }, null, 2) }] 
    };
  });

  // Generate a new wallet and link to current OAuth user
  server.registerTool('generate_wallet', {
    title: 'Generate Wallet',
    description: 'Creates a new managed wallet and links it to the current OAuth user (non-admins limited to 10).',
    inputSchema: { label: z.string().optional() },
    outputSchema: { wallet_id: z.string(), public_key: z.string(), is_default: z.boolean() }
  }, async ({ label }, extra) => {
    try {
      const headers = extra?.requestInfo?.headers || {};
      const issuer = String(headers['x-user-issuer']||'');
      const subject = String(headers['x-user-sub']||'');
      if (!issuer || !subject) return { content:[{ type:'text', text:'no_oauth_identity' }], isError:true };
      const admin = isAdminFromHeaders(headers);
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      if (!admin) {
        const count = await prisma.oauth_user_wallets.count({ where: { provider: issuer, subject } });
        if (count >= 10) return { content:[{ type:'text', text:'max_wallets_reached' }], isError:true };
      }
      const { randomBytes, createCipheriv } = await import('node:crypto');
      const { Keypair } = await import('@solana/web3.js');
      const { v4: uuidv4 } = await import('uuid');
      const kp = Keypair.generate();
      const seed32 = Buffer.from(kp.secretKey).subarray(0, 32);
      const encKeyHex = process.env.WALLET_ENCRYPTION_KEY || '';
      if (!encKeyHex || encKeyHex.length !== 64) return { content:[{ type:'text', text:'missing_encryption_key' }], isError:true };
      const key = Buffer.from(encKeyHex, 'hex');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(seed32), cipher.final()]);
      const tag = cipher.getAuthTag();
      const payload = {
        version: 'v2_seed_unified',
        nonce: iv.toString('hex'),
        encrypted: encrypted.toString('hex'),
        authTag: tag.toString('hex')
      };
      const wid = uuidv4();
      const pub = kp.publicKey.toBase58();
      const name = label || `Wallet ${pub.slice(0,4)}…${pub.slice(-4)}`;
      await prisma.managed_wallets.create({ data: { id: wid, public_key: pub, encrypted_private_key: JSON.stringify(payload), label: name, status: 'active' } });
      // Resolve Supabase user id if linked and include it in mapping
      let supabaseUserId = null;
      try {
        const link = await prisma.account_links.findUnique({ where: { oauth_provider_oauth_subject: { oauth_provider: issuer, oauth_subject: subject } } });
        supabaseUserId = link?.supabase_user_id || null;
      } catch {}
      // Link and set default
      await prisma.oauth_user_wallets.create({ data: { provider: issuer, subject, wallet_id: wid, default_wallet: false, ...(supabaseUserId ? { supabase_user_id: supabaseUserId } : {}) } });
      await prisma.oauth_user_wallets.updateMany({ where: { provider: issuer, subject }, data: { default_wallet: false } });
      await prisma.oauth_user_wallets.update({ where: { provider_subject_wallet_id: { provider: issuer, subject, wallet_id: wid } }, data: { default_wallet: true } });
      return { structuredContent: { wallet_id: wid, public_key: pub, is_default: true }, content:[{ type:'text', text: `wallet_id=${wid} ${pub}` }] };
    } catch (e) {
      return { content:[{ type:'text', text: e?.message || 'generate_failed' }], isError:true };
    }
  });
}
