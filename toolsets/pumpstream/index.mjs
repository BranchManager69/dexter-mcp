import { z } from 'zod';

const LIVE_ENDPOINT = process.env.PUMPSTREAM_LIVE_URL || 'https://pump.dexter.cash/api/live';

function parseLimit(args = {}) {
  if (typeof args === 'number') return Math.max(1, Math.min(10, Math.floor(args)));
  if (typeof args === 'string') {
    const parsed = Number.parseInt(args, 10);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(10, parsed)) : 3;
  }
  if (typeof args === 'object' && args !== null) {
    if (typeof args.limit === 'number') {
      return Math.max(1, Math.min(10, Math.floor(args.limit)));
    }
    if (typeof args.limit === 'string') {
      const parsed = Number.parseInt(args.limit, 10);
      if (Number.isFinite(parsed)) return Math.max(1, Math.min(10, parsed));
    }
  }
  return 3;
}

function buildContent(livePayload, limit) {
  const generatedAt = livePayload?.generatedAt || null;
  const windowMinutes = livePayload?.windowMinutes || null;
  const streams = Array.isArray(livePayload?.streams) ? livePayload.streams.slice(0, limit) : [];

  const summary = {
    generatedAt,
    windowMinutes,
    totalStreams: streams.length,
    streams: streams.map((stream) => ({
      mintId: stream.mintId,
      name: stream.name,
      status: stream.status,
      currentViewers: stream?.metrics?.viewers?.current ?? null,
      marketCap: stream?.metrics?.marketCap?.current ?? null,
      latestAt: stream.latestAt ?? null,
      url: stream.thumbnail ?? null,
    })),
  };

  return {
    structuredContent: summary,
    content: [{ type: 'text', text: JSON.stringify(summary) }],
  };
}

async function fetchLiveData(limit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(LIVE_ENDPOINT, {
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
    return buildContent(json, limit);
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
          .max(10)
          .describe('Maximum number of streams to include (1-10)')
          .optional(),
      },
    },
    async (args = {}) => {
      const limit = parseLimit(args);
      return fetchLiveData(limit);
    }
  );
}
