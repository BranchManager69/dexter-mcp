import { listX402Resources } from '../../registry/x402/index.mjs';
import { buildInputSchemaShape } from '../../lib/x402/zod.mjs';
import { normalizeX402Fields, trimUrl } from '../../lib/x402/utils.mjs';
import { fetchWithX402Json } from '../../clients/x402Client.mjs';

function formatAmount(accept) {
  const amountRaw = accept?.maxAmountRequired ?? accept?.max_amount_required;
  if (amountRaw === undefined || amountRaw === null) return null;
  const decimalsRaw = accept?.extra?.decimals ?? accept?.decimals ?? 6;
  const decimals = Number.isFinite(Number(decimalsRaw)) ? Number(decimalsRaw) : 6;
  const denom = 10 ** decimals;
  const parsed = Number(amountRaw);
  if (!Number.isFinite(parsed) || !Number.isFinite(denom) || denom === 0) return null;
  const normalized = parsed / denom;
  const symbol = accept?.extra?.symbol || accept?.assetSymbol || 'USDC';
  return `${normalized} ${symbol}`;
}

function buildDescription(resourceUrl, accept) {
  const base = accept?.description || `Invoke ${resourceUrl}`;
  const amount = formatAmount(accept);
  if (!amount) return base;
  return `${base} (cost: ${amount})`;
}

function buildToolName(resource, accept, index, taken) {
  const baseUrl = accept?.resource || resource.resourceUrl;
  let slug = trimUrl(baseUrl);
  slug = slug.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  if (!slug) slug = 'x402_resource';
  const network = (accept?.network || '').toString().replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
  const parts = ['x402', slug];
  if (network) parts.push(network);
  let candidate = parts.join('_');
  if (taken.has(candidate)) {
    let suffix = index + 1;
    while (taken.has(`${candidate}_${suffix}`)) {
      suffix += 1;
    }
    candidate = `${candidate}_${suffix}`;
  }
  taken.add(candidate);
  return candidate;
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
  let hasValue = false;
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    body[key] = value;
    hasValue = true;
  }
  if (!hasValue) return null;
  return JSON.stringify(body);
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

    accepts.forEach((accept, index) => {
      const outputSchema = accept?.outputSchema || {};
      const input = outputSchema?.input || {};
      const method = String(input?.method || 'GET').toUpperCase();
      const shape = buildInputSchemaShape(input, method);
      const toolName = buildToolName(resource, accept, index, takenNames);
      const resourceUrl = accept?.resource || resource.resourceUrl;
      const description = buildDescription(resourceUrl, accept);

      server.registerTool(toolName, {
        title: accept?.title || description,
        description,
        _meta: {
          category: 'x402.dynamic',
          access: 'guest',
          tags: ['x402', 'dynamic'],
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

        const { response, json, text } = await fetchWithX402Json(
          finalUrl,
          {
            method,
            headers,
            body,
          },
          {
            metadata: {
              tool: 'x402_dynamic',
              resourceUrl,
              acceptNetwork: accept?.network || null,
              acceptDescription: accept?.description || null,
            },
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
