import '../styles/sdk.css';
// Primitive Professor/Doctor visuals (stamps, thermometers, avatars). The
// rule scope is `dx-pricing__*` and doesn't collide with search styles.
// Refactor to a shared primitives stylesheet in a follow-up.
import '../styles/widgets/x402-pricing.css';
// Shared loading visual (used by MarketBoardLoading)
import '../styles/components/dexter-loading.css';
// x402gle "by Dexter" composite lockup (used in the search header)
import '../styles/components/x402gle-lockup.css';
// Search widget styles (identity icons + header + cell + drawer)
import '../styles/widgets/x402-search.css';

import { createRoot } from 'react-dom/client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { EmptyMessage } from '@openai/apps-sdk-ui/components/EmptyMessage';
import { Search, Warning } from '@openai/apps-sdk-ui/components/Icon';
import {
  useCallToolFn,
  useToolOutput,
  useToolInput,
  useAdaptiveTheme,
  useDisplayMode,
  useMaxHeight,
  useUserAgent,
} from '../sdk';
import { DebugPanel } from '../components/x402';
import { MarketplaceSummaryHeader } from '../components/x402/search/MarketplaceSummaryHeader';
import { SearchVerdictRow } from '../components/x402/search/SearchVerdictRow';
import { MarketBoardLoading } from '../components/x402/search/MarketBoardLoading';
import { SearchVerdictDrawer } from '../components/x402/search/SearchVerdictDrawer';
import type {
  SearchResource,
  SearchRerankInfo,
  SearchIntent,
  SearchMeta,
  SearchNoMatchReason,
} from '../components/x402/search/types';
import { addWidgetBreadcrumb, captureWidgetException } from '../sdk/init-sentry';

type SearchPayload = {
  success?: boolean;
  // Flat legacy field: strongResults + relatedResults concatenated, for
  // anything still pattern-matching the old shape.
  count: number;
  resources: SearchResource[];
  // Tiered shape from capability search. These are the canonical source of
  // truth — the widget renders from them, not from `resources`.
  strongResults?: SearchResource[];
  relatedResults?: SearchResource[];
  strongCount?: number;
  relatedCount?: number;
  topSimilarity?: number | null;
  noMatchReason?: SearchNoMatchReason;
  rerank?: SearchRerankInfo;
  intent?: SearchIntent;
  searchMeta?: SearchMeta;
  tip?: string;
  error?: string;
};

type SearchToolInput = {
  query?: string;
  limit?: number;
  unverified?: boolean;
  testnets?: boolean;
};

// Bespoke snapshot reader removed 2026-05-05: it only read window.openai
// (ChatGPT-only) and never picked up MCP-Apps tool-result notifications,
// so the widget hung in the "Building the market board…" state on Claude.
// MarketplaceSearch now uses the dual-runtime adapter hooks.

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
  const resources = Array.isArray(payload.resources) ? payload.resources.map(normalizeSearchResource) : [];
  const strongResults = Array.isArray(payload.strongResults)
    ? payload.strongResults.map(normalizeSearchResource)
    : undefined;
  const relatedResults = Array.isArray(payload.relatedResults)
    ? payload.relatedResults.map(normalizeSearchResource)
    : undefined;
  return {
    ...payload,
    resources,
    strongResults,
    relatedResults,
  };
}

function MarketplaceSearch() {
  // Use the dual-runtime adapter so the widget reads tool data on BOTH ChatGPT
  // (window.openai globals) and Claude/MCP-Apps hosts (ui/notifications/tool-result).
  // The previous bespoke `useSearchWidgetSnapshot` only read window.openai and
  // therefore never received toolOutput on Claude — the widget hung on the
  // "Building the market board…" placeholder forever even though the tool
  // call succeeded server-side.
  const toolOutput = useToolOutput<SearchPayload>();
  const toolInput = useToolInput<SearchToolInput>();
  const theme = useAdaptiveTheme();
  const maxHeight = useMaxHeight();
  const displayMode = useDisplayMode();
  const userAgent = useUserAgent();
  const isMobile = userAgent?.device?.type === 'mobile';
  const callTool = useCallToolFn();
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
    if (!liveResult) {
      setQueryDraft(externalQuery);
    }
  }, [externalQuery, liveResult]);

  useEffect(() => {
    if (!activeOutput) return;
    addWidgetBreadcrumb('search_payload_normalized', {
      count: Array.isArray(activeOutput.resources) ? activeOutput.resources.length : 0,
    });
  }, [activeOutput]);

  const strongResults = activeOutput?.strongResults ?? [];
  const relatedResults = activeOutput?.relatedResults ?? [];
  // Fallback: if the tool emitted the flat legacy shape only, use it as the
  // strong section so nothing disappears.
  const hasTieredShape = strongResults.length > 0 || relatedResults.length > 0;
  const resources = hasTieredShape
    ? [...strongResults, ...relatedResults]
    : (activeOutput?.resources ?? []);
  const strongCount = activeOutput?.strongCount ?? strongResults.length;
  const relatedCount = activeOutput?.relatedCount ?? relatedResults.length;
  const rerankApplied = activeOutput?.rerank?.applied === true;
  const noMatchReason = activeOutput?.noMatchReason ?? null;
  const searchMode = activeOutput?.searchMeta?.mode ?? 'none';
  const searchNote = activeOutput?.searchMeta?.note ?? '';
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
        limit: typeof toolInput?.limit === 'number' ? toolInput.limit : undefined,
        unverified: typeof toolInput?.unverified === 'boolean' ? toolInput.unverified : undefined,
        testnets: typeof toolInput?.testnets === 'boolean' ? toolInput.testnets : undefined,
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

  if (!activeOutput) {
    return (
      <div data-theme={theme} className="p-2" style={{ maxHeight: maxHeight ?? undefined }}>
        <MarketBoardLoading query={externalQuery || queryDraft} />
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
    const queryLabel = externalQuery || queryDraft;
    const emptyTitle =
      noMatchReason === 'below_strong_threshold'
        ? `Only weak matches${queryLabel ? ` for "${queryLabel}"` : ''}`
        : `No x402 APIs found${queryLabel ? ` for "${queryLabel}"` : ''}`;
    const emptyDescription =
      noMatchReason === 'below_similarity_threshold'
        ? 'Nothing in our capability index matches that query yet. Try rephrasing, or widen the description of what you want to do.'
        : noMatchReason === 'below_strong_threshold'
          ? 'We found some adjacent services but nothing cleared the strong-match bar. Try a more specific verb for the capability you want.'
          : 'Try a broader query or a different angle.';
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <EmptyMessage className="rounded-2xl border border-subtle bg-surface px-4 py-8">
          <EmptyMessage.Icon><Search /></EmptyMessage.Icon>
          <EmptyMessage.Title>{emptyTitle}</EmptyMessage.Title>
          <EmptyMessage.Description>{emptyDescription}</EmptyMessage.Description>
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
          resultCount={activeOutput.count}
          strongCount={hasTieredShape ? strongCount : undefined}
          relatedCount={hasTieredShape ? relatedCount : undefined}
          rerankApplied={rerankApplied}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>

      {!isMobile && !isFullscreen && detailOpen && selectedResource && (
        <div className="px-4 pt-4">
          <SearchVerdictDrawer
            resource={selectedResource}
            onClose={handleCloseDetail}
            onCheckPrice={runCheckPrice}
            onFetch={runFetch}
          />
        </div>
      )}

      <div className={`px-4 py-4 ${isFullscreen ? 'grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]' : ''}`}>
        <div className="flex flex-col gap-5">
          {hasTieredShape ? (
            <>
              {strongResults.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center gap-2 px-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff9a52]">
                      Strong matches
                    </span>
                    <span className="text-[10px] text-tertiary">{strongResults.length}</span>
                    <span className="flex-1 border-t border-[rgba(255,107,0,0.18)]" />
                  </div>
                  <div className={`grid gap-3 ${isFullscreen ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
                    {strongResults.map((resource, index) => (
                      <SearchVerdictRow
                        key={`strong-${resource.url}-${index}`}
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
                </section>
              )}
              {relatedResults.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center gap-2 px-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-tertiary">
                      Related services
                    </span>
                    <span className="text-[10px] text-tertiary">{relatedResults.length}</span>
                    <span className="flex-1 border-t border-white/8" />
                  </div>
                  <div className={`grid gap-3 ${isFullscreen ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
                    {relatedResults.map((resource, index) => (
                      <SearchVerdictRow
                        key={`related-${resource.url}-${index}`}
                        resource={resource}
                        index={index}
                        featured={false}
                        selected={effectiveSelectedUrl === resource.url}
                        onInspect={handleInspectResource}
                        onCheckPrice={runCheckPrice}
                        onFetch={runFetch}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className={`grid gap-3 ${isFullscreen ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
              {resources.map((resource, index) => (
                <SearchVerdictRow
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
          )}
        </div>

        {isFullscreen && !isMobile && (
          <div className="min-w-0">
            {detailOpen && selectedResource ? (
              <SearchVerdictDrawer
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
            <SearchVerdictDrawer
              resource={selectedResource}
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
      <DebugPanel
        widgetName="x402-marketplace-search"
        extraInfo={{
          externalQuery,
          queryDraft,
          liveResultCount: liveResult?.count ?? 0,
          activeResultCount: activeOutput?.count ?? 0,
          strongCount,
          relatedCount,
          topSimilarity: activeOutput?.topSimilarity ?? null,
          noMatchReason: noMatchReason ?? '',
          rerankApplied,
          rerankReason: activeOutput?.rerank?.reason ?? '',
          intentCapabilityText: activeOutput?.intent?.capabilityText ?? '',
          searchMode,
          searchNote,
          selectedUrl: effectiveSelectedUrl ?? '',
          detailOpen,
          isSearching,
          isMobile,
          isFullscreen,
        }}
      />
    </div>
  );
}

const root = document.getElementById('x402-marketplace-search-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-04-16.1');
  createRoot(root).render(<MarketplaceSearch />);
}

export default MarketplaceSearch;
