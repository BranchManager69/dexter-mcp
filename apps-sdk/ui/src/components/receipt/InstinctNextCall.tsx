/**
 * InstinctNextCall — the "what to call next" recommendation surfaced after
 * a successful paid call. The replacement for SponsoredCard.
 *
 * Framed as Instinct's hint to the agent, not as an ad slot. Subtle
 * Dexter-orange accent ties it to the rest of the receipt frame; paper-
 * grain background continues the receipt aesthetic.
 *
 * The CTA URL stays as the destination — like the receipt stamp, the
 * value is in the action, not in showing the user the URL string.
 */

import { useEffect, useState } from 'react';
import type { ReceiptRecommendation } from './types';

interface Props {
  recommendation: ReceiptRecommendation;
  onAct?: (url: string, method: string) => void;
}

function shortenUrl(url: string, max = 56): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname === '/' ? '' : u.pathname;
    const combined = host + path;
    if (combined.length <= max) return combined;
    return combined.slice(0, max - 1) + '…';
  } catch {
    return url.length > max ? url.slice(0, max - 1) + '…' : url;
  }
}

export function InstinctNextCall({ recommendation, onAct }: Props) {
  const [visible, setVisible] = useState(false);

  // Slight delay so the card lands after the rest of the receipt has
  // finished its entry animation.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 220);
    return () => clearTimeout(t);
  }, []);

  const method = (recommendation.method || 'GET').toUpperCase();
  const display = shortenUrl(recommendation.resourceUrl);

  return (
    <aside
      className={`dx-instinct-next ${visible ? 'is-visible' : ''}`}
      aria-label="Instinct recommends a next call"
    >
      <span className="dx-instinct-next__eyebrow">Instinct · next call</span>

      <div className="dx-instinct-next__body">
        <h3 className="dx-instinct-next__sponsor">{recommendation.sponsor}</h3>
        <p className="dx-instinct-next__description">{recommendation.description}</p>
        <div className="dx-instinct-next__address" title={recommendation.resourceUrl}>
          <span className="dx-instinct-next__method">{method}</span>
          <span className="dx-instinct-next__url">{display}</span>
        </div>
      </div>

      {onAct && (
        <button
          type="button"
          className="dx-instinct-next__cta"
          onClick={() => onAct(recommendation.resourceUrl, method)}
        >
          Try this <span aria-hidden>→</span>
        </button>
      )}

      <div className="dx-instinct-next__attribution">
        Matched by capability, not by bid.
      </div>
    </aside>
  );
}
