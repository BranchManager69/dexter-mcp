const WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';

/**
 * Marketplace header — wordmark + eyebrow + meta line.
 *
 * The on-widget search input was removed: agents communicate via chat,
 * nobody types into the widget input, and on mobile it ate ~140px of
 * vertical space above the actual results. The toolbar still keeps
 * the result-count line, the reranked tag, and the expand affordance.
 */
export function MarketplaceSummaryHeader({
  resultCount,
  strongCount,
  relatedCount,
  rerankApplied = false,
  isFullscreen,
  onToggleFullscreen,
}: {
  resultCount: number;
  strongCount?: number;
  relatedCount?: number;
  rerankApplied?: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const hasTieredCounts =
    typeof strongCount === 'number' && typeof relatedCount === 'number';
  const tierLabel = hasTieredCounts
    ? `${strongCount} strong · ${relatedCount} related`
    : `${resultCount.toLocaleString()} result${resultCount !== 1 ? 's' : ''}`;
  return (
    <div className="dx-search-header">
      <div className="dx-search-header__brand">
        <img src={WORDMARK_URL} alt="Dexter" className="dx-search-header__wordmark" />
        <div className="dx-search-header__eyebrow">x402 search</div>
      </div>

      <div className="dx-search-header__meta">
        <span className="dx-search-header__count">{tierLabel}</span>
        {rerankApplied && (
          <span
            className="dx-search-header__reranked"
            title="Top results reordered by an LLM cross-encoder pass"
          >
            reranked
          </span>
        )}
        <button
          type="button"
          className="dx-search-header__expand"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? 'minimize' : 'expand'}
        </button>
      </div>
    </div>
  );
}
