import { z } from 'zod';

const DEFAULT_API_BASE_URL = 'http://localhost:3030';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

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

async function requireSupabaseUser(extra, errorCode = 'authentication_required') {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[stream-toolset] SUPABASE_URL/ANON_KEY not configured; refusing authenticated access');
    throw new Error(errorCode);
  }
  const token = getSupabaseBearer(extra);
  if (!token) {
    throw new Error(errorCode);
  }
  const supabaseBase = SUPABASE_URL.replace(/\/$/, '');
  try {
    const response = await fetch(`${supabaseBase}/auth/v1/user`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
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
