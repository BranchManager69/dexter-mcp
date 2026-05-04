import type { PropsWithChildren } from 'react';
import type { Tone } from './score';

interface Props {
  /** `prescription` is the Doctor Dexter variant; otherwise tone-colored. */
  tone: Tone | 'prescription';
  className?: string;
}

/**
 * Tone-aware bubble with a triangular tail on the left edge, sized to attach
 * visually to a 56px avatar. Pure CSS/SVG — no framer.
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
      <svg aria-hidden viewBox="0 0 16 24" className="dx-pricing__bubble-tail">
        <path d="M 16 0 L 0 12 L 16 24 Z" fill="none" strokeWidth={1.5} stroke="currentColor" className="dx-pricing__bubble-tail-stroke" />
        <path d="M 17.5 1.5 L 1.5 12 L 17.5 22.5 Z" fill="currentColor" className="dx-pricing__bubble-tail-fill" />
      </svg>
      {children}
    </div>
  );
}
