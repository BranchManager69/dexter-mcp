import { z } from 'zod';

import { fetchWithX402Json } from '../../clients/x402Client.mjs';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || 'http://localhost:3030';

function buildApiUrl(path) {
  const base = (process.env.API_BASE_URL || process.env.DEXTER_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
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

function resolveSupabaseToken(extra) {
  const headers = headersFromExtra(extra);
  const candidates = [
    headers?.authorization || headers?.Authorization,
    headers?.['x-authorization'] || headers?.['X-Authorization'],
    headers?.['x-user-token'] || headers?.['X-User-Token'],
  ];
  for (const token of candidates) {
    if (typeof token === 'string' && token.trim()) {
      if (token.startsWith('Bearer ')) {
        return token.slice(7).trim();
      }
      if (!token.includes(' ')) {
        return token.trim();
      }
    }
  }
  const envToken = process.env.MCP_SUPABASE_BEARER;
  return envToken ? String(envToken) : null;
}

async function callTwitterAnalyze(body, extra) {
  const token = resolveSupabaseToken(extra);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const url = buildApiUrl('/api/tools/twitter/analyze');
  const { response, json, text } = await fetchWithX402Json(
    url,
    { method: 'POST', headers, body: JSON.stringify(body) },
    { metadata: { toolset: 'twitter' }, authHeaders: headers },
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
    const message = payload?.error || payload?.message || `twitter_analyze_failed:${response.status}`;
    throw new Error(message);
  }
  return json;
}

const INPUT_SHAPE = {
  topic: z.string().min(1).describe('Main topic or question to investigate.').optional(),
  keywords: z.array(z.string().min(1)).max(10).describe('Specific keywords or hashtags to include.').optional(),
  accounts: z.array(z.string().min(1)).max(10).describe('Twitter handles to focus on (with or without @).').optional(),
  conversationId: z.string().min(5).describe('Conversation/tweet ID to analyze replies for.').optional(),
  lookbackHours: z.number().int().min(1).max(168).describe('Time window in hours (default 168, max 168).').optional(),
  maxTweets: z.number().int().min(10).max(400).describe('Total tweets to analyze (default 100, max 400).').optional(),
  language: z.string().min(2).max(5).describe('ISO language filter (optional).').optional(),
  minEngagement: z.number().int().min(0).describe('Minimum likes+reposts+replies required.').optional(),
  includeReplies: z.boolean().describe('Include replies in analysis (default true).').optional(),
  includeQuotes: z.boolean().describe('Include quote tweets (default true).').optional(),
  summarize: z.boolean().describe('Return a natural-language summary (default true).').optional(),
  highlightsPerBucket: z.number().int().min(1).max(10).describe('Representative tweets per highlight bucket (default 3).').optional(),
};

const INPUT_SCHEMA = z.object(INPUT_SHAPE).refine((value) => {
  return Boolean((value.topic && value.topic.trim()) || (value.keywords?.length) || (value.accounts?.length) || value.conversationId);
}, 'Provide at least one of topic, keywords, accounts, or conversationId');

const INPUT_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    topic: { type: 'string', description: 'Main topic or question to investigate.' },
    keywords: { type: 'array', items: { type: 'string' }, description: 'Keywords/hashtags to include.' },
    accounts: { type: 'array', items: { type: 'string' }, description: 'Handles to focus on.' },
    conversationId: { type: 'string', description: 'Tweet/conversation ID for thread analysis.' },
    lookbackHours: { type: 'integer', minimum: 1, maximum: 168 },
    maxTweets: { type: 'integer', minimum: 10, maximum: 400 },
    language: { type: 'string', description: 'ISO language filter.' },
    minEngagement: { type: 'integer', minimum: 0 },
    includeReplies: { type: 'boolean' },
    includeQuotes: { type: 'boolean' },
    summarize: { type: 'boolean' },
    highlightsPerBucket: { type: 'integer', minimum: 1, maximum: 10 },
  },
  anyOf: [
    { required: ['topic'] },
    { required: ['keywords'] },
    { required: ['accounts'] },
    { required: ['conversationId'] },
  ],
};

export function registerTwitterToolset(server) {
  server.registerTool(
    'twitter_search',
    {
      title: 'Twitter Analysis',
      description: 'Analyze any topic, account, or conversation on X/Twitter and return engagement metrics plus highlights.',
      _meta: {
        category: 'social.search',
        access: 'guest',
        tags: ['twitter', 'search', 'social'],
      },
      inputSchema: INPUT_SHAPE,
      jsonSchema: INPUT_JSON_SCHEMA,
      outputSchema: {
        metadata: z.record(z.any()),
        summary: z.string().optional(),
        metrics: z.object({
          tweetCount: z.number(),
          uniqueAuthors: z.number(),
          engagementTotals: z.object({ likes: z.number(), reposts: z.number(), replies: z.number(), quotes: z.number() }),
          engagementPerTweet: z.number(),
        }),
        topAuthors: z.array(z.object({
          handle: z.string(),
          displayName: z.string().nullable(),
          followers: z.number().nullable(),
          tweetCount: z.number(),
          engagement: z.number(),
        })),
        topHashtags: z.array(z.object({ hashtag: z.string(), count: z.number() })),
        highlights: z.object({
          topTweets: z.array(z.object({
            id: z.string(),
            url: z.string(),
            timestamp: z.string().nullable(),
            text: z.string(),
            engagement: z.object({ likes: z.number(), reposts: z.number(), replies: z.number(), quotes: z.number() }),
            author: z.object({
              handle: z.string(),
              displayName: z.string().nullable(),
              followers: z.number().nullable(),
              profileImageUrl: z.string().nullable(),
              verified: z.boolean().nullable(),
            }),
            sourceReason: z.string().optional(),
            mediaUrls: z.array(z.string()).optional(),
            relevanceScore: z.number().optional(),
          })),
          conversationHighlights: z.array(z.any()).optional(),
          accountHighlights: z.array(z.any()).optional(),
          rawTweets: z.array(z.any()).optional(),
        }),
        rawTweets: z.array(z.any()).optional(),
        mediaInsights: z.array(z.object({
          tweetId: z.string(),
          handle: z.string(),
          summary: z.string(),
          mediaUrls: z.array(z.string()),
          tweetUrl: z.string().optional(),
          timestamp: z.string().nullable().optional(),
        })).optional(),
        errors: z.array(z.string()).optional(),
      },
    },
    async (args = {}, extra) => {
      const startedAt = Date.now();
      let parsed;
      try {
        parsed = INPUT_SCHEMA.parse(args);
      } catch (error) {
        console.warn('[twitter-toolset]', 'analyze:invalid-args', { error: error?.message || String(error) });
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'invalid_arguments', details: error?.message }) }],
          isError: true,
        };
      }
      try {
        const payload = await callTwitterAnalyze(parsed, extra);
        const result = payload?.result ?? payload;
        const durationMs = Date.now() - startedAt;
        console.log('[twitter-toolset]', 'analyze:success', { durationMs, tweets: result?.metrics?.tweetCount ?? 0 });
        const preview = typeof result?.summary === 'string' && result.summary.trim().length
          ? result.summary
          : `Analyzed ${result?.metrics?.tweetCount ?? 0} tweets.`;
        return {
          structuredContent: result,
          content: [
            { type: 'text', text: preview },
          ],
        };
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        console.error('[twitter-toolset]', 'analyze:error', { durationMs, error: error?.message || String(error) });
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error?.message || 'twitter_analyze_failed' }) }],
          isError: true,
        };
      }
    },
  );
}

export default { registerTwitterToolset };
