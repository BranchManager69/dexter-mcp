import { z } from 'zod';

import { searchTwitter } from '../../integrations/twitter.mjs';

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

export function registerTwitterToolset(server) {
  server.registerTool(
    'twitter_search',
    {
      title: 'Search Twitter',
      description: 'Search Twitter/X for recent tweets using the shared session (Playwright-powered).',
      _meta: {
        category: 'social.search',
        access: 'member',
        tags: ['twitter', 'search', 'social'],
      },
      inputSchema: INPUT_SCHEMA.shape,
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
      let parsed;
      try {
        parsed = INPUT_SCHEMA.parse(args);
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'invalid_arguments', details: error?.message }) }],
          isError: true,
        };
      }

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
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error?.message || 'twitter_search_failed' }) }],
          isError: true,
        };
      }
    },
  );
}

export default { registerTwitterToolset };
