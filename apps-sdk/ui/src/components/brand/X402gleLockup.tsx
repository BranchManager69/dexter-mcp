/**
 * The composite "x402gle by Dexter" lockup, ported from the x402gle
 * frontend (src/components/logo.tsx + by-dexter.tsx). Used in the search
 * widget header — search is an x402gle product, not a bare-Dexter one.
 *
 * Rendered as live-styled text with the canonical x402gle multi-color
 * palette (Google's red/yellow/blue/green) plus a small "by [dexter
 * mark + wordmark]" tagline beneath. No external assets except the
 * Dexter glyph and wordmark fetched from dexter.cash.
 *
 * Same color mapping is preserved exactly:
 *   x(blue) 4(red) 0(yellow) 2(blue) g(green) l(red) e(yellow)
 */

const GOOGLE_COLORS = {
  blue: '#4285F4',
  red: '#EA4335',
  yellow: '#FBBC05',
  green: '#34A853',
};

const X402GLE_COLORS: string[] = [
  GOOGLE_COLORS.blue,    // x
  GOOGLE_COLORS.red,     // 4
  GOOGLE_COLORS.yellow,  // 0
  GOOGLE_COLORS.blue,    // 2
  GOOGLE_COLORS.green,   // g
  GOOGLE_COLORS.red,     // l
  GOOGLE_COLORS.yellow,  // e
];

const DEXTER_GLYPH_URL = 'https://dexter.cash/assets/pokedexter/dexter-logo.svg';
const DEXTER_WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';

interface Props {
  /** Wordmark size — 'sm' fits in a header, 'md' is the dashboard pile-up. */
  size?: 'sm' | 'md';
  /** Show the "BETA" pill above the by-Dexter line. */
  showBeta?: boolean;
}

export function X402gleLockup({ size = 'sm', showBeta = false }: Props) {
  const text = 'x402gle';
  return (
    <div className="dx-x402gle-lockup">
      <div className={`dx-x402gle-lockup__wordmark dx-x402gle-lockup__wordmark--${size}`} aria-label="x402gle">
        {text.split('').map((char, i) => (
          <span key={i} style={{ color: X402GLE_COLORS[i] }}>
            {char}
          </span>
        ))}
      </div>
      <div className="dx-x402gle-lockup__by">
        {showBeta && <span className="dx-x402gle-lockup__beta">beta</span>}
        <span className="dx-x402gle-lockup__by-label">by</span>
        <a
          href="https://dexter.cash"
          target="_blank"
          rel="noopener noreferrer"
          className="dx-x402gle-lockup__by-link"
        >
          <img
            src={DEXTER_GLYPH_URL}
            alt=""
            className="dx-x402gle-lockup__dexter-glyph"
            aria-hidden
          />
          <img
            src={DEXTER_WORDMARK_URL}
            alt="Dexter"
            className="dx-x402gle-lockup__dexter-wordmark"
          />
        </a>
      </div>
    </div>
  );
}
