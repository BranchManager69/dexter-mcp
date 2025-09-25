import { z } from 'zod';

const DEFAULT_API_BASE_URL = 'http://localhost:3030';

function resolveBaseUrl() {
  const raw =
    process.env.STREAM_SCENE_API_BASE_URL ||
    process.env.DEXTER_STREAM_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.DEXTER_API_BASE_URL ||
    DEFAULT_API_BASE_URL;
  return raw.replace(/\/$/, '');
}
const ENV_PASSWORD = process.env.MCP_STREAM_SCENE_PASSWORD || process.env.STREAM_SCENE_PASSWORD || '';

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
    return auth.slice(7).trim();
  }
  const fallback = headers?.['x-authorization'] || headers?.['X-Authorization'];
  if (typeof fallback === 'string' && fallback.startsWith('Bearer ')) {
    return fallback.slice(7).trim();
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

function normalizeScene(scene) {
  return typeof scene === 'string' ? scene.trim().toLowerCase() : '';
}

export function registerStreamToolset(server) {
  server.registerTool(
    'stream_get_scene',
    {
      title: 'Get Stream Scene',
      description: 'Fetch the current DexterVision scene and available options.',
      _meta: {
        category: 'stream.management',
        access: 'managed',
        tags: ['scene', 'status'],
      },
      inputSchema: getSceneSchema.shape,
    },
    async (_input, extra) => {
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
        access: 'restricted',
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
      const chosenPassword = passwordFromInput || (shouldUseEnv ? ENV_PASSWORD : '');

      const body = { scene };
      if (chosenPassword) {
        body.password = chosenPassword;
      }

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
}

export default { registerStreamToolset };
