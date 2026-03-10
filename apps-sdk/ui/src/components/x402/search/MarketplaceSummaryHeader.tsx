import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';

const WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';
const LOGO_MARK_URL = 'https://dexter.cash/assets/pokedexter/dexter-logo.svg';

export function MarketplaceSummaryHeader({
  query,
  resultCount,
  verifiedCount,
  avgQuality,
  isFullscreen,
  onToggleFullscreen,
}: {
  query?: string;
  resultCount: number;
  verifiedCount: number;
  avgQuality: number | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const querySummary = query?.trim()
    ? `Dexter surfaced paid APIs related to "${query.trim()}".`
    : 'Dexter surfaced paid APIs from across the x402 market.';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[rgba(255,107,0,0.18)] px-4 py-4 sm:px-5"
      style={{
        background:
          'linear-gradient(145deg, rgba(255,107,0,0.12) 0%, rgba(255,107,0,0.05) 28%, rgba(255,255,255,0.02) 58%, rgba(0,0,0,0) 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,107,0,0.45) 18%, rgba(255,107,0,0.08) 82%, transparent 100%)' }}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <img src={LOGO_MARK_URL} alt="Dexter logo" width={26} height={26} style={{ width: 26, height: 26, flexShrink: 0 }} />
              <img src={WORDMARK_URL} alt="Dexter" height={22} style={{ height: 22, width: 'auto', opacity: 0.95 }} />
              <span className="text-[10px] uppercase tracking-[0.22em] text-tertiary">Market Board</span>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Search Brief</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-primary sm:text-lg">
                  {query?.trim() ? `You searched for ${query.trim()}` : 'Curated x402 discovery'}
                </span>
                {query?.trim() && <Badge variant="outline" size="sm">Marketplace rank</Badge>}
              </div>
              <p className="text-sm leading-6 text-secondary max-w-3xl">{querySummary}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start">
            <Badge variant="outline" size="sm">Dexter curated</Badge>
            <Button variant="soft" color="secondary" size="sm" onClick={onToggleFullscreen}>
              {isFullscreen ? 'Minimize' : 'Expand'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="rounded-2xl border border-subtle bg-[rgba(255,255,255,0.04)] px-3.5 py-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold tracking-tight text-primary">{resultCount}</span>
              <span className="pb-1 text-sm text-secondary">candidate{resultCount !== 1 ? 's' : ''}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-tertiary">
              Ranked for usefulness, trust signals, and marketplace traction.
            </p>
          </div>

          <div className="flex flex-wrap items-stretch gap-2">
            <div className="min-w-[120px] flex-1 rounded-2xl border border-subtle bg-surface px-3 py-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Verified</span>
              <div className="mt-1 text-lg font-semibold text-primary">{verifiedCount}</div>
            </div>
            <div className="min-w-[120px] flex-1 rounded-2xl border border-subtle bg-surface px-3 py-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Avg Quality</span>
              <div className="mt-1 text-lg font-semibold text-primary">{avgQuality ?? 'n/a'}</div>
            </div>
            <div className="min-w-[120px] flex-1 rounded-2xl border border-subtle bg-surface px-3 py-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Mode</span>
              <div className="mt-1 text-lg font-semibold text-primary">Inspect + pay</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
