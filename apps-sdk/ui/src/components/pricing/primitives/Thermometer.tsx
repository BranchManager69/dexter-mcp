import { useEffect, useState } from 'react';
import type { Tone, CelebrationTier } from './score';

/**
 * Vertical thermometer — bulb at the bottom, tube rising up. Fill is a
 * red→orange→green gradient revealed by an upward-growing rect clipped
 * to the tube+bulb shape.
 *
 * Adapted from x402gle's ai-verdict.tsx, stripped of framer-motion in favor
 * of small RAF loops so the widget bundle stays light. Animations honor
 * prefers-reduced-motion (handled at the CSS level via the standard media
 * query in base.css).
 *
 * Score → fill % is direct (clamped 2–100). The thermometer's job is to make
 * "96 / 100" feel earned, not just stated.
 */

interface Props {
  score: number;
  scoreKnown: boolean;
  tone: Tone;
  celebration: CelebrationTier;
  /** Entrance animations (count-up, fill rise). */
  animate: boolean;
  /** Ambient looping animations (sparks, glow pulse). */
  ambient: boolean;
}

export function Thermometer({ score, scoreKnown, tone, celebration, animate, ambient }: Props) {
  const fillPct = scoreKnown ? Math.max(2, Math.min(100, score)) : 0;
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayScore(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, score]);

  const trackHeight = 88;
  const tubeWidth = 10;
  const bulbR = 9;
  const topPad = 26;
  const tubeTopY = topPad;
  const totalH = topPad + trackHeight + bulbR * 2 + 2;

  const toneClass =
    tone === 'high' ? 'dx-pricing__therm-num--high'
    : tone === 'mid' ? 'dx-pricing__therm-num--mid'
    : tone === 'low' ? 'dx-pricing__therm-num--low'
    : 'dx-pricing__therm-num--unknown';

  return (
    <div className="dx-pricing__therm">
      <div className={`dx-pricing__therm-num ${toneClass}`}>
        {scoreKnown ? displayScore : '—'}
      </div>

      <svg width={28} height={totalH} viewBox={`0 0 28 ${totalH}`} className="dx-pricing__therm-svg">
        <defs>
          <linearGradient id="dx-therm-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dx-success)" />
            <stop offset="42%" stopColor="#f59e0b" />
            <stop offset="78%" stopColor="#ff4d00" />
            <stop offset="100%" stopColor="var(--dx-danger)" />
          </linearGradient>
          <clipPath id="dx-therm-tube-clip">
            <rect
              x={(28 - tubeWidth) / 2}
              y={tubeTopY}
              width={tubeWidth}
              height={trackHeight}
              rx={tubeWidth / 2}
              ry={tubeWidth / 2}
            />
            <circle cx={14} cy={tubeTopY + trackHeight + bulbR - 2} r={bulbR} />
          </clipPath>
        </defs>

        {/* Empty track */}
        <g>
          <rect
            x={(28 - tubeWidth) / 2}
            y={tubeTopY}
            width={tubeWidth}
            height={trackHeight}
            rx={tubeWidth / 2}
            ry={tubeWidth / 2}
            className="dx-pricing__therm-track"
          />
          <circle
            cx={14}
            cy={tubeTopY + trackHeight + bulbR - 2}
            r={bulbR}
            className="dx-pricing__therm-bulb-empty"
          />
        </g>

        {/* Fill */}
        <g clipPath="url(#dx-therm-tube-clip)">
          <rect
            x={0}
            y={tubeTopY + trackHeight}
            width={28}
            height={bulbR * 2 + 4}
            fill="url(#dx-therm-fill)"
            opacity={scoreKnown ? 1 : 0.25}
          />
          <ThermometerFill
            tubeTopY={tubeTopY}
            trackHeight={trackHeight}
            fillPct={fillPct}
            animate={animate}
          />
        </g>

        {/* Tick marks at 25/50/75 */}
        {[25, 50, 75].map((pct) => {
          const y = tubeTopY + trackHeight - (trackHeight * pct) / 100;
          return (
            <line
              key={pct}
              x1={(28 - tubeWidth) / 2 + tubeWidth + 1}
              x2={(28 - tubeWidth) / 2 + tubeWidth + 4}
              y1={y}
              y2={y}
              className="dx-pricing__therm-tick"
            />
          );
        })}

        {/* Celebration overlay */}
        {celebration === 'sparks' && ambient && (
          <CelebrationSparks cx={14} topY={tubeTopY} tubeW={tubeWidth} />
        )}
        {celebration === 'sparks' && !ambient && (
          <circle cx={14} cy={tubeTopY} r={tubeWidth / 2 + 4} fill="#facc15" opacity={0.35} />
        )}
        {celebration === 'glow' && (
          <circle
            cx={14}
            cy={tubeTopY + trackHeight + bulbR - 2}
            r={bulbR + 5}
            fill="var(--dx-success)"
            opacity={ambient ? 0.28 : 0.22}
            style={{ filter: 'blur(1px)' }}
            className={ambient ? 'dx-pricing__therm-glow' : ''}
          />
        )}
      </svg>

      <div className="dx-pricing__therm-cap">/100</div>
    </div>
  );
}

function ThermometerFill({
  tubeTopY,
  trackHeight,
  fillPct,
  animate,
}: {
  tubeTopY: number;
  trackHeight: number;
  fillPct: number;
  animate: boolean;
}) {
  const targetH = (trackHeight * fillPct) / 100;
  const [h, setH] = useState(animate ? 0 : targetH);

  useEffect(() => {
    if (!animate) {
      setH(targetH);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setH(eased * targetH);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const startDelay = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 100);
    return () => {
      clearTimeout(startDelay);
      cancelAnimationFrame(raf);
    };
  }, [animate, targetH]);

  const bulbTop = tubeTopY + trackHeight;
  const y = bulbTop - h;
  return <rect x={0} y={y} width={28} height={h} fill="url(#dx-therm-fill)" />;
}

function CelebrationSparks({ cx, topY, tubeW }: { cx: number; topY: number; tubeW: number }) {
  // Eight embers at fixed offsets, animated via CSS keyframes (defined in
  // x402-pricing.css). Each spark is a circle with a unique --i index that
  // its CSS animation reads to compute delay/hue. Pure CSS — no framer.
  const sparks = [
    { dx: -5, hue: '#fde047' },
    { dx: 2, hue: '#facc15' },
    { dx: -1, hue: '#f97316' },
    { dx: 4, hue: '#fde047' },
    { dx: -3, hue: '#facc15' },
    { dx: 1, hue: '#f97316' },
    { dx: 3, hue: '#fde047' },
    { dx: -2, hue: '#facc15' },
  ];
  return (
    <g aria-hidden>
      <circle
        cx={cx}
        cy={topY}
        r={tubeW / 2 + 6}
        fill="#facc15"
        className="dx-pricing__spark-glow dx-pricing__spark-glow--a"
      />
      <circle
        cx={cx}
        cy={topY}
        r={tubeW / 2 + 3}
        fill="#fb923c"
        className="dx-pricing__spark-glow dx-pricing__spark-glow--b"
      />
      {sparks.map((s, i) => (
        <circle
          key={i}
          cx={cx + s.dx}
          cy={topY}
          r={1.6}
          fill={s.hue}
          className="dx-pricing__spark"
          style={{ animationDelay: `${i * 0.275}s` }}
        />
      ))}
    </g>
  );
}
