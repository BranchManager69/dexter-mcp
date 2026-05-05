import type { PropsWithChildren } from 'react';
import type { Tone } from './score';

interface Props {
  /** `prescription` is the Doctor Dexter variant; otherwise tone-colored. */
  tone: Tone | 'prescription';
  className?: string;
}

/**
 * Tone-aware bubble. Background is ruled-paper (notepad-style) via two
 * layered linear gradients in CSS — a horizontal rule every 24px and a
 * tone-tinted vertical margin rule near the right edge.
 *
 * Tail is a CSS-only triangle pair (border-trick) styled via `::before`
 * and `::after` on the `.dx-pricing__bubble-tail` element. Sharper and
 * less janky than the previous SVG approach, and aligns to the bubble
 * border without cross-browser pixel drift.
 */
export function SpeechBubble({ tone, className, children }: PropsWithChildren<Props>) {
  const variantClass =
    tone === 'high' ? 'dx-pricing__bubble--high'
    : tone === 'mid' ? 'dx-pricing__bubble--mid'
    : tone === 'low' ? 'dx-pricing__bubble--low'
    : tone === 'prescription' ? 'dx-pricing__bubble--prescription'
    : 'dx-pricing__bubble--unknown';

  return (
    <div className={`dx-pricing__bubble ${variantClass} ${className ?? ''}`}>
      <span aria-hidden className="dx-pricing__bubble-tail" />
      {children}
    </div>
  );
}
