import { createHmac } from 'node:crypto';
import { z } from 'zod';

console.log('[stream-toolset] init', {
  jwtSecretLen: getMcpJwtSecret().length,
  supabaseUrl: getSupabaseUrl() ? 'set' : 'missing',
});

const DEFAULT_API_BASE_URL = 'http://localhost:3030';
function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || '').trim();
}

function getSupabaseAnonKey() {
  return (process.env.SUPABASE_ANON_KEY || '').trim();
}

function getMcpJwtSecret() {
  return (process.env.MCP_JWT_SECRET || '').trim();
}

function resolveBaseUrl() {
  const raw =
    process.env.STREAM_SCENE_API_BASE_URL ||
    process.env.DEXTER_STREAM_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.DEXTER_API_BASE_URL ||
    DEFAULT_API_BASE_URL;
  return raw.replace(/\/$/, '');
}
function resolveEnvPassword() {
  return (
    process.env.MCP_STREAM_SCENE_PASSWORD ||
    process.env.STREAM_SCENE_PASSWORD ||
    ''
  );
}

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
  const auth = headers?.authorization || headers?.Authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token && token !== process.env.TOKEN_AI_MCP_TOKEN) {
      return token;
    }
  }
  const fallback = headers?.['x-authorization'] || headers?.['X-Authorization'];
  if (typeof fallback === 'string' && fallback.startsWith('Bearer ')) {
    const token = fallback.slice(7).trim();
    if (token && token !== process.env.TOKEN_AI_MCP_TOKEN) {
      return token;
    }
  }
  const envToken = process.env.MCP_SUPABASE_BEARER;
  return envToken ? String(envToken) : null;
}

async function apiFetch(path, init, extra) {
  const base = resolveBaseUrl();
  const token = getSupabaseBearer(extra);
  const headers = Object.assign({}, init?.headers || {}, token ? { Authorization: `Bearer ${token}` } : {});
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    let payload = text;
    try {
      payload = JSON.parse(text);
    } catch {}
    throw new Error(payload?.error || payload?.message || `request_failed:${response.status}`);
  }
  return text ? JSON.parse(text) : {};
}

const getSceneSchema = z
  .object({})
  .passthrough();

const setSceneSchema = z
  .object({
    scene: z.string().min(1, 'scene_required'),
    password: z.string().min(1).optional(),
    use_env_password: z.boolean().optional(),
  })
  .passthrough();

const shoutInputSchema = z.object({
  message: z
    .string()
    .min(5, 'message_too_short')
    .max(280, 'message_too_long')
    .describe('Broadcast message (5-280 characters).'),
  alias: z
    .string()
    .min(2, 'alias_too_short')
    .max(32, 'alias_too_long')
    .describe('Optional display name (2-32 characters).')
    .optional(),
});

const shoutFeedSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1, 'limit_too_small')
    .max(50, 'limit_too_large')
    .describe('Maximum number of shouts to fetch (1-50).')
    .optional(),
});

function normalizeScene(scene) {
  return typeof scene === 'string' ? scene.trim().toLowerCase() : '';
}

function extractRoles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').toLowerCase());
  if (typeof value === 'string') return [value.toLowerCase()];
  return [];
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    return lowered === 'true' || lowered === '1' || lowered === 'yes';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
}

function normalizeBearerToken(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  return trimmed.startsWith('Bearer ') ? trimmed.slice(7).trim() : trimmed;
}

function base64UrlToBuffer(segment) {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 2 ? '==' : padded.length % 4 === 3 ? '=' : '';
  return Buffer.from(padded + pad, 'base64');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function verifyDexterMcpJwt(rawToken) {
  const secret = getMcpJwtSecret();
  if (!secret) return null;
  const token = normalizeBearerToken(rawToken);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  try {
    const data = `${headerPart}.${payloadPart}`;
    const expected = createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    if (!timingSafeEqual(expected, signaturePart)) {
      return null;
    }
    const header = JSON.parse(base64UrlToBuffer(headerPart).toString('utf8'));
    if (!header || header.alg !== 'HS256') {
      return null;
    }
    const payload = JSON.parse(base64UrlToBuffer(payloadPart).toString('utf8'));
    if (!payload) return null;
    if (typeof payload.exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec >= payload.exp) {
        return null;
      }
    }
    return payload;
  } catch {
    return null;
  }
}

function buildUserFromJwtPayload(payload) {
  if (!payload) return null;
  const supabaseId =
    (typeof payload.supabase_user_id === 'string' && payload.supabase_user_id.trim()) ||
    (typeof payload.sub === 'string' && payload.sub !== 'guest' ? payload.sub.trim() : null);
  if (!supabaseId) return null;

  const roles = Array.isArray(payload.roles)
    ? payload.roles.map((role) => String(role))
    : [];

  const email = typeof payload.supabase_email === 'string' ? payload.supabase_email : null;
  const userMetadata =
    payload.user_metadata && typeof payload.user_metadata === 'object'
      ? { ...payload.user_metadata }
      : {};
  if (payload.wallet_public_key && !userMetadata.wallet_public_key) {
    userMetadata.wallet_public_key = payload.wallet_public_key;
  }

  return {
    id: supabaseId,
    email,
    app_metadata: { roles },
    user_metadata: userMetadata,
  };
}

async function requireSupabaseUser(extra, errorCode = 'authentication_required') {
  const token = getSupabaseBearer(extra);
  if (!token) {
    console.warn('[stream-toolset] requireSupabaseUser no bearer found');
    throw new Error(errorCode);
  }
  console.warn('[stream-toolset] bearer snippet', typeof token === 'string' ? token.slice(0, 24) : typeof token);
  console.warn('[stream-toolset] secret length', getMcpJwtSecret().length);
  const jwtPayload = verifyDexterMcpJwt(token);
  const jwtUser = buildUserFromJwtPayload(jwtPayload);
  if (jwtUser) {
    console.warn('[stream-toolset] authenticated via MCP JWT', { id: jwtUser.id });
    return jwtUser;
  }
  console.warn('[stream-toolset] MCP JWT verification failed; falling back to Supabase lookup');
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnon = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnon) {
    console.warn('[stream-toolset] SUPABASE_URL/ANON_KEY not configured and token is not a Dexter MCP JWT');
    throw new Error(errorCode);
  }
  const supabaseBase = supabaseUrl.replace(/\/$/, '');
  try {
    const response = await fetch(`${supabaseBase}/auth/v1/user`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: supabaseAnon,
      },
    });
    if (!response.ok) {
      throw new Error(errorCode);
    }
    const user = await response.json().catch(() => null);
    if (!user?.id) {
      throw new Error(errorCode);
    }
    return user;
  } catch (error) {
    throw new Error(errorCode);
  }
}

async function ensureSignedIn(extra) {
  return requireSupabaseUser(extra, 'authentication_required');
}

async function ensureProAccess(extra) {
  const user = await requireSupabaseUser(extra, 'pro_membership_required');
  const roles = extractRoles(user.app_metadata?.roles);
  const isSuperAdmin = roles.includes('superadmin') || normalizeBoolean(user.user_metadata?.isSuperAdmin);
  const isPro = roles.includes('pro') || normalizeBoolean(user.user_metadata?.isProMember);
  if (!isSuperAdmin && !isPro) {
    throw new Error('pro_membership_required');
  }
  return user;
}

export function registerStreamToolset(server) {
  server.registerTool(
    'stream_get_scene',
    {
      title: 'Get Stream Scene',
      description: 'Fetch the current DexterVision scene and available options.',
      _meta: {
        category: 'stream.management',
        access: 'pro',
        tags: ['scene', 'status'],
      },
      inputSchema: getSceneSchema.shape,
    },
    async (_input, extra) => {
      await ensureProAccess(extra);
      const result = await apiFetch('/stream/scene', { method: 'GET' }, extra);
      return {
        structuredContent: result,
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
        metadata: {
          updatedAt: result?.updatedAt || null,
          scenes: result?.scenes || null,
        },
      };
    }
  );

  server.registerTool(
    'stream_set_scene',
    {
      title: 'Set Stream Scene',
      description: 'Switch the DexterVision scene (requires scene password).',
      _meta: {
        category: 'stream.management',
        access: 'pro',
        tags: ['scene', 'control'],
      },
      inputSchema: setSceneSchema.shape,
    },
    async (input, extra) => {
      const parsed = setSceneSchema.parse(input || {});
      const scene = normalizeScene(parsed.scene);
      if (!scene) {
        throw new Error('scene_required');
      }

      const passwordFromInput = typeof parsed.password === 'string' ? parsed.password.trim() : '';
      const shouldUseEnv = parsed.use_env_password !== false;
      const envPassword = shouldUseEnv ? resolveEnvPassword().trim() : '';
      const chosenPassword = passwordFromInput || envPassword;

      const body = { scene };
      if (chosenPassword) {
        body.password = chosenPassword;
      }

      await ensureProAccess(extra);
      const result = await apiFetch(
        '/stream/scene',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        extra
      );

      return {
        structuredContent: result,
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
        metadata: {
          updatedAt: result?.updatedAt || null,
          scene: result?.scene || null,
        },
      };
    }
  );

  server.registerTool(
    'stream_public_shout',
    {
      title: 'Send Stream Public Shout',
      description: 'Submit a short shout-out for Dexter to highlight on the live stream.',
      _meta: {
        category: 'stream.engagement',
        access: 'member',
        tags: ['stream', 'shout', 'engagement'],
      },
      inputSchema: shoutInputSchema.shape,
    },
    async (input, extra) => {
      const parsed = shoutInputSchema.parse(input || {});
      await ensureSignedIn(extra);
      const payload = {
        message: parsed.message,
        ...(parsed.alias ? { alias: parsed.alias } : {}),
      };
      const result = await apiFetch(
        '/stream/shout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        extra
      );
      const summary = {
        id: result?.shout?.id ?? null,
        alias: result?.shout?.alias ?? null,
        expires_at: result?.shout?.expires_at ?? null,
      };
      return {
        structuredContent: result,
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary),
          },
        ],
      };
    }
  );

  server.registerTool(
    'stream_shout_feed',
    {
      title: 'Fetch Stream Public Shouts',
      description: 'Retrieve the latest public shouts queued for the stream overlay.',
      _meta: {
        category: 'stream.engagement',
        access: 'member',
        tags: ['stream', 'shout', 'feed'],
      },
      inputSchema: shoutFeedSchema.shape,
    },
    async (input, extra) => {
      const parsed = shoutFeedSchema.parse(input || {});
      // Feed is public but requireSignedIn ensures concierge sessions carry auth context.
      await ensureSignedIn(extra);
      const searchParams = new URLSearchParams();
      if (parsed.limit) {
        searchParams.set('limit', String(parsed.limit));
      }
      const query = searchParams.toString();
      const result = await apiFetch(
        `/stream/shout-feed${query ? `?${query}` : ''}`,
        { method: 'GET' },
        extra
      );
      const summary = {
        fetched: Array.isArray(result?.shouts) ? result.shouts.length : 0,
      };
      return {
        structuredContent: result,
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary),
          },
        ],
      };
    }
  );
}

export default { registerStreamToolset };
