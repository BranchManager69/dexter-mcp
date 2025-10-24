import { z } from 'zod';

import { fetchWithX402Json } from '../../clients/x402Client.mjs';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || 'http://localhost:3030';

function buildApiUrl(base, path) {
  const normalizedBase = (base || '').replace(/\/+$/, '');
  if (!path) return normalizedBase || '';
  let normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedBase.endsWith('/api')) {
    if (normalizedPath === '/api') {
      normalizedPath = '';
    } else if (normalizedPath.startsWith('/api/')) {
      normalizedPath = normalizedPath.slice(4);
    }
  }
  return `${normalizedBase}${normalizedPath}` || normalizedPath;
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
  const candidates = [
    headers?.authorization || headers?.Authorization,
    headers?.['x-authorization'] || headers?.['X-Authorization'],
    headers?.['x-user-token'] || headers?.['X-User-Token'],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      if (candidate.startsWith('Bearer ')) {
        const token = candidate.slice(7).trim();
        if (token && token !== process.env.TOKEN_AI_MCP_TOKEN) {
          return token;
        }
      } else if (candidate.length > 0 && !candidate.includes(' ')) {
        return candidate.trim();
      }
    }
  }

  const envToken = process.env.MCP_SUPABASE_BEARER;
  return envToken ? String(envToken) : null;
}

async function apiFetch(path, init, extra) {
  const base = (process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  const token = getSupabaseBearer(extra);
  const headers = Object.assign(
    {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    init?.headers || {},
    token ? { Authorization: `Bearer ${token}` } : {},
  );
  const url = buildApiUrl(base, path);
  const requestInit = { ...init, headers };
  if (requestInit.body && typeof requestInit.body !== 'string') {
    requestInit.body = JSON.stringify(requestInit.body);
  }
  const { response, json, text } = await fetchWithX402Json(
    url,
    requestInit,
    {
      metadata: { toolset: 'didi', path },
      authHeaders: headers,
    },
  );
  if (!response.ok) {
    let payload = json;
    if (!payload && text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    const errorMessage = payload?.error || payload?.message || `request_failed:${response.status}`;
    throw new Error(errorMessage);
  }
  return json ?? {};
}

export function registerDidiToolset(server) {
  server.registerTool(
    'didi_message',
    {
      title: 'Didi Supportive Reply',
      description: 'Send a message to Didi, Dexter’s supportive listener, and receive her response.',
      _meta: {
        category: 'wellbeing.support',
        access: 'managed',
        tags: ['support', 'listener', 'didi'],
      },
      inputSchema: {
        message: z.string().min(1).describe('The text the user wants to share with Didi.'),
        session_id: z.string().uuid().optional().describe('Existing Didi session to continue. Optional.'),
      },
    },
    async (args = {}, extra) => {
      const message = typeof args?.message === 'string' ? args.message.trim() : '';
      if (!message) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'message_required' }) }],
          isError: true,
        };
      }

      try {
        const payload = await apiFetch(
          '/api/didi/message',
          {
            method: 'POST',
            body: {
              message,
              sessionId: args?.session_id || undefined,
            },
          },
          extra,
        );

        const summary = {
          sessionId: payload.sessionId,
          reply: payload.reply,
          ended: payload.ended,
          history: payload.history || [],
        };

        return {
          structuredContent: summary,
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'didi_message_failed', message: error?.message || String(error) }) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'didi_end_session',
    {
      title: 'End Didi Session',
      description: 'Close the current Didi session so a fresh conversation can start later.',
      _meta: {
        category: 'wellbeing.support',
        access: 'managed',
        tags: ['support', 'didi', 'session'],
      },
      inputSchema: {
        session_id: z.string().uuid().optional().describe('Session identifier to close. If omitted, the most recent active session will be ended.'),
      },
    },
    async (args = {}, extra) => {
      try {
        let sessionId = typeof args?.session_id === 'string' ? args.session_id : '';
        if (!sessionId) {
          const active = await apiFetch('/api/didi/session', { method: 'GET' }, extra);
          sessionId = active?.session?.sessionId || '';
          if (!sessionId) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ error: 'no_active_session' }) }],
              structuredContent: { ended: false },
            };
          }
        }

        const result = await apiFetch(`/api/didi/session/${sessionId}`, { method: 'DELETE' }, extra);

        return {
          structuredContent: result,
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'didi_end_failed', message: error?.message || String(error) }) }],
          isError: true,
        };
      }
    },
  );
}
