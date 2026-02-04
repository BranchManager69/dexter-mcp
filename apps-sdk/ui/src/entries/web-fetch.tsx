import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/web-fetch.css';

import { useOpenAIGlobal } from "../sdk";

type FetchPayload = {
  title?: string;
  url?: string;
  text?: string;
  snippet?: string;
  images?: string[];
  error?: string;
};

function extractHostname(url?: string): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

export default function WebFetch() {
  const toolOutput = useOpenAIGlobal("toolOutput") as FetchPayload | undefined;

  if (!toolOutput) {
    return (
      <div className="fetch-container fetch-loading">
        <div className="fetch-spinner" />
        <span>Loading content...</span>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="fetch-container fetch-error">
        <span className="fetch-error-icon">✕</span>
        <span>{toolOutput.error}</span>
      </div>
    );
  }

  const title = toolOutput.title?.trim() || "Document";
  const url = toolOutput.url?.trim();
  const hostname = extractHostname(url);
  const snippet = toolOutput.snippet?.trim();
  const text = toolOutput.text ?? "";
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const images = Array.isArray(toolOutput.images) ? toolOutput.images.slice(0, 3) : [];

  return (
    <div className="fetch-container">
      {/* Header */}
      <header className="fetch-header">
        <span className="fetch-icon">📄</span>
        <span className="fetch-label">Page Content</span>
      </header>

      {/* Title & URL */}
      <div className="fetch-title-section">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="fetch-title-link">
            <h1 className="fetch-title">{title}</h1>
            <span className="fetch-external">↗</span>
          </a>
        ) : (
          <h1 className="fetch-title">{title}</h1>
        )}
        {hostname && <div className="fetch-hostname">{hostname}</div>}
      </div>

      {/* Images */}
      {images.length > 0 && (
        <div className="fetch-images">
          {images.map((img, idx) => (
            <a
              key={idx}
              href={img}
              target="_blank"
              rel="noreferrer"
              className="fetch-image-link"
            >
              <img src={img} alt={`Image ${idx + 1}`} className="fetch-image" />
            </a>
          ))}
        </div>
      )}

      {/* Snippet */}
      {snippet && (
        <div className="fetch-snippet">
          <p>{truncateText(snippet, 300)}</p>
        </div>
      )}

      {/* Content */}
      {paragraphs.length > 0 && (
        <div className="fetch-content">
          {paragraphs.slice(0, 5).map((p, idx) => (
            <p key={idx}>{truncateText(p, 500)}</p>
          ))}
          {paragraphs.length > 5 && (
            <div className="fetch-more">
              +{paragraphs.length - 5} more paragraphs
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {paragraphs.length === 0 && !snippet && (
        <div className="fetch-empty">
          No content extracted from this page.
        </div>
      )}
    </div>
  );
}
