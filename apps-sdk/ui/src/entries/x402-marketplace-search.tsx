import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-marketplace-search.css';

import { createRoot } from 'react-dom/client';
import { useState, useCallback, useEffect } from 'react';
import {
  useOpenAIGlobal,
  useToolInput,
  useTheme,
  useCallToolFn,
  useMaxHeight,
  useDisplayMode,
} from '../sdk';
import {
  ChainIcon,
  getChain,
  QualityBadge,
  VerifiedBadge,
  formatCalls,
  useIntrinsicHeight,
  DebugPanel,
} from '../components/x402';

type Resource = {
  name: string;
  url: string;
  method: string;
  price: string;
  network: string | null;
  description: string;
  category: string;
  qualityScore: number | null;
  verified: boolean;
  totalCalls: number;
  seller: string | null;
  authRequired?: boolean;
  authType?: string | null;
  authHint?: string | null;
};

type SearchPayload = {
  success: boolean;
  count: number;
  resources: Resource[];
  tip?: string;
  error?: string;
};

function updateModelContext(data: Record<string, unknown>) {
  try {
    (window as any).openai?.sendFollowUpMessage?.({
      prompt: `The user selected: ${data.name} at ${data.url} (${data.price})`,
      scrollToBottom: false,
    });
  } catch {}
}

function requestFullscreen() {
  try { (window as any).openai?.requestDisplayMode?.({ mode: 'fullscreen' }); } catch {}
}

function requestInline() {
  try { (window as any).openai?.requestDisplayMode?.({ mode: 'inline' }); } catch {}
}

function ApiCard({ resource, featured = false, onSelect }: {
  resource: Resource;
  featured?: boolean;
  onSelect: (r: Resource) => void;
}) {
  const callTool = useCallToolFn();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const { name: networkName } = getChain(resource.network);

  const handleFetch = useCallback(async () => {
    await callTool('x402_fetch', { url: resource.url, method: resource.method || 'GET' });
  }, [callTool, resource.url, resource.method]);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      await callTool('x402_check', { url: resource.url, method: resource.method || 'GET' });
    } finally {
      setChecking(false);
    }
  }, [callTool, resource.url, resource.method]);

  const handleCopyUrl = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(resource.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [resource.url]);

  const handleCardClick = useCallback(() => {
    onSelect(resource);
  }, [onSelect, resource]);

  return (
    <div
      className={`mkt-card ${featured ? 'mkt-card--featured' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
    >
      <div className="mkt-card__top">
        <div className="mkt-card__info">
          <span className="mkt-card__name">{resource.name}</span>
          {resource.seller && <span className="mkt-card__seller">by {resource.seller}</span>}
        </div>
        <div className="mkt-card__right">
          <span className="mkt-price">
            <ChainIcon network={resource.network} />
            {resource.price}
          </span>
          {networkName && <span className="mkt-network">{networkName}</span>}
          <QualityBadge score={resource.qualityScore} />
        </div>
      </div>
      {resource.description && <div className="mkt-card__desc">{resource.description}</div>}
      <div className="mkt-card__meta">
        <span className="mkt-tag">{resource.category}</span>
        <span className="mkt-tag">{resource.method}</span>
        <VerifiedBadge verified={resource.verified} />
        {resource.authRequired && (
          <span className="mkt-auth-required" title={resource.authHint || 'Provider auth required.'}>
            Auth{resource.authType ? ` (${resource.authType.toUpperCase()})` : ''}
          </span>
        )}
        {resource.totalCalls > 0 && <span className="mkt-calls">{formatCalls(resource.totalCalls)} calls</span>}
      </div>
      <div
        className={`mkt-card__url ${copied ? 'mkt-card__url--copied' : ''}`}
        title="Click to copy"
        onClick={handleCopyUrl}
      >
        {copied ? 'Copied!' : resource.url}
      </div>
      <div className="mkt-card__actions">
        <button className="mkt-check-btn" onClick={(e) => { e.stopPropagation(); handleCheck(); }} disabled={checking}>
          {checking ? '...' : 'Check Price'}
        </button>
        <button className="mkt-fetch-btn" onClick={(e) => { e.stopPropagation(); handleFetch(); }}>
          Fetch {resource.price}
        </button>
      </div>
    </div>
  );
}

function MarketplaceSearch() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SearchPayload | null;
  const toolInput = useToolInput() as { query?: string } | null;
  const widgetState = useOpenAIGlobal('widgetState') as { selectedUrl?: string } | null;
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const displayMode = useDisplayMode();
  const containerRef = useIntrinsicHeight();
  const isFullscreen = displayMode === 'fullscreen';

  // Persist selected card in widget state
  const handleSelectResource = useCallback((r: Resource) => {
    try {
      (window as any).openai?.setWidgetState?.({ selectedUrl: r.url });
    } catch {}
    updateModelContext({ name: r.name, url: r.url, price: r.price, network: r.network });
  }, []);

  const qualityValues = (toolOutput?.resources ?? [])
    .map((r) => r.qualityScore)
    .filter((q): q is number => q !== null);
  const avgQuality = qualityValues.length
    ? Math.round(qualityValues.reduce((sum, q) => sum + q, 0) / qualityValues.length)
    : null;
  const verifiedCount = (toolOutput?.resources ?? []).filter((r) => r.verified).length;

  if (!toolOutput) {
    return (
      <div className="mkt" data-theme={theme} style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="mkt-empty">Loading results...</div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="mkt" data-theme={theme} style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="mkt-empty">{toolOutput.error}</div>
      </div>
    );
  }

  if (toolOutput.count === 0) {
    return (
      <div className="mkt" data-theme={theme} style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="mkt-empty">
          No x402 APIs found{toolInput?.query ? ` for "${toolInput.query}"` : ''}. Try a broader search.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mkt ${isFullscreen ? 'mkt--fullscreen' : ''}`}
      data-theme={theme}
      ref={containerRef}
      style={{ maxHeight: isFullscreen ? undefined : (maxHeight ?? undefined) }}
    >
      <div className="mkt-header">
        <div className="mkt-header__title-block">
          <span className="mkt-header__eyebrow">OpenDexter Marketplace</span>
          <span className="mkt-header__count">{toolOutput.count} result{toolOutput.count !== 1 ? 's' : ''}</span>
          <span className="mkt-header__lede">Discover paid endpoints with the cleanest execution path.</span>
        </div>
        <div className="mkt-header__actions">
          {toolInput?.query && <span className="mkt-header__query">"{toolInput.query}"</span>}
          <button
            className="mkt-expand-btn"
            onClick={isFullscreen ? requestInline : requestFullscreen}
            title={isFullscreen ? 'Minimize' : 'Expand marketplace'}
          >
            {isFullscreen ? 'Minimize' : 'Expand'}
          </button>
        </div>
      </div>
      <div className="mkt-statbar">
        <span className="mkt-statbar__item">Catalog: live</span>
        <span className="mkt-statbar__dot" />
        <span className="mkt-statbar__item">Verified: {verifiedCount}</span>
        <span className="mkt-statbar__dot" />
        <span className="mkt-statbar__item">Avg quality: {avgQuality ?? 'n/a'}</span>
      </div>
      <div className={`mkt-grid ${isFullscreen ? 'mkt-grid--fullscreen' : ''}`}>
        {toolOutput.resources.map((r, i) => (
          <ApiCard
            key={r.url + i}
            resource={r}
            featured={i === 0 && !isFullscreen}
            onSelect={handleSelectResource}
          />
        ))}
      </div>
      {toolOutput.tip && <div className="mkt-tip">{toolOutput.tip}</div>}
      <DebugPanel widgetName="x402-marketplace-search" />
    </div>
  );
}

const root = document.getElementById('x402-marketplace-search-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-04.1');
  createRoot(root).render(<MarketplaceSearch />);
}

export default MarketplaceSearch;
