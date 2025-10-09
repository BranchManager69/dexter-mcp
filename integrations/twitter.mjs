import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SESSION_PATH = '/home/websites/degenduel/keys/twitter-session.json';
const PROFILE_LOOKUP_LIMIT = Number(process.env.TWITTER_PROFILE_LOOKUP_LIMIT || 10);
const MAX_TOTAL_RESULTS = 200;

function resolveSessionPath(overridePath) {
  const candidate = overridePath
    ? path.resolve(overridePath)
    : (process.env.TWITTER_SESSION_PATH || DEFAULT_SESSION_PATH);
  if (!fs.existsSync(candidate)) {
    throw new Error('twitter_session_missing');
  }
  return candidate;
}

function buildSearchUrl(query, { language } = {}) {
  const params = new URLSearchParams({
    q: query,
    src: 'typed_query',
    f: 'live',
  });
  if (language) {
    params.set('lang', language);
  }
  return `https://x.com/search?${params.toString()}`;
}

function parseCount(text) {
  if (!text) return null;
  const cleaned = String(text).trim().replace(/,/g, '');
  if (!cleaned) return null;
  const suffix = cleaned.slice(-1).toLowerCase();
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  if (suffix === 'k') return Math.round(num * 1_000);
  if (suffix === 'm') return Math.round(num * 1_000_000);
  if (suffix === 'b') return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

function uniqueTweets(existing, incoming) {
  const map = new Map();
  for (const tweet of existing) {
    map.set(tweet.id, tweet);
  }
  for (const tweet of incoming) {
    if (!map.has(tweet.id)) {
      map.set(tweet.id, tweet);
    }
  }
  return Array.from(map.values());
}

async function collectTweets(page, { includeReplies }) {
  return await page.evaluate(({ includeReplies }) => {
    function parseCount(value) {
      if (!value) return null;
      const text = String(value).trim().replace(/,/g, '');
      if (!text) return null;
      const suffix = text.slice(-1).toLowerCase();
      const number = parseFloat(text);
      if (Number.isNaN(number)) return null;
      if (suffix === 'k') return Math.round(number * 1_000);
      if (suffix === 'm') return Math.round(number * 1_000_000);
      if (suffix === 'b') return Math.round(number * 1_000_000_000);
      return Math.round(number);
    }

    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    return articles
      .map((article) => {
        const tweetLink = article.querySelector('a[href*="/status/"][role="link"]');
        const url = tweetLink ? tweetLink.href : null;
        const idMatch = url ? url.match(/status\/(\d+)/) : null;
        const tweetId = idMatch ? idMatch[1] : null;

        const authorElement = article.querySelector('[data-testid="User-Name"]');
        let handle = null;
        let name = null;
        let isVerified = false;
        let profileUrl = null;
        const authorLink = article.querySelector('a[href*="/status/"]')?.closest('div')?.querySelector('a[href^="https://x.com/"]');
        if (authorElement) {
          const spans = Array.from(authorElement.querySelectorAll('span'));
          for (const span of spans) {
            const text = span.innerText || '';
            if (text.startsWith('@')) handle = text.slice(1);
            else if (text && !name) name = text;
          }
          isVerified = Boolean(authorElement.querySelector('svg[aria-label*="Verified"]'));
        }
        if (handle) {
          profileUrl = `https://x.com/${handle}`;
        } else if (authorLink?.href) {
          profileUrl = authorLink.href;
        }
        const text = article.querySelector('[data-testid="tweetText"]')?.innerText || null;
        const timestamp = article.querySelector('time')?.getAttribute('datetime') || null;
        const likeText = article.querySelector('[data-testid="like"] span')?.innerText || null;
        const retweetText = article.querySelector('[data-testid="retweet"] span')?.innerText || null;
        const replyText = article.querySelector('[data-testid="reply"] span')?.innerText || null;
        const viewText = article.querySelector('[data-testid="app-text-transition-container"] span')?.innerText || null;

        const mediaPhotos = Array.from(article.querySelectorAll('[data-testid="tweetPhoto"] img')).map((img) => img.src);
        const videoSources = Array.from(article.querySelectorAll('video source')).map((source) => source.src).filter(Boolean);
        const avatarSrc = article.querySelector('img[src*="profile_images"]')?.src
          || article.querySelector('div[data-testid="Tweet-User-Avatar"] img')?.src
          || null;

        const isReply = article.innerText.includes('Replying to ');

        return {
          id: tweetId,
          url,
          author: {
            handle,
            display_name: name,
            is_verified: isVerified,
            profile_url: profileUrl,
            avatar_url: avatarSrc,
          },
          text,
          timestamp,
          stats: {
            likes: parseCount(likeText),
            retweets: parseCount(retweetText),
            replies: parseCount(replyText),
            views: parseCount(viewText),
          },
          media: {
            photos: mediaPhotos,
            videos: videoSources,
            has_media: Boolean(mediaPhotos.length || videoSources.length),
          },
          is_reply: isReply,
        };
      })
      .filter((tweet) => {
        if (!tweet.id) return false;
        if (!tweet.text) return false;
        if (!includeReplies && tweet.is_reply) return false;
        return true;
      });
  }, { includeReplies });
}

async function fetchAuthorProfiles(context, handles) {
  const uniqueHandles = Array.from(new Set(handles.filter(Boolean)));
  if (!uniqueHandles.length) return {};
  const limit = PROFILE_LOOKUP_LIMIT > 0 ? PROFILE_LOOKUP_LIMIT : 10;
  const selectedHandles = uniqueHandles.slice(0, limit);
  const result = {};

  for (const handle of selectedHandles) {
    const page = await context.newPage();
    try {
      await page.goto(`https://x.com/${handle}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.waitForSelector('main [data-testid="UserName"]', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const profile = await page.evaluate(() => {
        function parseCount(value) {
          if (!value) return null;
          const text = String(value).trim().replace(/,/g, '');
          if (!text) return null;
          const suffix = text.slice(-1).toLowerCase();
          const number = parseFloat(text);
          if (Number.isNaN(number)) return null;
          if (suffix === 'k') return Math.round(number * 1_000);
          if (suffix === 'm') return Math.round(number * 1_000_000);
          if (suffix === 'b') return Math.round(number * 1_000_000_000);
          return Math.round(number);
        }

        const parseRelation = (kind) => {
          const anchors = Array.from(document.querySelectorAll(`a[href$="/${kind}"]`));
          for (const anchor of anchors) {
            const aria = anchor.getAttribute('aria-label');
            if (aria) {
              const match = aria.match(/([\d,.]+(?:\s*[KMB]))/i);
              if (match) return parseCount(match[1]);
            }
            const titleSpan = anchor.querySelector('span[title]');
            if (titleSpan?.getAttribute('title')) {
              return parseCount(titleSpan.getAttribute('title'));
            }
            const span = anchor.querySelector('span span');
            if (span?.innerText) {
              const val = parseCount(span.innerText);
              if (val != null) return val;
            }
          }
          const scopeText = (document.querySelector('main') || document.body)?.innerText || '';
          const regexLeading = new RegExp(`([0-9][\\d,.]*\\s*[KMB]?)\\s+${kind}\\b`, 'i');
          const regexTrailing = new RegExp(`${kind}\\b\\s+([0-9][\\d,.]*\\s*[KMB]?)`, 'i');
          const matchLeading = scopeText.match(regexLeading);
          if (matchLeading) {
            const val = parseCount(matchLeading[1]);
            if (val != null) return val;
          }
          const matchTrailing = scopeText.match(regexTrailing);
          if (matchTrailing) {
            const val = parseCount(matchTrailing[1]);
            if (val != null) return val;
          }
          return null;
        };

        const nameElement = document.querySelector('[data-testid="UserName"] span');
        const description = document.querySelector('[data-testid="UserDescription"]')?.innerText || null;
        const location = document.querySelector('[data-testid="UserLocation"]')?.innerText || null;
        const joinDate = document.querySelector('[data-testid="UserJoinDate"]')?.innerText || null;
        const website = document.querySelector('[data-testid="UserUrl"] a')?.href || null;
        const profileImg = document.querySelector('img[alt*="profile photo"]')?.src
          || document.querySelector('[data-testid*="UserAvatar-Container"] img')?.src
          || null;
        const bannerImg = document.querySelector('a[href$="/header_photo"] img')?.src
          || document.querySelector('div[role="presentation"] img[src*="banner"]')?.src
          || null;
        const isVerified = Boolean(document.querySelector('[data-testid="UserName"] svg[aria-label*="Verified"]'));

        return {
          display_name: nameElement?.innerText || null,
          followers: parseRelation('followers'),
          following: parseRelation('following'),
          bio: description,
          location,
          join_date: joinDate,
          website,
          profile_image_url: profileImg,
          banner_image_url: bannerImg,
          is_verified: isVerified,
        };
      });

      result[handle.toLowerCase()] = profile || {};
    } catch {
      result[handle.toLowerCase()] = {};
    } finally {
      await page.close().catch(() => {});
    }
  }

  return result;
}

async function executeSearch(page, {
  query,
  language,
  includeReplies,
  perQueryLimit,
  mediaOnly,
  verifiedOnly,
  maxDurationMs = 20000,
}) {
  const searchUrl = buildSearchUrl(query, { language });
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  let collected = [];
  const start = Date.now();

  while (collected.length < perQueryLimit && Date.now() - start < maxDurationMs) {
    const fresh = await collectTweets(page, { includeReplies });
    collected = uniqueTweets(collected, fresh);
    if (collected.length >= perQueryLimit) break;
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1200);
  }

  const trimmed = collected.slice(0, perQueryLimit);

  return trimmed.filter((tweet) => {
    if (mediaOnly && !tweet.media?.has_media) return false;
    if (verifiedOnly && !tweet.author?.is_verified) return false;
    return true;
  });
}

export async function searchTwitter({
  query,
  queries,
  ticker,
  maxResults = 25,
  includeReplies = true,
  language,
  sessionPath,
  mediaOnly = false,
  verifiedOnly = false,
} = {}) {
  const queryBucket = [];
  if (Array.isArray(queries)) {
    for (const q of queries) {
      if (typeof q === 'string' && q.trim()) queryBucket.push(q.trim());
    }
  }
  if (typeof query === 'string' && query.trim()) {
    queryBucket.push(query.trim());
  }
  if (typeof ticker === 'string' && ticker.trim()) {
    const t = ticker.trim();
    queryBucket.push(t, `$${t}`, `#${t}`);
  }

  const finalQueries = Array.from(new Set(queryBucket.filter(Boolean)));
  if (!finalQueries.length) {
    throw new Error('twitter_query_required');
  }

  const totalCap = Math.max(1, Math.min(maxResults, MAX_TOTAL_RESULTS));
  const perQueryLimit = Math.max(1, Math.ceil(totalCap / finalQueries.length));
  const storageStatePath = resolveSessionPath(sessionPath);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({ storageState: storageStatePath });
    const aggregatedMap = new Map();
    const perQueryDetails = [];

    for (const q of finalQueries) {
      const page = await context.newPage();
      try {
        const tweets = await executeSearch(page, {
          query: q,
          language,
          includeReplies,
          perQueryLimit,
          mediaOnly,
          verifiedOnly,
        });

        perQueryDetails.push({
          query: q,
          fetched: tweets.length,
          limit: perQueryLimit,
        });

        for (const tweet of tweets) {
          if (!tweet.id) continue;
          const existing = aggregatedMap.get(tweet.id);
          if (existing) {
            if (!existing.source_queries.includes(q)) {
              existing.source_queries.push(q);
            }
          } else {
            aggregatedMap.set(tweet.id, {
              ...tweet,
              source_queries: [q],
            });
          }
        }
      } finally {
        await page.close().catch(() => {});
      }
    }

    const aggregatedTweets = Array.from(aggregatedMap.values()).slice(0, totalCap);
    const handlesForProfiles = aggregatedTweets.map((tweet) => tweet.author?.handle).filter(Boolean);
    const enrichedProfiles = await fetchAuthorProfiles(context, handlesForProfiles);

    const tweets = aggregatedTweets.map((tweet) => {
      const handleKey = tweet.author?.handle ? tweet.author.handle.toLowerCase() : null;
      const profile = handleKey ? enrichedProfiles[handleKey] : null;
      const author = {
        handle: tweet.author?.handle || null,
        display_name: profile?.display_name || tweet.author?.display_name || null,
        profile_url: tweet.author?.profile_url || (tweet.author?.handle ? `https://x.com/${tweet.author.handle}` : null),
        avatar_url: profile?.profile_image_url || tweet.author?.avatar_url || null,
        banner_image_url: profile?.banner_image_url ?? null,
        is_verified: profile?.is_verified ?? tweet.author?.is_verified ?? null,
        followers: profile?.followers ?? null,
        following: profile?.following ?? null,
        bio: profile?.bio ?? null,
        location: profile?.location ?? null,
        join_date: profile?.join_date ?? null,
        website: profile?.website ?? null,
      };

      return {
        id: tweet.id,
        url: tweet.url,
        author,
        text: tweet.text,
        timestamp: tweet.timestamp,
        stats: tweet.stats,
        media: tweet.media,
        is_reply: tweet.is_reply,
        source_queries: tweet.source_queries,
      };
    });

    await context.close();

    return {
      query: finalQueries.length === 1 ? finalQueries[0] : null,
      queries: finalQueries,
      ticker: ticker || null,
      language: language || null,
      include_replies: includeReplies,
      media_only: mediaOnly,
      verified_only: verifiedOnly,
      fetched: tweets.length,
      tweets,
      searches: perQueryDetails,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
