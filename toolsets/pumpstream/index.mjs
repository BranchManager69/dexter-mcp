import { z } from 'zod';

const LIVE_ENDPOINT = process.env.PUMPSTREAM_LIVE_URL || 'https://pump.dexter.cash/api/live';
const MAX_LIMIT = Number.parseInt(process.env.PUMPSTREAM_MAX_ITEMS || '50', 10) || 50;

function parseLimit(args = {}) {
  if (typeof args === 'number') return Math.max(1, Math.min(MAX_LIMIT, Math.floor(args)));
  if (typeof args === 'string') {
    const parsed = Number.parseInt(args, 10);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(MAX_LIMIT, parsed)) : 3;
  }
  if (typeof args === 'object' && args !== null) {
    if (typeof args.limit === 'number') {
      return Math.max(1, Math.min(MAX_LIMIT, Math.floor(args.limit)));
    }
    if (typeof args.limit === 'string') {
      const parsed = Number.parseInt(args.limit, 10);
      if (Number.isFinite(parsed)) return Math.max(1, Math.min(MAX_LIMIT, parsed));
    }
  }
  return 3;
}

function parseSort(value) {
  if (!value || typeof value !== 'string') return undefined;
  const normalised = value.toLowerCase();
  if (normalised === 'viewers') return 'viewers';
  if (normalised === 'marketcap' || normalised === 'market_cap') return 'marketCap';
  return undefined;
}

function parseStatus(value) {
  if (!value || typeof value !== 'string') return undefined;
  const normalised = value.toLowerCase();
  if (normalised === 'live' || normalised === 'disconnecting') return normalised;
  if (normalised === 'all') return 'all';
  return undefined;
}

function parseNumber(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeUrlWithSort(endpoint, sort) {
  if (!sort) return endpoint;
  try {
    const url = new URL(endpoint);
    url.searchParams.set('sort', sort);
    return url.toString();
  } catch {
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}sort=${encodeURIComponent(sort)}`;
  }
}

function filterStreams(streams, { status, minMarketCapUsd, minViewers }) {
  return streams.filter((stream) => {
    if (status && status !== 'all') {
      if (stream.status !== status) return false;
    }
    if (Number.isFinite(minMarketCapUsd)) {
      const usd = stream?.metrics?.marketCap?.usd ?? stream?.metrics?.marketCap?.current ?? null;
      if (!(typeof usd === 'number' && usd >= minMarketCapUsd)) return false;
    }
    if (Number.isFinite(minViewers)) {
      const viewers = stream?.metrics?.viewers?.current ?? null;
      if (!(typeof viewers === 'number' && viewers >= minViewers)) return false;
    }
    return true;
  });
}

function summariseStream(stream) {
  const marketCap = stream?.metrics?.marketCap || {};
  return {
    mintId: stream.mintId,
    name: stream.name,
    symbol: stream.symbol ?? null,
    status: stream.status,
    currentViewers: stream?.metrics?.viewers?.current ?? null,
    marketCapUsd: marketCap.usd ?? marketCap.current ?? null,
    marketCapSol: marketCap.sol ?? null,
    latestAt: stream.latestAt ?? null,
    lastSnapshotAgeSeconds: stream?.metrics?.lastSnapshotAgeSeconds ?? null,
    thumbnail: stream.thumbnail ?? null,
  };
}

function buildContent(livePayload, options) {
  const generatedAt = livePayload?.generatedAt || null;
  const windowMinutes = livePayload?.windowMinutes || null;
  const streams = Array.isArray(livePayload?.streams) ? livePayload.streams : [];
  const appliedFilters = {
    status: options?.status ?? null,
    minMarketCapUsd: options?.minMarketCapUsd ?? null,
    minViewers: options?.minViewers ?? null,
  };
  const filtered = filterStreams(streams, {
    status: appliedFilters.status ?? undefined,
    minMarketCapUsd: options?.minMarketCapUsd,
    minViewers: options?.minViewers,
  });
  const limit = options?.limit ?? filtered.length;
  const capped = filtered.slice(0, limit);

  const summary = {
    generatedAt,
    windowMinutes,
    totalAvailable: streams.length,
    totalAfterFilter: filtered.length,
    totalReturned: capped.length,
    appliedSort: livePayload?.sort ?? null,
    appliedFilters,
    totals: livePayload?.totals
      ? {
          totalStreams: livePayload.totals.totalStreams ?? null,
          liveStreams: livePayload.totals.liveStreams ?? null,
          disconnectingStreams: livePayload.totals.disconnectingStreams ?? null,
          totalLiveViewers: livePayload.totals.totalLiveViewers ?? null,
          totalLiveMarketCapUsd: livePayload.totals.totalLiveMarketCap ?? null,
        }
      : null,
    streams: capped.map(summariseStream),
  };

  if (options?.includeSpotlight) {
    const spotlight = Array.isArray(livePayload?.spotlight) ? livePayload.spotlight : [];
    summary.spotlight = spotlight.map(summariseStream);
  }

  return {
    structuredContent: summary,
    content: [{ type: 'text', text: JSON.stringify(summary) }],
  };
}

async function fetchLiveData(options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const requestUrl = normalizeUrlWithSort(LIVE_ENDPOINT, options?.sort);
    const response = await fetch(requestUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'pumpstream_http_error', status: response.status, body: text.slice(0, 200) }),
          },
        ],
        isError: true,
      };
    }
    const json = await response.json().catch(() => null);
    if (!json) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'pumpstream_invalid_json' }) }],
        isError: true,
      };
    }
    return buildContent(json, options);
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pumpstream_fetch_failed', message: error?.message || String(error) }) }],
      isError: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function registerPumpstreamToolset(server) {
  server.registerTool(
    'pumpstream_live_summary',
    {
      title: 'Pumpstream Live Summary',
      description: 'Return a quick snapshot of live pump streams from pump.dexter.cash.',
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .describe(`Maximum number of streams to include (1-${MAX_LIMIT})`)
          .optional(),
        sort: z
          .enum(['marketCap', 'viewers'])
          .describe('Sort order applied by the API (marketCap or viewers).')
          .optional(),
        status: z
          .enum(['live', 'disconnecting', 'all'])
          .describe('Filter streams by connection status.')
          .optional(),
        minMarketCapUsd: z
          .number()
          .nonnegative()
          .describe('Minimum USD market cap required for streams to appear.')
          .optional(),
        minViewers: z
          .number()
          .nonnegative()
          .describe('Minimum live viewer count required for streams to appear.')
          .optional(),
        includeSpotlight: z
          .boolean()
          .describe('Include the spotlight list in the response payload.')
          .optional(),
      },
    },
    async (args = {}) => {
      const limit = parseLimit(args);
      const sort = parseSort(args.sort);
      const status = parseStatus(args.status);
      const minMarketCapUsd = parseNumber(args.minMarketCapUsd);
      const minViewers = parseNumber(args.minViewers);
      const includeSpotlight = Boolean(args.includeSpotlight);
      return fetchLiveData({ limit, sort, status, minMarketCapUsd, minViewers, includeSpotlight });
    }
  );
}
