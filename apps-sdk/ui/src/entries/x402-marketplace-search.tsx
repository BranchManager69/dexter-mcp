import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { EmptyMessage } from '@openai/apps-sdk-ui/components/EmptyMessage';
import { Search, Warning } from '@openai/apps-sdk-ui/components/Icon';
import {
  useOpenAIGlobal,
  useToolInput,
  useTheme,
  useCallToolFn,
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useSendFollowUp,
  useWidgetState,
} from '../sdk';
import { useIntrinsicHeight, DebugPanel } from '../components/x402';
import { MarketplaceSummaryHeader } from '../components/x402/search/MarketplaceSummaryHeader';
import { SearchResultCard } from '../components/x402/search/SearchResultCard';
import { SearchResourceDetail } from '../components/x402/search/SearchResourceDetail';
import type { SearchResource, SearchWidgetState } from '../components/x402/search/types';

type SearchPayload = {
  success: boolean;
  count: number;
  resources: SearchResource[];
  tip?: string;
  error?: string;
};

function MarketplaceSearch() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SearchPayload | null;
  const toolInput = useToolInput() as { query?: string } | null;
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();
  const sendFollowUp = useSendFollowUp();
  const callTool = useCallToolFn();
  const containerRef = useIntrinsicHeight();
  const isFullscreen = displayMode === 'fullscreen';
  const [widgetState, setWidgetState] = useWidgetState<SearchWidgetState>({});

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  useEffect(() => {
    const firstUrl = toolOutput?.resources?.[0]?.url;
    if (!firstUrl) return;
    if (widgetState.selectedUrl && toolOutput?.resources?.some((resource) => resource.url === widgetState.selectedUrl)) {
      return;
    }
    void setWidgetState((prev) => ({ ...prev, selectedUrl: firstUrl, detailOpen: prev.detailOpen ?? false }));
  }, [setWidgetState, toolOutput?.resources, widgetState.selectedUrl]);

  const resources = toolOutput?.resources ?? [];
  const selectedResource = useMemo(
    () => resources.find((resource) => resource.url === widgetState.selectedUrl) ?? resources[0] ?? null,
    [resources, widgetState.selectedUrl],
  );

  const runCheckPrice = useCallback(async (resource: SearchResource) => {
    await callTool('x402_check', { url: resource.url, method: resource.method || 'GET' });
  }, [callTool]);

  const runFetch = useCallback(async (resource: SearchResource) => {
    await callTool('x402_fetch', { url: resource.url, method: resource.method || 'GET' });
  }, [callTool]);

  const handleInspectResource = useCallback(async (resource: SearchResource) => {
    const shouldSendPrompt = widgetState.lastPromptedUrl !== resource.url;
    await setWidgetState((prev) => ({
      ...prev,
      selectedUrl: resource.url,
      detailOpen: true,
      lastPromptedUrl: shouldSendPrompt ? resource.url : prev.lastPromptedUrl,
    }));
    if (shouldSendPrompt) {
      await sendFollowUp(`The user is inspecting ${resource.name} at ${resource.url} on ${resource.network ?? 'an unknown network'} and is evaluating whether it is worth paying for.`);
    }
  }, [sendFollowUp, setWidgetState, widgetState.lastPromptedUrl]);

  const handleCloseDetail = useCallback(async () => {
    await setWidgetState((prev) => ({ ...prev, detailOpen: false }));
  }, [setWidgetState]);

  const toggleFullscreen = useCallback(() => {
    if (!requestDisplayMode) return;
    void requestDisplayMode({ mode: isFullscreen ? 'inline' : 'fullscreen' });
  }, [isFullscreen, requestDisplayMode]);

  const qualityValues = resources
    .map((r) => r.qualityScore)
    .filter((q): q is number => q !== null);
  const avgQuality = qualityValues.length
    ? Math.round(qualityValues.reduce((sum, q) => sum + q, 0) / qualityValues.length)
    : null;
  const verifiedCount = resources.filter((r) => r.verified).length;

  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (toolOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [toolOutput]);

  if (!toolOutput) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <EmptyMessage className="rounded-2xl border border-subtle bg-surface px-4 py-8">
          <EmptyMessage.Icon><Search /></EmptyMessage.Icon>
          <EmptyMessage.Title>{loadingElapsed < 5 ? 'Building the market board…' : 'Dexter is still surveying the market.'}</EmptyMessage.Title>
          <EmptyMessage.Description>
            {loadingElapsed < 5 ? 'Ranking paid APIs and trust signals.' : 'This is taking longer than usual, but the search is still in flight.'}
          </EmptyMessage.Description>
        </EmptyMessage>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <EmptyMessage className="rounded-2xl border border-subtle bg-surface px-4 py-8">
          <EmptyMessage.Icon color="danger"><Warning /></EmptyMessage.Icon>
          <EmptyMessage.Title color="danger">{toolOutput.error}</EmptyMessage.Title>
          <EmptyMessage.Description>Dexter could not build the marketplace view for this request.</EmptyMessage.Description>
        </EmptyMessage>
      </div>
    );
  }

  if (toolOutput.count === 0) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <EmptyMessage className="rounded-2xl border border-subtle bg-surface px-4 py-8">
          <EmptyMessage.Icon><Search /></EmptyMessage.Icon>
          <EmptyMessage.Title>No x402 APIs found{toolInput?.query ? ` for "${toolInput.query}"` : ''}</EmptyMessage.Title>
          <EmptyMessage.Description>Try a broader query or a different provider/category angle.</EmptyMessage.Description>
        </EmptyMessage>
      </div>
    );
  }

  return (
    <div
      data-theme={theme}
      ref={containerRef}
      className={`flex flex-col overflow-y-auto ${isFullscreen ? 'p-5 sm:p-6' : 'p-0'}`}
      style={{ maxHeight: isFullscreen ? undefined : (maxHeight ?? undefined) }}
    >
      <div className="px-4 pt-4">
        <MarketplaceSummaryHeader
          query={toolInput?.query}
          resultCount={toolOutput.count}
          verifiedCount={verifiedCount}
          avgQuality={avgQuality}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>

      {!isFullscreen && widgetState.detailOpen && selectedResource && (
        <div className="px-4 pt-4">
          <SearchResourceDetail
            resource={selectedResource}
            inline
            onClose={handleCloseDetail}
            onCheckPrice={runCheckPrice}
            onFetch={runFetch}
          />
        </div>
      )}

      <div className={`px-4 py-4 ${isFullscreen ? 'grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]' : ''}`}>
        <div className={`grid gap-3 ${isFullscreen ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
          {resources.map((resource, index) => (
            <SearchResultCard
              key={`${resource.url}-${index}`}
              resource={resource}
              index={index}
              featured={index === 0}
              selected={selectedResource?.url === resource.url}
              onInspect={handleInspectResource}
              onCheckPrice={runCheckPrice}
              onFetch={runFetch}
            />
          ))}
        </div>

        {isFullscreen && (
          <div className="min-w-0">
            {widgetState.detailOpen && selectedResource ? (
              <SearchResourceDetail
                resource={selectedResource}
                onClose={handleCloseDetail}
                onCheckPrice={runCheckPrice}
                onFetch={runFetch}
              />
            ) : (
              <div className="sticky top-4 rounded-[22px] border border-dashed border-subtle bg-surface px-4 py-6">
                <div className="text-[10px] uppercase tracking-[0.22em] text-tertiary">Inspection Deck</div>
                <h3 className="mt-2 text-lg font-semibold text-primary">Select a result to inspect</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  Fullscreen mode now supports a dedicated review surface. Pick any candidate to compare pricing, trust signals, and endpoint context without losing the market board.
                </p>
                {selectedResource && (
                  <Button className="mt-4" variant="soft" color="secondary" size="sm" onClick={() => handleInspectResource(selectedResource)}>
                    Open {selectedResource.name}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
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
  root.setAttribute('data-widget-build', '2026-03-07.1');
  createRoot(root).render(<MarketplaceSearch />);
}

export default MarketplaceSearch;
