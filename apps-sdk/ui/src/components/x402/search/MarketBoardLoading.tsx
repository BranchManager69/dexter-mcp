import { DexterLoading } from '../../loading/DexterLoading';

/**
 * The "Dexter is surveying the market" loading state. Now a thin wrapper
 * around the shared DexterLoading primitive — same visual identity is used
 * by the passkey-onboard widget and any future Dexter long-load state.
 */
export function MarketBoardLoading({ query }: { query?: string }) {
  return (
    <DexterLoading
      eyebrow="x402gle · MARKET BOARD"
      logoSrc="https://x402gle.com/x-final-transparent.png"
      logoAlt="x402gle"
      stages={[
        {
          upTo: 4,
          heading: 'Surveying the market…',
          supporting: 'Ranking paid APIs, trust signals, and recent verifier passes.',
        },
        {
          upTo: 9,
          heading: 'Cross-referencing verifier history…',
          supporting: 'Pulling AI grades, payment routes, and seller reputation per match.',
        },
        {
          upTo: 16,
          heading: 'Re-ranking strong matches…',
          supporting: 'Cross-encoder is reordering the top candidates.',
        },
        {
          upTo: Infinity,
          heading: 'Still in flight — long-tail catalog is slow tonight.',
          supporting: 'The capability index is still working through this query. Holding.',
        },
      ]}
      context={query || null}
      contextLabel="query"
    />
  );
}
