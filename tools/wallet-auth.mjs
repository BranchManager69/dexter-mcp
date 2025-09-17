import { z } from 'zod';

export const sessionWalletOverrides = new Map(); // sessionKey -> wallet_id

const RESOLVER_CACHE = new Map(); // cacheKey -> { data, fetchedAt }
const RESOLVER_CACHE_MS = Number(process.env.MCP_WALLET_RESOLVER_CACHE_MS || 5000);
const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || 'http://localhost:3030';

function headersFromExtra(extra) {
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

function getSupabaseBearer(extra) {
  const headers = headersFromExtra(extra);
  try {
    const auth = String(headers['authorization'] || headers['Authorization'] || '').trim();
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7).trim();
      if (token) return { token, source: 'authorization' };
    }
  } catch {}
  try {
    const xAuth = String(headers['x-authorization'] || headers['X-Authorization'] || '').trim();
    if (xAuth.startsWith('Bearer ')) {
      const token = xAuth.slice(7).trim();
      if (token) return { token, source: 'x-authorization' };
    }
  } catch {}
  try {
    const xUserToken = String(headers['x-user-token'] || headers['X-User-Token'] || '').trim();
    if (xUserToken) return { token: xUserToken, source: 'x-user-token' };
  } catch {}
  const envToken = String(process.env.MCP_SUPABASE_BEARER || '').trim();
  if (envToken) return { token: envToken, source: 'env' };
  return { token: null, source: null };
}

function cacheKeyFor(token, apiBase) {
  return `${apiBase}|${token}`;
}

function parseResolverResponse(json) {
  if (!json || typeof json !== 'object') return null;
  if (json.ok === false) return null;
  const wallets = Array.isArray(json.wallets) ? json.wallets : Array.isArray(json?.data?.wallets) ? json.data.wallets : json?.wallets || [];
  const user = json.user || json?.data?.user || null;
  return { wallets, user };
}

async function fetchWalletContext(extra) {
  const { token, source } = getSupabaseBearer(extra);
  if (!token) return null;

  const apiBase = (process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  const key = cacheKeyFor(token, apiBase);
  const cached = RESOLVER_CACHE.get(key);
  if (cached && Date.now() - cached.fetchedAt < RESOLVER_CACHE_MS) {
    return cached.data;
  }

  try {
    const resp = await fetch(`${apiBase}/api/wallets/resolver`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Resolver-Source': source || 'unknown',
      },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => 'resolver_error');
      console.warn('[wallet-auth] resolver fetch failed', resp.status, text.slice(0, 200));
      return null;
    }
    const json = await resp.json().catch(() => null);
    const parsed = parseResolverResponse(json);
    if (!parsed) return null;
    RESOLVER_CACHE.set(key, { data: parsed, fetchedAt: Date.now() });
    return parsed;
  } catch (err) {
    console.warn('[wallet-auth] resolver fetch threw', err?.message || err);
    return null;
  }
}

function pickDefaultWallet(context) {
  if (!context?.wallets || !context.wallets.length) return null;
  return context.wallets.find((w) => w.isDefault || w.is_default) || context.wallets[0];
}

export async function resolveWalletForRequest(extra) {
  const headers = headersFromExtra(extra);
  const sessionId = String(headers['mcp-session-id'] || headers['Mcp-Session-Id'] || 'stdio');
  if (sessionWalletOverrides.has(sessionId)) {
    const walletId = sessionWalletOverrides.get(sessionId);
    return { wallet_id: walletId || null, source: 'session', userId: null, wallets: null };
  }

  const context = await fetchWalletContext(extra);
  if (context && context.wallets?.length) {
    const defaultWallet = pickDefaultWallet(context);
    return {
      wallet_id: defaultWallet ? defaultWallet.walletId || defaultWallet.id || null : null,
      source: 'resolver',
      userId: context.user?.id || null,
      wallets: context.wallets,
    };
  }

  const envDefault = String(process.env.TOKEN_AI_DEFAULT_WALLET_ID || '').trim();
  if (envDefault) {
    return { wallet_id: envDefault, source: 'env', userId: context?.user?.id || null, wallets: context?.wallets || [] };
  }

  return { wallet_id: null, source: 'none', userId: context?.user?.id || null, wallets: context?.wallets || [] };
}

export async function userOwnsWallet(walletId, extra) {
  try {
    const context = await fetchWalletContext(extra);
    if (!context?.wallets?.length) return false;
    return context.wallets.some((wallet) => {
      const id = wallet.walletId || wallet.id;
      return id && String(id) === String(walletId);
    });
  } catch {
    return false;
  }
}

function sanitizeWalletList(wallets) {
  if (!Array.isArray(wallets)) return [];
  return wallets.map((wallet) => ({
    id: wallet.walletId || wallet.id || null,
    public_key: wallet.publicAddress || wallet.public_key || null,
    label: wallet.label || wallet.wallet_name || null,
    is_default: Boolean(wallet.isDefault ?? wallet.is_default ?? false),
    status: wallet.status || null,
  })).filter((wallet) => wallet.id && wallet.public_key);
}

export function registerWalletAuthTools(server) {
  server.registerTool('resolve_wallet', {
    title: 'Resolve Wallet',
    description: 'Resolve the effective managed wallet for this caller (session override, resolver default, or env fallback).',
    outputSchema: {
      wallet_id: z.string().nullable(),
      source: z.string(),
      user_id: z.string().nullable().optional()
    }
  }, async (_args, extra) => {
    const resolved = await resolveWalletForRequest(extra);
    return {
      structuredContent: { wallet_id: resolved.wallet_id, source: resolved.source, user_id: resolved.userId || null },
      content: [{ type: 'text', text: resolved.wallet_id || 'none' }],
    };
  });

  server.registerTool('list_my_wallets', {
    title: 'List My Wallets',
    description: 'List wallets linked to the authenticated Supabase user.',
    outputSchema: {
      user: z.object({ id: z.string().optional().nullable() }).nullable(),
      wallets: z.array(z.object({
        id: z.string(),
        public_key: z.string(),
        label: z.string().nullable(),
        is_default: z.boolean(),
        status: z.string().nullable().optional(),
      }))
    }
  }, async (_args, extra) => {
    const context = await fetchWalletContext(extra);
    if (!context) {
      return { content: [{ type: 'text', text: 'resolver_unavailable' }], isError: true };
    }
    const wallets = sanitizeWalletList(context.wallets);
    return {
      structuredContent: { user: context.user || null, wallets },
      content: [{ type: 'text', text: JSON.stringify({ count: wallets.length }) }],
    };
  });

  server.registerTool('set_session_wallet_override', {
    title: 'Set Session Wallet Override',
    description: 'Override the wallet used for this MCP session (until cleared).',
    inputSchema: {
      wallet_id: z.string().optional(),
      clear: z.boolean().optional(),
    },
    outputSchema: {
      ok: z.boolean(),
      wallet_id: z.string().nullable(),
      cleared: z.boolean().optional(),
    }
  }, async ({ wallet_id, clear }, extra) => {
    const headers = headersFromExtra(extra);
    const sessionId = String(headers['mcp-session-id'] || headers['Mcp-Session-Id'] || 'stdio');
    if (clear) {
      sessionWalletOverrides.delete(sessionId);
      return { structuredContent: { ok: true, wallet_id: null, cleared: true }, content: [{ type: 'text', text: 'cleared' }] };
    }
    if (!wallet_id) {
      return { content: [{ type: 'text', text: 'wallet_id_required' }], isError: true };
    }
    const owns = await userOwnsWallet(String(wallet_id), extra);
    if (!owns) {
      return { content: [{ type: 'text', text: 'forbidden_wallet' }], isError: true };
    }
    sessionWalletOverrides.set(sessionId, String(wallet_id));
    return { structuredContent: { ok: true, wallet_id: String(wallet_id) }, content: [{ type: 'text', text: String(wallet_id) }] };
  });

  server.registerTool('auth_info', {
    title: 'Auth Info',
    description: 'Diagnostics for wallet resolution, session overrides, and Supabase token state.',
    outputSchema: {
      wallet_id: z.string().nullable(),
      source: z.string(),
      user_id: z.string().nullable().optional(),
      bearer_source: z.string().nullable().optional(),
      has_token: z.boolean(),
      override_session: z.string().nullable(),
      wallets_cached: z.number().int().optional(),
    }
  }, async (_args, extra) => {
    const headers = headersFromExtra(extra);
    const sessionId = String(headers['mcp-session-id'] || headers['Mcp-Session-Id'] || 'stdio');
    const { token, source } = getSupabaseBearer(extra);
    const resolved = await resolveWalletForRequest(extra);
    const context = token ? await fetchWalletContext(extra) : null;
    return {
      structuredContent: {
        wallet_id: resolved.wallet_id,
        source: resolved.source,
        user_id: resolved.userId || null,
        bearer_source: source,
        has_token: Boolean(token),
        override_session: sessionWalletOverrides.has(sessionId) ? sessionId : null,
        wallets_cached: context?.wallets?.length || 0,
      },
      content: [{ type: 'text', text: JSON.stringify({ wallet_id: resolved.wallet_id, source: resolved.source, token: source || 'none' }) }],
    };
  });
}
