import type { Tone } from './score';

interface Props {
  letter: string;
  tone: Tone;
  /** Entrance animation (scale + rotate-in). */
  animate: boolean;
}

/**
 * A/B/C/D/F notary-style stamp. 32-tick perforated outer ring + double border,
 * letter centered, slight rotation, tone-colored.
 *
 * Same letter system used by x402gle and the OG share image so all three
 * visual surfaces agree.
 */
export function Stamp({ letter, tone, animate }: Props) {
  const ticks = 32;
  const toneClass =
    tone === 'high' ? 'dx-pricing__stamp--high'
    : tone === 'mid' ? 'dx-pricing__stamp--mid'
    : tone === 'low' ? 'dx-pricing__stamp--low'
    : 'dx-pricing__stamp--unknown';

  return (
    <div
      className={`dx-pricing__stamp ${toneClass} ${animate ? 'dx-pricing__stamp--animate' : ''}`}
      aria-label={`Grade ${letter}`}
    >
      <svg viewBox="0 0 100 100" className="dx-pricing__stamp-svg" aria-hidden>
        {Array.from({ length: ticks }).map((_, i) => {
          const angle = (i / ticks) * Math.PI * 2;
          const x1 = 50 + Math.cos(angle) * 47;
          const y1 = 50 + Math.sin(angle) * 47;
          const x2 = 50 + Math.cos(angle) * 43;
          const y2 = 50 + Math.sin(angle) * 43;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              opacity={0.85}
            />
          );
        })}
        <circle cx={50} cy={50} r={40} fill="none" stroke="currentColor" strokeWidth={2.5} opacity={0.9} />
        <circle cx={50} cy={50} r={34} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.55} />
      </svg>
      <span className="dx-pricing__stamp-letter">{letter}</span>
    </div>
  );
}
