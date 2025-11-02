import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { getCodexBridge, formatStructuredResult } from '../../codex-bridge.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const MCP_JWT_SECRET = (process.env.MCP_JWT_SECRET || '').trim();

const bridge = getCodexBridge();

const START_KEY_MAP = {
  approval_policy: 'approval-policy',
  base_instructions: 'base-instructions',
  include_plan_tool: 'include-plan-tool',
};

const REPLY_KEY_MAP = {
  conversation_id: 'conversationId',
  approval_policy: 'approval-policy',
  base_instructions: 'base-instructions',
  include_plan_tool: 'include-plan-tool',
};

const EXEC_KEY_MAP = {
  output_schema: 'outputSchema',
  metadata: 'metadata',
  approval_policy: 'approval-policy',
  base_instructions: 'base-instructions',
  include_plan_tool: 'include-plan-tool',
};

function mapArguments(source, keyMap = {}, { omit = [] } = {}) {
  const out = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (value === undefined || omit.includes(key)) continue;
    const mappedKey = keyMap[key] || key;
    out[mappedKey] = value;
  }
  return out;
}

const startShape = {
  prompt: z.string().min(1, 'prompt_required'),
  approval_policy: z.string().optional(),
  base_instructions: z.string().optional(),
  config: z.record(z.any()).optional(),
  include_plan_tool: z.boolean().optional(),
  model: z.string().optional(),
  profile: z.string().optional(),
  sandbox: z.string().optional(),
};
const startSchema = z.object(startShape).passthrough();

const replyShape = {
  conversation_id: z.string().min(1, 'conversation_id_required'),
  prompt: z.string().min(1, 'prompt_required'),
  approval_policy: z.string().optional(),
  base_instructions: z.string().optional(),
  config: z.record(z.any()).optional(),
  include_plan_tool: z.boolean().optional(),
  model: z.string().optional(),
  profile: z.string().optional(),
  sandbox: z.string().optional(),
};
const replySchema = z.object(replyShape).passthrough();

const execShape = {
  prompt: z.string().min(1, 'prompt_required'),
  output_schema: z.union([z.string(), z.record(z.any())]).optional(),
  metadata: z.record(z.any()).optional(),
  approval_policy: z.string().optional(),
  base_instructions: z.string().optional(),
  config: z.record(z.any()).optional(),
  include_plan_tool: z.boolean().optional(),
  model: z.string().optional(),
  profile: z.string().optional(),
  sandbox: z.string().optional(),
};
const execSchema = z.object(execShape).passthrough();

function buildTextResponse({ conversationId, message }) {
  const lines = [];
  if (message) {
    lines.push(String(message));
  }
  lines.push(`conversation_id: ${conversationId}`);
  return lines.join('\n\n');
}

function warnSandboxOverride(tool, sandbox) {
  console.warn(
    '[codex-toolset]',
    `${tool} ignoring sandbox override (${sandbox}); bridge enforces read-only sandbox.`,
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

function extractBearer(extra) {
  const headers = headersFromExtra(extra);
  const auth = headers?.authorization || headers?.Authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token && token !== process.env.TOKEN_AI_MCP_TOKEN) {
      return token;
    }
  }
  const xAuth = headers?.['x-authorization'] || headers?.['X-Authorization'];
  if (typeof xAuth === 'string' && xAuth.startsWith('Bearer ')) {
    const token = xAuth.slice(7).trim();
    if (token && token !== process.env.TOKEN_AI_MCP_TOKEN) {
      return token;
    }
  }
  const envToken = process.env.MCP_SUPABASE_BEARER;
  return envToken ? String(envToken).trim() : '';
}

function extractRoles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').toLowerCase());
  if (typeof value === 'string') return [value.toLowerCase()];
  return [];
}

function base64UrlToBuffer(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = normalized + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
}

function decodeDexterJwt(token) {
  if (!token || !MCP_JWT_SECRET) return null;
  try {
    const segments = token.split('.');
    if (segments.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = segments;
    const data = `${headerB64}.${payloadB64}`;
    const expected = createHmac('sha256', MCP_JWT_SECRET).update(data).digest();
    const signature = base64UrlToBuffer(signatureB64);
    if (signature.length !== expected.length) {
      return null;
    }
    if (!timingSafeEqual(signature, expected)) {
      return null;
    }
    const payloadJson = base64UrlToBuffer(payloadB64).toString('utf8');
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
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

async function fetchSupabaseUser(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
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
    return data || null;
  } catch (error) {
    console.warn('[codex-toolset] failed to fetch supabase user', error?.message || error);
    return null;
  }
}

async function ensureSuperAdmin(extra) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[codex-toolset] SUPABASE_URL/ANON_KEY not configured; refusing codex access');
    throw new Error('superadmin_required');
  }
  const token = extractBearer(extra);
  if (!token) {
    throw new Error('superadmin_required');
  }
  const jwtClaims = decodeDexterJwt(token);
  if (!jwtClaims) {
    const secretPreview = MCP_JWT_SECRET
      ? createHmac('sha256', 'codex-secret-check').update(MCP_JWT_SECRET).digest('hex').slice(0, 8)
      : 'missing';
    console.warn('[codex-toolset] failed to decode MCP JWT; falling back to Supabase lookup', { secretPreview });
  }
  if (jwtClaims) {
    const claimRoles = extractRoles(jwtClaims.roles);
    if (!claimRoles.length) {
      console.warn('[codex-toolset] decoded MCP JWT without roles claim', { sub: jwtClaims.sub || null });
    }
    if (claimRoles.includes('superadmin')) {
      return;
    }
  }
  const user = await fetchSupabaseUser(token);
  if (!user) {
    throw new Error('superadmin_required');
  }
  const roles = extractRoles(user.app_metadata?.roles);
  const roleAllows = roles.includes('superadmin');
  const metaAllows = normalizeBoolean(user.user_metadata?.isSuperAdmin);
  if (!roleAllows && !metaAllows) {
    throw new Error('superadmin_required');
  }
}

export function registerCodexToolset(server) {
  server.registerTool(
    'codex_start',
    {
      title: 'Start Codex Session',
      description: 'Begin a new Codex conversation (read-only, search-enabled).',
      _meta: {
        category: 'codex.session',
        access: 'dev',
        tags: ['codex', 'session', 'start'],
      },
      inputSchema: startShape,
    },
    async (input, extra) => {
      await ensureSuperAdmin(extra);
      const parsed = startSchema.parse(input || {});
      const { prompt, sandbox, ...rest } = parsed;
      if (sandbox && sandbox !== 'read-only') {
        warnSandboxOverride('codex_start', sandbox);
      }
      const args = mapArguments(rest, START_KEY_MAP, { omit: ['sandbox'] });
      const result = await bridge.startSession({ prompt, ...args }, extra);
      const structured = formatStructuredResult(result);
      return {
        structuredContent: structured,
        content: [
          {
            type: 'text',
            text: buildTextResponse(structured),
          },
        ],
      };
    },
  );

  server.registerTool(
    'codex_reply',
    {
      title: 'Continue Codex Session',
      description: 'Send a follow-up prompt to an existing Codex conversation.',
      _meta: {
        category: 'codex.session',
        access: 'dev',
        tags: ['codex', 'session', 'reply'],
      },
      inputSchema: replyShape,
    },
    async (input, extra) => {
      await ensureSuperAdmin(extra);
      const parsed = replySchema.parse(input || {});
      const { conversation_id, sandbox, ...rest } = parsed;
      if (sandbox && sandbox !== 'read-only') {
        warnSandboxOverride('codex_reply', sandbox);
      }
      const args = mapArguments(rest, REPLY_KEY_MAP, { omit: ['sandbox'] });
      const result = await bridge.continueSession({ conversationId: conversation_id, ...args }, extra);
      const structured = formatStructuredResult(result);
      return {
        structuredContent: structured,
        content: [
          {
            type: 'text',
            text: buildTextResponse(structured),
          },
        ],
      };
    },
  );

  server.registerTool(
    'codex_exec',
    {
      title: 'Codex Exec Session',
      description:
        'Run Codex exec with optional JSON schema. Returns structuredContent when the schema is provided.',
      _meta: {
        category: 'codex.session',
        access: 'dev',
        tags: ['codex', 'exec', 'structured'],
      },
      inputSchema: execShape,
    },
    async (input, extra) => {
      await ensureSuperAdmin(extra);
      const parsed = execSchema.parse(input || {});
      const { sandbox, ...rest } = parsed;
      if (sandbox && sandbox !== 'read-only') {
        warnSandboxOverride('codex_exec', sandbox);
      }
      const args = mapArguments(rest, EXEC_KEY_MAP, { omit: ['sandbox'] });
      const result = await bridge.execSession(args, extra);
      const structured = formatStructuredResult(result);
      const { structuredContent, raw, ...summary } = result;
      return {
        structuredContent: structuredContent || summary,
        content: [
          {
            type: 'text',
            text: buildTextResponse(structured),
          },
        ],
        metadata: {
          conversationId: structured.conversationId,
          durationMs: structured.durationMs,
          structuredContent: structuredContent || null,
          raw: raw || null,
        },
      };
    },
  );
}
