import { normalizeX402Fields, ensureArray, trimUrl } from '../../lib/x402/utils.mjs';

const DEFAULT_BASE = 'http://localhost:3030';
const CACHE_TTL_MS = Number(process.env.X402_CATALOG_TTL_MS || 60_000);

let cached = { at: 0, resources: [] };

function getApiBaseUrl() {
  const candidates = [
    process.env.API_BASE_URL,
    process.env.DEXTER_API_BASE_URL,
    process.env.DEXTER_API_URL,
  ];
  const base = candidates.find((value) => value && value.trim()) || DEFAULT_BASE;
  return base.replace(/\/+$/, '');
}

function joinBasePath(base, path) {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${normalizedBase}${normalizedPath.slice(4)}`;
  }
  if (normalizedBase.endsWith('/api') && normalizedPath === '/api') {
    return normalizedBase;
  }
  return `${normalizedBase}${normalizedPath}`;
}

async function fetchCatalog() {
  const base = getApiBaseUrl();
  const url = joinBasePath(base, '/api/x402/resources');
  const headers = { Accept: 'application/json' };
  const token = process.env.TOKEN_AI_MCP_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`x402_catalog_fetch_failed:${response.status}:${text}`);
  }
  const json = await response.json().catch(() => null);
  if (!json || json.ok === false) {
    throw new Error('x402_catalog_invalid_response');
  }
  const resources = Array.isArray(json.resources) ? json.resources : [];
  return resources.map(transformRecord).filter(Boolean);
}

function transformRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const rawResponse = normalizeX402Fields(record.raw_response ?? {});
  const accepts = ensureArray(rawResponse.accepts).map((entry) => ({
    ...entry,
    outputSchema: entry?.outputSchema || entry?.output_schema || null,
  }));
  return {
    id: record.id,
    resourceUrl: trimUrl(record.resource_url || ''),
    facilitatorUrl: record.facilitator_url || null,
    payTo: record.pay_to || null,
    x402Version: rawResponse.x402Version || record.x402_version || 1,
    accepts,
    raw: rawResponse,
    metadata: record.metadata || {},
    lastSeenAt: record.last_seen_at || record.updated_at || null,
  };
}

export async function listX402Resources(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cached.resources.length && now - cached.at < CACHE_TTL_MS) {
    return cached.resources;
  }
  const resources = await fetchCatalog().catch((error) => {
    console.warn('[x402] catalog fetch failed', error?.message || error);
    if (cached.resources.length) return cached.resources;
    throw error;
  });
  cached = { resources, at: now };
  return resources;
}

export function invalidateX402Cache() {
  cached = { at: 0, resources: [] };
}
