import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/twitter-search.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TwitterAuthor = {
  handle?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
};

type TwitterStats = {
  likes?: number | null;
  retweets?: number | null;
  views?: number | null;
};

type TwitterMedia = {
  photos?: string[];
};

type Tweet = {
  id?: string;
  url?: string | null;
  timestamp?: string | null;
  text?: string | null;
  author?: TwitterAuthor;
  stats?: TwitterStats;
  media?: TwitterMedia;
};

type TwitterPayload = {
  query?: string | null;
  queries?: string[];
  ticker?: string | null;
  tweets?: Tweet[];
  fetched?: number;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatNumber(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return '0';
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

function formatRelativeTime(timestamp?: string | null): string {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  } catch {
    return '';
  }
}

function ensureTweetUrl(tweet: Tweet): string | null {
  if (tweet.url) return tweet.url;
  if (tweet.author?.handle && tweet.id) {
    return `https://x.com/${tweet.author.handle}/status/${tweet.id}`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function TwitterSearch() {
  const toolOutput = useOpenAIGlobal('toolOutput') as TwitterPayload | null;
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!toolOutput) {
    return (
      <div className="twitter-container">
        <div className="twitter-loading">
          <div className="twitter-loading__spinner" />
          <span>Loading tweets...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="twitter-container">
        <div className="twitter-error">{toolOutput.error}</div>
      </div>
    );
  }

  const tweets = toolOutput.tweets || [];
  const primaryQuery = toolOutput.ticker ? `$${toolOutput.ticker}` : toolOutput.query || toolOutput.queries?.[0];
  const visibleTweets = showAll ? tweets : tweets.slice(0, 4);

  if (tweets.length === 0) {
    return (
      <div className="twitter-container">
        <div className="twitter-empty">No tweets found for this topic.</div>
      </div>
    );
  }

  return (
    <div className="twitter-container">
      {/* Header */}
      <div className="twitter-header">
        <div className="twitter-header-left">
          <span className="twitter-icon">𝕏</span>
          <span className="twitter-title">Social Pulse</span>
        </div>
        {primaryQuery && <span className="twitter-query">{primaryQuery}</span>}
      </div>

      {/* Tweets Grid */}
      <div className="twitter-grid">
        {visibleTweets.map((tweet, idx) => {
          const authorName = tweet.author?.display_name || tweet.author?.handle || 'Unknown';
          const handle = tweet.author?.handle ? `@${tweet.author.handle}` : null;
          const avatar = tweet.author?.avatar_url;
          const isVerified = tweet.author?.is_verified;
          const tweetUrl = ensureTweetUrl(tweet);
          const relativeTime = formatRelativeTime(tweet.timestamp);
          const stats = tweet.stats || {};
          const photos = tweet.media?.photos || [];
          const uniqueKey = tweet.id || `tweet-${idx}`;
          const isExpanded = expandedId === uniqueKey;

          return (
            <div
              key={uniqueKey}
              className={`twitter-card ${isExpanded ? 'twitter-card--expanded' : ''}`}
              onClick={() => setExpandedId(isExpanded ? null : uniqueKey)}
            >
              {/* Author Header */}
              <div className="twitter-card__header">
                <div className="twitter-card__avatar">
                  {avatar ? (
                    <img src={avatar} alt={authorName} />
                  ) : (
                    <span>{authorName.slice(0, 2)}</span>
                  )}
                </div>
                <div className="twitter-card__author">
                  <div className="twitter-card__name">
                    <span>{authorName}</span>
                    {isVerified && <span className="twitter-card__verified">✓</span>}
                  </div>
                  <div className="twitter-card__meta">
                    {handle && <span>{handle}</span>}
                    <span>·</span>
                    <span>{relativeTime}</span>
                  </div>
                </div>
              </div>

              {/* Tweet Text */}
              <p className={`twitter-card__text ${isExpanded ? '' : 'twitter-card__text--clamped'}`}>
                {tweet.text}
              </p>

              {/* Media */}
              {photos.length > 0 && (
                <div className="twitter-card__media">
                  <img src={photos[0]} alt="Tweet media" />
                  {photos.length > 1 && (
                    <span className="twitter-card__media-count">+{photos.length - 1}</span>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="twitter-card__stats">
                <div className="twitter-card__stat">
                  <span className="twitter-card__stat-icon">❤️</span>
                  <span>{formatNumber(stats.likes)}</span>
                </div>
                <div className="twitter-card__stat">
                  <span className="twitter-card__stat-icon">🔁</span>
                  <span>{formatNumber(stats.retweets)}</span>
                </div>
                <div className="twitter-card__stat">
                  <span className="twitter-card__stat-icon">👁</span>
                  <span>{formatNumber(stats.views)}</span>
                </div>
              </div>

              {/* Expanded Actions */}
              {isExpanded && tweetUrl && (
                <div className="twitter-card__actions">
                  <a
                    href={tweetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="twitter-card__link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open on X ↗
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show More */}
      {tweets.length > 4 && (
        <button className="twitter-show-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Collapse' : `Show ${tweets.length - 4} more tweets`}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('twitter-search-root');
if (root) {
  createRoot(root).render(<TwitterSearch />);
}

export default TwitterSearch;
