import { z } from 'zod';

import { searchTwitter } from '../../integrations/twitter.mjs';

const LOG_PREFIX = '[twitter-toolset]';

const INPUT_SCHEMA = z.object({
  query: z.string().min(1).describe('Search query (ticker, token name, hashtag, etc.).').optional(),
  queries: z.array(z.string().min(1)).min(1).describe('List of search queries to execute (combined results).').optional(),
  ticker: z.string().min(1).describe('Ticker shorthand; auto-expands into multiple query presets ($ticker, #ticker, ticker).').optional(),
  max_results: z.number().int().min(1).max(100).describe('Maximum tweets to return (1-100). Defaults to 25.').optional(),
  include_replies: z.boolean().describe('Include reply tweets in results (default true).').optional(),
  language: z.string().min(2).max(5).describe('Optional language filter (e.g. en, es).').optional(),
  media_only: z.boolean().describe('Only include tweets that contain media (photos or videos).').optional(),
  verified_only: z.boolean().describe('Only include tweets from verified authors.').optional(),
}).superRefine((value, ctx) => {
  const hasQuery = typeof value.query === 'string' && value.query.trim().length > 0;
  const hasQueries = Array.isArray(value.queries) && value.queries.length > 0;
  const hasTicker = typeof value.ticker === 'string' && value.ticker.trim().length > 0;
  if (!hasQuery && !hasQueries && !hasTicker) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one of query, queries, or ticker is required.',
      path: ['query'],
    });
  }
});

const INPUT_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      description: 'Search query (ticker, token name, hashtag, etc.).',
    },
    queries: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        minLength: 1,
      },
      description: 'List of search queries to execute; results are merged.',
    },
    ticker: {
      type: 'string',
      minLength: 1,
      description: 'Ticker shorthand; expands into multiple presets like $ticker, #ticker, ticker.',
    },
    max_results: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      description: 'Maximum tweets to return (1-100). Defaults to 25.',
    },
    include_replies: {
      type: 'boolean',
      description: 'Include reply tweets in results (default true).',
    },
    language: {
      type: 'string',
      minLength: 2,
      maxLength: 5,
      description: 'Optional language filter (e.g. en, es).',
    },
    media_only: {
      type: 'boolean',
      description: 'Only include tweets that contain media (photos or videos).',
    },
    verified_only: {
      type: 'boolean',
      description: 'Only include tweets from verified authors.',
    },
  },
  required: ['query'],
};

export function registerTwitterToolset(server) {
  server.registerTool(
    'twitter_search',
    {
      title: 'Search X/Twitter',
      description: 'Find recent tweets about a topic on X (Twitter).',
      _meta: {
        category: 'social.search',
        access: 'guest',
        tags: ['twitter', 'search', 'social'],
      },
      inputSchema: INPUT_JSON_SCHEMA,
      outputSchema: {
        query: z.string().nullable().optional(),
        queries: z.array(z.string()).optional(),
        ticker: z.string().nullable().optional(),
        language: z.string().nullable().optional(),
        include_replies: z.boolean(),
        media_only: z.boolean().optional(),
        verified_only: z.boolean().optional(),
        fetched: z.number().int(),
        searches: z.array(z.object({
          query: z.string(),
          fetched: z.number().int(),
          limit: z.number().int(),
        })).optional(),
        tweets: z.array(
          z.object({
            id: z.string(),
            url: z.string().nullable(),
            timestamp: z.string().nullable(),
            text: z.string().nullable(),
            is_reply: z.boolean().optional(),
            source_queries: z.array(z.string()).optional(),
            author: z.object({
              handle: z.string().nullable(),
              display_name: z.string().nullable(),
              profile_url: z.string().nullable().optional(),
              avatar_url: z.string().nullable().optional(),
              banner_image_url: z.string().nullable().optional(),
              bio: z.string().nullable().optional(),
              location: z.string().nullable().optional(),
              join_date: z.string().nullable().optional(),
              website: z.string().nullable().optional(),
              followers: z.number().nullable().optional(),
              following: z.number().nullable().optional(),
              is_verified: z.boolean().nullable().optional(),
            }),
            stats: z.object({
              likes: z.number().nullable().optional(),
              retweets: z.number().nullable().optional(),
              replies: z.number().nullable().optional(),
              views: z.number().nullable().optional(),
            }).optional(),
            media: z.object({
              has_media: z.boolean().optional(),
              photos: z.array(z.string()).optional(),
              videos: z.array(z.string()).optional(),
            }).optional(),
          }),
        ),
      },
    },
    async (args = {}) => {
      const startedAt = Date.now();
      let parsed;
      try {
        parsed = INPUT_SCHEMA.parse(args);
      } catch (error) {
        console.warn(LOG_PREFIX, 'search:invalid-args', { error: error?.message || String(error) });
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'invalid_arguments', details: error?.message }) }],
          isError: true,
        };
      }

      const requestSummary = {
        query: parsed.query ?? null,
        queriesCount: Array.isArray(parsed.queries) ? parsed.queries.length : 0,
        ticker: parsed.ticker ?? null,
        maxResults: parsed.max_results ?? null,
        includeReplies: parsed.include_replies !== false,
        language: parsed.language ?? null,
        mediaOnly: parsed.media_only === true,
        verifiedOnly: parsed.verified_only === true,
        sessionPath: process.env.TWITTER_SESSION_PATH || null,
      };
      console.log(LOG_PREFIX, 'search:start', requestSummary);

      try {
        const result = await searchTwitter({
          query: parsed.query,
          queries: parsed.queries,
          ticker: parsed.ticker,
          maxResults: parsed.max_results,
          includeReplies: parsed.include_replies !== false,
          language: parsed.language,
          mediaOnly: parsed.media_only === true,
          verifiedOnly: parsed.verified_only === true,
        });

        const durationMs = Date.now() - startedAt;
        console.log(LOG_PREFIX, 'search:success', {
          durationMs,
          fetched: result.fetched,
          tweets: Array.isArray(result.tweets) ? result.tweets.length : 0,
          queriesCount: Array.isArray(result.queries) ? result.queries.length : 0,
          ticker: result.ticker ?? null,
        });

        const summary = {
          query: result.query,
          queries: result.queries,
          ticker: result.ticker,
          fetched: result.fetched,
          include_replies: result.include_replies,
          language: result.language,
          media_only: result.media_only,
          verified_only: result.verified_only,
        };

        return {
          structuredContent: result,
          content: [{ type: 'text', text: JSON.stringify(summary) }],
        };
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        console.error(LOG_PREFIX, 'search:error', {
          durationMs,
          error: error?.message || 'twitter_search_failed',
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error?.message || 'twitter_search_failed' }) }],
          isError: true,
        };
      }
    },
  );
}

export default { registerTwitterToolset };
