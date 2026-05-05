import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Search } from '@openai/apps-sdk-ui/components/Icon';

const WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';

export function MarketplaceSummaryHeader({
  queryValue,
  onQueryChange,
  onSearchSubmit,
  resultCount,
  strongCount,
  relatedCount,
  rerankApplied = false,
  isSearching,
  isFullscreen,
  onToggleFullscreen,
}: {
  queryValue: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  resultCount: number;
  strongCount?: number;
  relatedCount?: number;
  rerankApplied?: boolean;
  isSearching: boolean;
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

      <div className="dx-search-header__input">
        <Search />
        <input
          value={queryValue}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSearchSubmit();
            }
          }}
          placeholder="Search paid APIs"
          className="dx-search-header__input-field"
        />
        <Button color="primary" size="sm" onClick={onSearchSubmit} disabled={isSearching}>
          {isSearching ? 'Searching…' : 'Search'}
        </Button>
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
