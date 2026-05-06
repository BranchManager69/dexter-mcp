import { useEffect, useState } from 'react';

const DEFAULT_LOGO_URL = 'https://dexter.cash/assets/pokedexter/dexter-logo.svg';

export type LoadingStage = {
  /** Seconds threshold under which this stage is current. Stages are
   *  evaluated in order — first match wins. */
  upTo: number;
  heading: string;
  supporting: string;
};

interface Props {
  /** Eyebrow line above the heading (e.g. "DEXTER · MARKET BOARD"). */
  eyebrow: string;
  /** Stage timeline. The last stage's `upTo` should be Infinity to catch
   *  long tails. Copy escalates as elapsed time crosses each threshold. */
  stages: LoadingStage[];
  /** Optional one-line context shown in a quiet pill below the copy
   *  (e.g. the user's query or a short status hint). */
  context?: string | null;
  /** Label to the left of the context value (e.g. "query"). */
  contextLabel?: string;
  /** Override the rotating logo mark. Defaults to the Dexter glyph; the
   *  search widget passes the x402gle "X with Dexter face" mark since
   *  search is an x402gle product. */
  logoSrc?: string;
  /** Alt text for the logo image. Aria-hidden when omitted. */
  logoAlt?: string;
}

/**
 * Shared loading visual: rotating Dexter logo mark, twin pulsing rings,
 * orbiting accent tick, eyebrow + escalating heading/supporting copy,
 * and an optional context pill.
 *
 * Used by:
 *   - x402_search marketplace loader ("DEXTER · MARKET BOARD")
 *   - dexter_passkey onboarding ("DEXTER · PASSKEY WALLET")
 *   - any future Dexter-branded long-loading state
 *
 * Visual rules live in styles/components/dexter-loading.css.
 */
export function DexterLoading({
  eyebrow,
  stages,
  context,
  contextLabel = 'context',
  logoSrc = DEFAULT_LOGO_URL,
  logoAlt = '',
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const current = stages.find((s) => elapsed < s.upTo) ?? stages[stages.length - 1];

  return (
    <div className="dx-loading">
      <div className="dx-loading__stage">
        <div className="dx-loading__ring dx-loading__ring--outer" aria-hidden />
        <div className="dx-loading__ring dx-loading__ring--mid" aria-hidden />
        <div className="dx-loading__logo">
          <img
            src={logoSrc}
            alt={logoAlt}
            width={120}
            height={120}
            aria-hidden={logoAlt ? undefined : true}
          />
        </div>
        <div className="dx-loading__orbit" aria-hidden>
          <span className="dx-loading__orbit-tick" />
        </div>
      </div>

      <div className="dx-loading__copy">
        <div className="dx-loading__eyebrow">{eyebrow}</div>
        <h2 className="dx-loading__heading">{current.heading}</h2>
        <p className="dx-loading__supporting">{current.supporting}</p>
        {context && (
          <p className="dx-loading__context">
            <span className="dx-loading__context-label">{contextLabel}</span>
            <span className="dx-loading__context-value">"{context}"</span>
          </p>
        )}
      </div>
    </div>
  );
}
