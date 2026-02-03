import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/search.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SearchResult = {
  id?: string;
  title?: string;
  url?: string;
  snippet?: string;
  favicon?: string;
  content?: string | null;
  raw_content?: string | null;
  score?: number | null;
  published_at?: string | null;
};

type SearchImage = {
  url?: string | null;
  description?: string | null;
};

type SearchPayload = {
  results?: SearchResult[];
  answer?: string | null;
  response_time?: number | null;
  responseTime?: number | null;
  images?: SearchImage[];
  query?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractHostname(url?: string | null): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

function resolveFaviconUrl(favicon?: string | null, pageUrl?: string | null): string | null {
  if (!favicon) return null;
  const trimmed = favicon.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (pageUrl) {
    try {
      const base = new URL(pageUrl);
      if (trimmed.startsWith('/')) {
        return `${base.origin}${trimmed}`;
      }
      return new URL(trimmed, `${base.origin}/`).toString();
    } catch {}
  }
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Site Icon
// ─────────────────────────────────────────────────────────────────────────────

function SiteIcon({ hostname, favicon, size = 40 }: { hostname: string | null; favicon: string | null; size?: number }) {
  const [error, setError] = useState(false);
  const label = hostname ? hostname.slice(0, 2).toUpperCase() : 'WW';
  const showImage = favicon && !error;

  return (
    <div className="search-site-icon" style={{ width: size, height: size }}>
      {showImage ? (
        <img
          src={favicon}
          alt=""
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span style={{ fontSize: size * 0.35 }}>{label}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Result Item
// ─────────────────────────────────────────────────────────────────────────────

function SearchResultItem({ result, index }: { result: SearchResult; index: number }) {
  const title = result.title?.trim() || `Result ${index + 1}`;
  const snippet = result.snippet?.trim();
  const url = result.url?.trim();
  const hostname = extractHostname(url);
  const faviconUrl = resolveFaviconUrl(result.favicon, url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="search-result"
    >
      <div className="search-result__icon">
        <SiteIcon hostname={hostname} favicon={faviconUrl} size={40} />
      </div>
      <div className="search-result__content">
        <div className="search-result__header">
          <span className="search-result__hostname">{hostname}</span>
          <svg className="search-result__external" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>
        <h3 className="search-result__title">{title}</h3>
        {snippet && <p className="search-result__snippet">{snippet}</p>}
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function Search() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SearchPayload | SearchResult[] | null;

  // Loading
  if (!toolOutput) {
    return (
      <div className="search-container">
        <div className="search-loading">
          <div className="search-loading__spinner" />
          <span>Searching...</span>
        </div>
      </div>
    );
  }

  // Normalize payload
  const payload = toolOutput as SearchPayload;
  const results: SearchResult[] = Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(toolOutput)
      ? toolOutput
      : [];

  const answer = typeof payload.answer === 'string' && payload.answer.trim().length
    ? payload.answer.trim()
    : null;

  const query = typeof payload.query === 'string' && payload.query.trim().length
    ? payload.query.trim()
    : undefined;

  const images = Array.isArray(payload.images)
    ? payload.images.filter((img): img is { url: string; description?: string | null } =>
        Boolean(img && typeof img.url === 'string' && img.url.trim().length)
      )
    : [];

  // Empty
  if (results.length === 0 && !answer) {
    return (
      <div className="search-container">
        <div className="search-empty">No search results found.</div>
      </div>
    );
  }

  return (
    <div className="search-container">
      <div className="search-card">
        {/* Header */}
        <div className="search-card__header">
          <div className="search-card__title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="search-card__title">Search Results</span>
          </div>
        </div>

        {/* Query */}
        {query && (
          <div className="search-query">"{query}"</div>
        )}

        {/* AI Summary */}
        {answer && (
          <div className="search-summary">
            <span className="search-summary__label">AI Summary</span>
            <p className="search-summary__text">{answer}</p>
          </div>
        )}

        {/* Images */}
        {images.length > 0 && (
          <div className="search-images">
            <span className="search-images__label">Visuals</span>
            <div className="search-images__grid">
              {images.slice(0, 4).map((img, idx) => (
                <a
                  key={idx}
                  href={img.url}
                  target="_blank"
                  rel="noreferrer"
                  className="search-images__item"
                >
                  <img src={img.url} alt={img.description || 'Search result'} referrerPolicy="no-referrer" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="search-results">
          {results.map((result, index) => (
            <SearchResultItem key={result.id || index} result={result} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('search-root');
if (root) {
  createRoot(root).render(<Search />);
}

export default Search;
