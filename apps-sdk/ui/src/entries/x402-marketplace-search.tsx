import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState, useCallback, useEffect } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { EmptyMessage } from '@openai/apps-sdk-ui/components/EmptyMessage';
import { Search, Warning } from '@openai/apps-sdk-ui/components/Icon';
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

const WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';
const LOGO_MARK_URL = 'https://dexter.cash/assets/pokedexter/dexter-logo.svg';

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

function ApiCard({ resource, index, featured = false, onSelect }: {
  resource: Resource;
  index: number;
  featured?: boolean;
  onSelect: (r: Resource) => void;
}) {
  const callTool = useCallToolFn();
  const [checking, setChecking] = useState(false);
  const [visible, setVisible] = useState(false);
  const { name: networkName } = getChain(resource.network);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60 + index * 40);
    return () => clearTimeout(t);
  }, [index]);

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

  return (
    <div
      className={`rounded-2xl border bg-surface p-4 flex flex-col gap-3 cursor-pointer transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${featured ? 'border-[#ff6b00]/25 shadow-[0_0_20px_rgba(255,107,0,0.06)]' : 'border-default'} hover:border-[#ff6b00]/40`}
      onClick={() => onSelect(resource)}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="heading-sm truncate">{resource.name}</span>
          {resource.seller && <span className="text-xs text-secondary">by {resource.seller}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge color="success" variant="soft" pill>
            <ChainIcon network={resource.network} size={12} />
            {resource.price}
          </Badge>
          {networkName && <Badge color="info" variant="outline" size="sm">{networkName}</Badge>}
          <QualityBadge score={resource.qualityScore} />
        </div>
      </div>

      {resource.description && (
        <p className="text-sm text-secondary line-clamp-2">{resource.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" size="sm">{resource.category}</Badge>
        <Badge variant="outline" size="sm">{resource.method}</Badge>
        <VerifiedBadge verified={resource.verified} />
        {resource.authRequired && (
          <Badge color="warning" size="sm" title={resource.authHint || 'Provider auth required.'}>
            Auth{resource.authType ? ` (${resource.authType.toUpperCase()})` : ''}
          </Badge>
        )}
        {resource.totalCalls > 0 && (
          <span className="text-3xs text-tertiary">{formatCalls(resource.totalCalls)} calls</span>
        )}
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-3xs text-tertiary font-mono truncate flex-1">{resource.url}</span>
        <CopyButton copyValue={resource.url} variant="ghost" color="secondary" size="sm" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          Copy
        </CopyButton>
      </div>

      <div className="flex gap-2">
        <Button variant="soft" color="secondary" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCheck(); }} disabled={checking}>
          {checking ? '...' : 'Check Price'}
        </Button>
        <Button color="primary" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleFetch(); }}>
          Fetch {resource.price}
        </Button>
      </div>
    </div>
  );
}

function MarketplaceSearch() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SearchPayload | null;
  const toolInput = useToolInput() as { query?: string } | null;
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const displayMode = useDisplayMode();
  const containerRef = useIntrinsicHeight();
  const isFullscreen = displayMode === 'fullscreen';

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const handleSelectResource = useCallback((r: Resource) => {
    try {
      (window as any).openai?.setWidgetState?.({ selectedUrl: r.url });
      (window as any).openai?.sendFollowUpMessage?.({
        prompt: `The user selected: ${r.name} at ${r.url} (${r.price})`,
        scrollToBottom: false,
      });
    } catch {}
  }, []);

  const toggleFullscreen = useCallback(() => {
    try {
      (window as any).openai?.requestDisplayMode?.({ mode: isFullscreen ? 'inline' : 'fullscreen' });
    } catch {}
  }, [isFullscreen]);

  const qualityValues = (toolOutput?.resources ?? [])
    .map((r) => r.qualityScore)
    .filter((q): q is number => q !== null);
  const avgQuality = qualityValues.length
    ? Math.round(qualityValues.reduce((sum, q) => sum + q, 0) / qualityValues.length)
    : null;
  const verifiedCount = (toolOutput?.resources ?? []).filter((r) => r.verified).length;

  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (toolOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [toolOutput]);

  if (!toolOutput) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <EmptyMessage>
          <EmptyMessage.Icon><Search /></EmptyMessage.Icon>
          <EmptyMessage.Title>{loadingElapsed < 5 ? 'Loading results...' : 'Still searching — hang tight.'}</EmptyMessage.Title>
        </EmptyMessage>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <EmptyMessage>
          <EmptyMessage.Icon color="danger"><Warning /></EmptyMessage.Icon>
          <EmptyMessage.Title color="danger">{toolOutput.error}</EmptyMessage.Title>
        </EmptyMessage>
      </div>
    );
  }

  if (toolOutput.count === 0) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <EmptyMessage>
          <EmptyMessage.Icon><Search /></EmptyMessage.Icon>
          <EmptyMessage.Title>No x402 APIs found{toolInput?.query ? ` for "${toolInput.query}"` : ''}</EmptyMessage.Title>
          <EmptyMessage.Description>Try a broader search term.</EmptyMessage.Description>
        </EmptyMessage>
      </div>
    );
  }

  return (
    <div
      data-theme={theme}
      ref={containerRef}
      className={`flex flex-col ${isFullscreen ? 'p-6' : 'p-0'} overflow-y-auto`}
      style={{ maxHeight: isFullscreen ? undefined : (maxHeight ?? undefined) }}
    >
      {/* Branded header */}
      <div className="relative overflow-hidden rounded-t-2xl px-4 pt-4 pb-3"
        style={{ background: 'linear-gradient(135deg, rgba(209,63,0,0.08) 0%, rgba(255,107,0,0.04) 50%, transparent 100%)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={LOGO_MARK_URL} alt="Dexter logo" width={24} height={24} style={{ width: 24, height: 24, flexShrink: 0 }} />
            <img src={WORDMARK_URL} alt="Dexter" height={22} style={{ height: 22, width: 'auto', opacity: 0.9 }} />
            <span className="text-xs text-tertiary">Marketplace</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {toolInput?.query && <Badge variant="outline" size="sm">&quot;{toolInput.query}&quot;</Badge>}
            <Button variant="soft" color="secondary" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? 'Minimize' : 'Expand'}
            </Button>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="heading-lg">{toolOutput.count}</span>
          <span className="text-sm text-secondary">result{toolOutput.count !== 1 ? 's' : ''}</span>
          <span className="text-3xs text-tertiary ml-auto">{verifiedCount} verified · avg quality {avgQuality ?? 'n/a'}</span>
        </div>
        {/* Subtle orange accent line */}
        <div className="absolute bottom-0 left-4 right-4 h-px" style={{ background: 'linear-gradient(90deg, #ff6b00 0%, transparent 100%)', opacity: 0.15 }} />
      </div>

      {/* Results */}
      <div className={`flex flex-col gap-3 px-4 py-3 ${isFullscreen ? 'grid grid-cols-1 sm:grid-cols-2' : ''}`}>
        {toolOutput.resources.map((r, i) => (
          <ApiCard
            key={r.url + i}
            resource={r}
            index={i}
            featured={i === 0 && !isFullscreen}
            onSelect={handleSelectResource}
          />
        ))}
      </div>

      {toolOutput.tip && (
        <p className="text-xs text-tertiary px-4 pb-3">{toolOutput.tip}</p>
      )}
      <DebugPanel widgetName="x402-marketplace-search" />
    </div>
  );
}

const root = document.getElementById('x402-marketplace-search-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-05.2');
  createRoot(root).render(<MarketplaceSearch />);
}

export default MarketplaceSearch;
