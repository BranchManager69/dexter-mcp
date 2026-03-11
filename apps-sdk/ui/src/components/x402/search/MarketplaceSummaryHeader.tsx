import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Search } from '@openai/apps-sdk-ui/components/Icon';

const WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';

export function MarketplaceSummaryHeader({
  queryValue,
  onQueryChange,
  onSearchSubmit,
  resultCount,
  isSearching,
  isFullscreen,
  onToggleFullscreen,
}: {
  queryValue: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  resultCount: number;
  isSearching: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[24px] border border-[rgba(255,107,0,0.16)] px-4 py-4 sm:px-5"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,107,0,0.09) 0%, rgba(255,107,0,0.03) 22%, rgba(255,255,255,0.01) 58%, rgba(0,0,0,0) 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-10 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,107,0,0.28) 36%, rgba(255,107,0,0.06) 64%, transparent 100%)' }}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 text-center">
          <img src={WORDMARK_URL} alt="Dexter" height={20} style={{ height: 20, width: 'auto', opacity: 0.95 }} />
          <div className="text-[10px] uppercase tracking-[0.28em] text-tertiary">X402 Search</div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-stretch gap-2 rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.02)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-transparent px-2.5">
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
                  placeholder="Search paid APIs..."
                  className="w-full border-0 bg-transparent py-2 text-sm text-primary outline-none placeholder:text-tertiary"
                />
              </div>
              <Button color="primary" size="sm" onClick={onSearchSubmit} disabled={isSearching}>
                {isSearching ? 'Searching…' : 'Search'}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] text-tertiary">
              {resultCount.toLocaleString()} result{resultCount !== 1 ? 's' : ''}
            </span>
            <Button variant="soft" color="secondary" size="sm" onClick={onToggleFullscreen}>
              {isFullscreen ? 'Minimize' : 'Expand'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
