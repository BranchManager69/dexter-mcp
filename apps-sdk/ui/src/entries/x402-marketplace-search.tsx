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
  useIsMobile,
} from '../sdk';
import { DebugPanel } from '../components/x402';
import { MarketplaceSummaryHeader } from '../components/x402/search/MarketplaceSummaryHeader';
import { SearchResultCard } from '../components/x402/search/SearchResultCard';
import { SearchResourceDetail } from '../components/x402/search/SearchResourceDetail';
import type { SearchResource, SearchWidgetState } from '../components/x402/search/types';
import { addWidgetBreadcrumb, captureWidgetException } from '../sdk/init-sentry';

type SearchPayload = {
  success: boolean;
  count: number;
  resources: SearchResource[];
  searchMeta?: {
    mode?: string;
    note?: string;
  };
  tip?: string;
  error?: string;
};

type SearchToolInput = {
  query?: string;
  category?: string;
  network?: string;
  maxPriceUsdc?: number;
  verifiedOnly?: boolean;
  sort?: string;
  limit?: number;
};

function normalizeSearchResource(resource: SearchResource): SearchResource {
  const sellerValue = resource.seller;
  const sellerMeta = resource.sellerMeta ?? {
    payTo: null,
    displayName: null,
    logoUrl: null,
    twitterHandle: null,
  };

  if (sellerValue && typeof sellerValue === 'object') {
    const sellerObj = sellerValue as Record<string, unknown>;
    return {
      ...resource,
      seller: typeof sellerObj.displayName === 'string' ? sellerObj.displayName : null,
      sellerMeta: {
        payTo: typeof sellerObj.payTo === 'string' ? sellerObj.payTo : sellerMeta.payTo ?? null,
        displayName: typeof sellerObj.displayName === 'string' ? sellerObj.displayName : sellerMeta.displayName ?? null,
        logoUrl: typeof sellerObj.logoUrl === 'string' ? sellerObj.logoUrl : sellerMeta.logoUrl ?? null,
        twitterHandle: typeof sellerObj.twitterHandle === 'string' ? sellerObj.twitterHandle : sellerMeta.twitterHandle ?? null,
      },
    };
  }

  return {
    ...resource,
    seller: typeof sellerValue === 'string' ? sellerValue : null,
    sellerMeta,
  };
}

function normalizeSearchPayload(payload: SearchPayload | null): SearchPayload | null {
  if (!payload) return payload;
  return {
    ...payload,
    resources: Array.isArray(payload.resources) ? payload.resources.map(normalizeSearchResource) : [],
  };
}

function MarketplaceSearch() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SearchPayload | null;
  const toolInput = useToolInput() as SearchToolInput | null;
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const displayMode = useDisplayMode();
  const callTool = useCallToolFn();
  const isMobile = useIsMobile();
  const isFullscreen = displayMode === 'fullscreen';
  const [liveResult, setLiveResult] = useState<SearchPayload | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const activeOutput = useMemo(
    () => normalizeSearchPayload(liveResult ?? toolOutput),
    [liveResult, toolOutput],
  );
  const externalQuery = toolInput?.query ?? '';
  const [queryDraft, setQueryDraft] = useState(externalQuery);
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  useEffect(() => {
    if (!liveResult && externalQuery !== queryDraft) {
      setQueryDraft(externalQuery);
    }
  }, [externalQuery, liveResult, queryDraft]);

  useEffect(() => {
    if (!activeOutput) return;
    addWidgetBreadcrumb('search_payload_normalized', {
      count: Array.isArray(activeOutput.resources) ? activeOutput.resources.length : 0,
    });
  }, [activeOutput]);

  const resources = activeOutput?.resources ?? [];
  const effectiveSelectedUrl = useMemo(() => {
    if (selectedUrl && resources.some((resource) => resource.url === selectedUrl)) {
      return selectedUrl;
    }
    return resources[0]?.url;
  }, [resources, selectedUrl]);
  const selectedResource = useMemo(
    () => resources.find((resource) => resource.url === effectiveSelectedUrl) ?? resources[0] ?? null,
    [effectiveSelectedUrl, resources],
  );

  const runCheckPrice = useCallback(async (resource: SearchResource) => {
    addWidgetBreadcrumb('check_price_clicked', { url: resource.url, method: resource.method });
    await callTool('x402_check', { url: resource.url, method: resource.method || 'GET' });
  }, [callTool]);

  const runFetch = useCallback(async (resource: SearchResource) => {
    addWidgetBreadcrumb('fetch_clicked', { url: resource.url, method: resource.method });
    await callTool('x402_fetch', { url: resource.url, method: resource.method || 'GET' });
  }, [callTool]);

  const handleInspectResource = useCallback(async (resource: SearchResource) => {
    addWidgetBreadcrumb('inspect_opened', { url: resource.url, resourceId: resource.resourceId });
    setSelectedUrl(resource.url);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(async () => {
    addWidgetBreadcrumb('inspect_closed');
    setDetailOpen(false);
  }, []);

  const handleSearchSubmit = useCallback(async () => {
    const nextQuery = queryDraft.trim();
    addWidgetBreadcrumb('search_submit', { query: nextQuery });
    setIsSearching(true);
    try {
      const previousSelectedUrl = selectedUrl;
      const previousDetailOpen = detailOpen;
      const response = await callTool('x402_search', {
        query: nextQuery,
        category: typeof toolInput?.category === 'string' ? toolInput.category : undefined,
        network: typeof toolInput?.network === 'string' ? toolInput.network : undefined,
        maxPriceUsdc: typeof toolInput?.maxPriceUsdc === 'number' ? toolInput.maxPriceUsdc : undefined,
        verifiedOnly: typeof toolInput?.verifiedOnly === 'boolean' ? toolInput.verifiedOnly : undefined,
        sort: typeof toolInput?.sort === 'string' ? toolInput.sort : undefined,
        limit: typeof toolInput?.limit === 'number' ? toolInput.limit : undefined,
      }) as { structuredContent?: SearchPayload } | null;
      const next = normalizeSearchPayload(response?.structuredContent ?? null);
      if (!next) return;
      setLiveResult(next);
      addWidgetBreadcrumb('search_result_loaded', {
        query: nextQuery,
        count: next.count,
        mode: next.searchMeta?.mode ?? 'unknown',
      });
      const nextSelectedUrl = next.resources.some((resource) => resource.url === previousSelectedUrl)
        ? previousSelectedUrl
        : next.resources[0]?.url;
      setQueryDraft(nextQuery);
      setSelectedUrl(nextSelectedUrl);
      setDetailOpen(previousDetailOpen && Boolean(nextSelectedUrl));
    } catch (error) {
      captureWidgetException(error, { phase: 'search_submit', query: nextQuery });
      throw error;
    } finally {
      setIsSearching(false);
    }
  }, [callTool, detailOpen, queryDraft, selectedUrl, toolInput]);

  const toggleFullscreen = useCallback(() => {
    try {
      window.openai?.requestDisplayMode?.({ mode: isFullscreen ? 'inline' : 'fullscreen' });
    } catch (error) {
      captureWidgetException(error, { phase: 'request_display_mode' });
    }
  }, [isFullscreen]);

  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (activeOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [activeOutput]);

  if (!activeOutput) {
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

  if (activeOutput.error) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <EmptyMessage className="rounded-2xl border border-subtle bg-surface px-4 py-8">
          <EmptyMessage.Icon color="danger"><Warning /></EmptyMessage.Icon>
          <EmptyMessage.Title color="danger">{activeOutput.error}</EmptyMessage.Title>
          <EmptyMessage.Description>Dexter could not build the marketplace view for this request.</EmptyMessage.Description>
        </EmptyMessage>
      </div>
    );
  }

  if (activeOutput.count === 0) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <EmptyMessage className="rounded-2xl border border-subtle bg-surface px-4 py-8">
          <EmptyMessage.Icon><Search /></EmptyMessage.Icon>
          <EmptyMessage.Title>No x402 APIs found{externalQuery ? ` for "${externalQuery}"` : ''}</EmptyMessage.Title>
          <EmptyMessage.Description>Try a broader query or a different provider/category angle.</EmptyMessage.Description>
        </EmptyMessage>
      </div>
    );
  }

  return (
    <div
      data-theme={theme}
      className={`flex flex-col overflow-y-auto ${isFullscreen ? 'p-5 sm:p-6' : 'p-0'}`}
      style={{ maxHeight: isFullscreen ? undefined : (maxHeight ?? undefined) }}
    >
      <div className="px-4 pt-4">
        <MarketplaceSummaryHeader
          queryValue={queryDraft}
          onQueryChange={setQueryDraft}
          onSearchSubmit={handleSearchSubmit}
          resultCount={activeOutput.count}
          isSearching={isSearching}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>

      {!isMobile && !isFullscreen && detailOpen && selectedResource && (
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
              selected={effectiveSelectedUrl === resource.url}
              onInspect={handleInspectResource}
              onCheckPrice={runCheckPrice}
              onFetch={runFetch}
            />
          ))}
        </div>

        {isFullscreen && !isMobile && (
          <div className="min-w-0">
            {detailOpen && selectedResource ? (
              <SearchResourceDetail
                resource={selectedResource}
                onClose={handleCloseDetail}
                onCheckPrice={runCheckPrice}
                onFetch={runFetch}
              />
            ) : (
              <div className="sticky top-4 rounded-[22px] border border-dashed border-subtle bg-surface px-4 py-6 transition-all duration-200">
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

      {isMobile && detailOpen && selectedResource && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/50 px-3 py-3 backdrop-blur-sm" onClick={() => { void handleCloseDetail(); }}>
          <div className="max-h-[92vh] w-full overflow-y-auto animate-[fadein_.18s_ease-out]" onClick={(event) => event.stopPropagation()}>
            <SearchResourceDetail
              resource={selectedResource}
              inline
              onClose={handleCloseDetail}
              onCheckPrice={runCheckPrice}
              onFetch={runFetch}
            />
          </div>
        </div>
      )}

      {activeOutput.tip && (
        <p className="text-xs text-tertiary px-4 pb-3">{activeOutput.tip}</p>
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
