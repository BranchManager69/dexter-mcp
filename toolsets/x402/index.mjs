import { listX402Resources } from '../../registry/x402/index.mjs';
import { buildInputSchemaShape } from '../../lib/x402/zod.mjs';
import { normalizeX402Fields, trimUrl } from '../../lib/x402/utils.mjs';
import { fetchWithX402Json } from '../../clients/x402Client.mjs';

const ALLOWED_HOSTS = new Set(['api.dexter.cash']);

const PATH_OVERRIDES = new Map([
  [
    '/stream/shout',
    {
      name: 'stream_public_shout',
      title: 'Send Stream Public Shout',
      category: 'stream.engagement',
      access: 'member',
      tags: ['stream', 'shout', 'engagement'],
    },
  ],
  [
    '/onchain/activity',
    {
      name: 'onchain_activity_overview',
      title: 'On-chain Activity Overview',
      category: 'onchain.analytics',
      access: 'member',
      tags: ['onchain', 'activity', 'flows'],
    },
  ],
  [
    '/onchain/entity',
    {
      name: 'onchain_entity_insight',
      title: 'On-chain Entity Insight',
      category: 'onchain.analytics',
      access: 'member',
      tags: ['onchain', 'entity', 'analysis'],
    },
  ],
  [
    '/api/slippage/sentinel',
    {
      name: 'slippage_sentinel',
      title: 'Slippage Sentinel Analysis',
      category: 'risk.monitoring',
      access: 'member',
      tags: ['slippage', 'risk'],
    },
  ],
  [
    '/api/jupiter/quote',
    {
      name: 'jupiter_quote_preview',
      title: 'Jupiter Swap Quote Preview',
      category: 'solana.trading',
      access: 'member',
      tags: ['jupiter', 'quote', 'swap'],
    },
  ],
  [
    '/api/tools/twitter/analyze',
    {
      name: 'twitter_topic_analysis',
      title: 'Twitter Topic Analysis',
      category: 'research.social',
      access: 'member',
      tags: ['twitter', 'analysis'],
    },
  ],
  [
    '/api/tools/solscan/trending',
    {
      name: 'solscan_trending_tokens',
      title: 'Solscan Trending Tokens',
      category: 'research.market',
      access: 'member',
      tags: ['solscan', 'trending'],
    },
  ],
  [
    '/api/tools/sora/jobs',
    {
      name: 'sora_video_job',
      title: 'Submit Sora Video Job',
      category: 'creative.jobs',
      access: 'member',
      tags: ['sora', 'video', 'job'],
    },
  ],
  [
    '/api/tools/memes/jobs',
    {
      name: 'meme_generator_job',
      title: 'Submit Meme Generator Job',
      category: 'creative.jobs',
      access: 'member',
      tags: ['memes', 'job'],
    },
  ],
  [
    '/api/tools/x402/scan/stats',
    {
      name: 'x402_scan_stats',
      title: 'x402 Catalog Scan Stats',
      category: 'diagnostics.x402',
      access: 'member',
      tags: ['x402', 'diagnostics'],
    },
  ],
  [
    '/api/payments/x402/access/gmgn',
    {
      name: 'gmgn_snapshot_access',
      title: 'Unlock GMGN Snapshot Access',
      category: 'gmgn.analytics',
      access: 'member',
      tags: ['gmgn', 'access'],
    },
  ],
]);

function isToolRegistered(server, name) {
  if (!server || !name) return false;
  try {
    if (typeof server.listTools === 'function') {
      const listed = server.listTools();
      if (Array.isArray(listed)) {
        return listed.some((tool) => tool?.name === name);
      }
    }
  } catch {}
  try {
    if (server._registeredTools && typeof server._registeredTools === 'object') {
      return Boolean(server._registeredTools[name]);
    }
  } catch {}
  return false;
}

function normalizePath(inputPath) {
  if (!inputPath) return '/';
  const urlLike = (() => {
    try {
      const url = new URL(inputPath);
      return url.pathname;
    } catch {
      return inputPath;
    }
  })();
  let path = urlLike.trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/+/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path || '/';
}

function slugFromPath(pathname) {
  const normalized = normalizePath(pathname);
  const segments = normalized.split('/').filter(Boolean);
  if (!segments.length) return 'resource';
  if (segments[0] === 'api' && segments.length > 1) {
    segments.shift();
  }
  return segments.join('_');
}

function deriveHost(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function deriveToolMeta({ resourceUrl, resource, accept }) {
  const normalizedPath = normalizePath(resource?.metadata?.path || resourceUrl);
  const override = PATH_OVERRIDES.get(normalizedPath);
  const name = override?.name || slugFromPath(normalizedPath);
  const title = override?.title || accept?.title || accept?.description || `Invoke ${normalizedPath}`;
  const description = override?.description || accept?.description || `Invoke ${trimUrl(resourceUrl)}`;
  const category = override?.category || 'x402.dynamic';
  const access = override?.access || 'guest';
  const tags = Array.from(new Set([...(override?.tags || []), 'paid']));
  return { name, title, description, category, access, tags, path: normalizedPath };
}

function applyQueryParams(url, params) {
  const target = new URL(url);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        search.append(key, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    } else if (typeof value === 'object') {
      search.set(key, JSON.stringify(value));
    } else {
      search.set(key, String(value));
    }
  }
  target.search = search.toString();
  return target.toString();
}

function buildBody(args) {
  const body = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    body[key] = value;
  }
  // Always return a JSON object, even if empty, for POST requests
  return JSON.stringify(body);
}

function resolveAuthToken(extra) {
  const headerSources = [
    extra?.requestInfo?.headers,
    extra?.httpRequest?.headers,
    extra?.request?.headers,
  ].filter(Boolean);

  for (const headers of headerSources) {
    const token =
      headers?.authorization ||
      headers?.Authorization ||
      headers?.['x-user-token'] ||
      headers?.['X-User-Token'];
    if (typeof token === 'string' && token.trim()) {
      if (token.startsWith('Bearer ')) {
        return token.slice(7).trim();
      }
      return token.trim();
    }
  }

  const fallback = String(process.env.MCP_SUPABASE_BEARER || '').trim();
  return fallback || null;
}

export async function registerX402Toolset(server) {
  let resources = [];
  try {
    resources = await listX402Resources();
  } catch (error) {
    console.warn('[x402] failed to load resource catalog', error?.message || error);
    return;
  }

  const takenNames = new Set();

  for (const resource of resources) {
    const normalized = normalizeX402Fields(resource.raw || {});
    const accepts = Array.isArray(resource.accepts)
      ? resource.accepts
      : Array.isArray(normalized.accepts)
        ? normalized.accepts
        : [];

    accepts.forEach((accept) => {
      const resourceUrl = accept?.resource || resource.resourceUrl;
      const host = deriveHost(resourceUrl);
      if (!host || !ALLOWED_HOSTS.has(host)) {
        return;
      }

      const toolMeta = deriveToolMeta({ resourceUrl, resource, accept });
      if (!toolMeta?.name || takenNames.has(toolMeta.name) || isToolRegistered(server, toolMeta.name)) {
        return;
      }

      takenNames.add(toolMeta.name);

      const outputSchema = accept?.outputSchema || {};
      const input = outputSchema?.input || {};
      const method = String(input?.method || 'GET').toUpperCase();
      const shape = buildInputSchemaShape(input, method);

      const bountyMeta = resource.metadata?.bounty && typeof resource.metadata.bounty === 'object'
        ? {
            slug: resource.metadata.bounty.slug ?? null,
            title: resource.metadata.bounty.title ?? null,
            promptSlug: resource.metadata.bounty.promptSlug ?? null,
          }
        : null;
      const promptSlug = bountyMeta?.promptSlug
        || (bountyMeta?.slug ? `agent.community.bounty.${bountyMeta.slug}.${toolMeta.name}` : undefined);
      const title = bountyMeta?.title ? `🏆 ${bountyMeta.title}` : toolMeta.title;
      const decoratedDescription = bountyMeta?.slug
        ? `${toolMeta.description} — Dexter Build-Off winner (${bountyMeta.slug})`
        : toolMeta.description;

      const tags = new Set([...(toolMeta.tags || [])]);
      if (bountyMeta?.slug) tags.add('bounty');
      if (accept?.network) {
        tags.add(String(accept.network).toLowerCase());
      }

      server.registerTool(toolMeta.name, {
        title,
        description: decoratedDescription,
        _meta: {
          category: toolMeta.category,
          access: toolMeta.access,
          tags: Array.from(tags),
          promptSlug,
          bountySlug: bountyMeta?.slug || null,
          bountyTitle: bountyMeta?.title || null,
          bountyPromptSlug: promptSlug || null,
          bounty: bountyMeta,
        },
        inputSchema: shape,
      }, async (args = {}) => {
        const headers = { Accept: 'application/json' };
        let finalUrl = resourceUrl;
        let body;

        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
          finalUrl = applyQueryParams(resourceUrl, args);
        } else {
          headers['Content-Type'] = 'application/json';
          body = buildBody(args);
        }

        if (finalUrl.startsWith('http://api.dexter.cash')) {
          finalUrl = finalUrl.replace('http://', 'https://');
        }

        console.log(`[x402-debug] Tool: ${toolMeta.name}, Method: ${method}, URL: ${finalUrl}`);

        const authToken = resolveAuthToken(args?._extra || {});
        const authHeaders = { ...headers };
        if (authToken) {
            authHeaders['Authorization'] = `Bearer ${authToken}`;
        }

        const { response, json, text } = await fetchWithX402Json(
          finalUrl,
          {
            method,
            headers: authHeaders,
            body,
          },
          {
            metadata: {
              tool: toolMeta.name,
              resourceUrl,
              acceptNetwork: accept?.network || null,
              acceptDescription: accept?.description || null,
            },
            authHeaders: authHeaders,
          },
        );

        if (!response.ok) {
          const message = json?.error || json?.message || text || `request_failed:${response.status}`;
          throw new Error(String(message));
        }

        if (json !== null && json !== undefined) {
          return {
            structuredContent: json,
            content: [{ type: 'json', json }],
          };
        }

        return {
          structuredContent: { text: text ?? '' },
          content: [{ type: 'text', text: text ?? '' }],
        };
      });
    });
  }
}
