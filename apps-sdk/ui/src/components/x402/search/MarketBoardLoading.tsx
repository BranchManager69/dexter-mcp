import { useEffect, useState } from 'react';

const LOGO_URL = 'https://dexter.cash/assets/pokedexter/dexter-logo.svg';

/**
 * The "Dexter is surveying the market" loading state. Replaces the stock
 * EmptyMessage component with something that actually has Dexter's
 * identity — the logo mark slowly rotating, twin orange rings pulsing
 * around it, copy that escalates as time passes.
 *
 * Mobile-first: scales down to a 96px logo and stacks vertically. Desktop
 * gets the full 140px treatment with extra ambient glow.
 */
export function MarketBoardLoading({ query }: { query?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Copy escalation: feels like Dexter is genuinely working, not stalled.
  const stage = elapsed < 4
    ? 'Surveying the market…'
    : elapsed < 9
      ? 'Cross-referencing verifier history…'
      : elapsed < 16
        ? 'Re-ranking strong matches…'
        : 'Still in flight — long-tail catalog is slow tonight.';

  const supporting = elapsed < 4
    ? 'Ranking paid APIs, trust signals, and recent verifier passes.'
    : elapsed < 9
      ? 'Pulling AI grades, payment routes, and seller reputation per match.'
      : elapsed < 16
        ? 'Cross-encoder is reordering the top candidates.'
        : 'The capability index is still working through this query. Holding.';

  return (
    <div className="dx-search-loading">
      <div className="dx-search-loading__stage">
        {/* Outer pulsing ring */}
        <div className="dx-search-loading__ring dx-search-loading__ring--outer" aria-hidden />
        {/* Mid pulsing ring */}
        <div className="dx-search-loading__ring dx-search-loading__ring--mid" aria-hidden />
        {/* Logo, slow rotation */}
        <div className="dx-search-loading__logo">
          <img src={LOGO_URL} alt="" width={120} height={120} aria-hidden />
        </div>
        {/* Orbiting tick — gives a sense of motion that doesn't distract */}
        <div className="dx-search-loading__orbit" aria-hidden>
          <span className="dx-search-loading__orbit-tick" />
        </div>
      </div>

      <div className="dx-search-loading__copy">
        <div className="dx-search-loading__eyebrow">DEXTER · MARKET BOARD</div>
        <h2 className="dx-search-loading__heading">{stage}</h2>
        <p className="dx-search-loading__supporting">{supporting}</p>
        {query && (
          <p className="dx-search-loading__query">
            <span className="dx-search-loading__query-label">query</span>
            <span className="dx-search-loading__query-value">"{query}"</span>
          </p>
        )}
      </div>
    </div>
  );
}
