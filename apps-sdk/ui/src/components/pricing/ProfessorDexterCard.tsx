import { useEffect, useState } from 'react';
import { DexterAvatar } from './primitives/DexterAvatar';
import { Thermometer } from './primitives/Thermometer';
import { Stamp } from './primitives/Stamp';
import { SpeechBubble } from './primitives/SpeechBubble';
import { scoreToTone, scoreToLetter, scoreToCelebration } from './primitives/score';
import type { HistoryRow } from './types';
import { formatRelative } from './types';

interface Props {
  /** Most recent passed run; falls back to most recent if none passed. */
  run: HistoryRow | null;
  /** Aggregate signal for the supporting line: e.g. "5 of 6 recent runs passed". */
  passesOfRecent: { passes: number; total: number } | null;
  /** Cached replays skip entrance animation; live first-render plays it. */
  animate: boolean;
}

/**
 * The verdict moment.
 *
 * Avatar + thermometer on the left rail; speech bubble on the right with the
 * grade stamp in the bubble header and the AI's prose verdict (`ai_notes`)
 * as the bubble body. Footer is magic-toned — "evaluated by Dexter ·
 * 38m ago" — never references the underlying paid mechanic.
 */
export function ProfessorDexterCard({ run, passesOfRecent, animate }: Props) {
  if (!run) return null;
  const score = typeof run.ai_score === 'number' ? run.ai_score : 0;
  const scoreKnown = typeof run.ai_score === 'number';
  const tone = scoreToTone(run.ai_score);
  const letter = scoreToLetter(run.ai_score);
  const celebration = scoreToCelebration(run.ai_score);
  const receivedAt = run.completed_at ? Date.parse(run.completed_at) : Date.parse(run.attempted_at);

  return (
    <div className={`dx-pricing__verdict ${animate ? 'dx-pricing__verdict--animate' : ''}`}>
      <div className="dx-pricing__verdict-rail">
        <DexterAvatar role="professor" tone={tone} />
        <Thermometer
          score={score}
          scoreKnown={scoreKnown}
          tone={tone}
          celebration={celebration}
          animate={animate}
          ambient
        />
      </div>
      <SpeechBubble tone={tone} className="dx-pricing__verdict-bubble">
        <div className="dx-pricing__verdict-bubble-header">
          <div className="dx-pricing__verdict-bubble-eyebrow">
            <span className="dx-pricing__verdict-bubble-name">Professor Dexter</span>
            <span className="dx-pricing__verdict-bubble-action">grades it</span>
          </div>
          <Stamp letter={letter} tone={tone} animate={animate} />
        </div>
        {run.ai_notes ? (
          <ProseReveal text={run.ai_notes} animate={animate} />
        ) : (
          <p className="dx-pricing__verdict-bubble-empty">No notes returned.</p>
        )}
        <Footer
          receivedAt={Number.isFinite(receivedAt) ? receivedAt : null}
          passesOfRecent={passesOfRecent}
        />
      </SpeechBubble>
    </div>
  );
}

/** Word-by-word reveal on live runs; instant on cached. Pure CSS — each word
 *  span gets an animation-delay computed from its index. */
function ProseReveal({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) {
    return <p className="dx-pricing__verdict-prose">{text}</p>;
  }
  const tokens = text.split(/(\s+)/);
  let visibleIdx = 0;
  // Cap total reveal time at ~1.4s.
  const visibleCount = tokens.filter((t) => t.trim().length > 0).length;
  const perWord = Math.min(0.04, 1.4 / Math.max(1, visibleCount));
  return (
    <p className="dx-pricing__verdict-prose dx-pricing__verdict-prose--reveal" aria-label={text}>
      <span aria-hidden>
        {tokens.map((tok, i) => {
          if (!tok.trim().length) return <span key={i}>{tok}</span>;
          const idx = visibleIdx++;
          return (
            <span
              key={i}
              className="dx-pricing__verdict-word"
              style={{ animationDelay: `${0.4 + idx * perWord}s` }}
            >
              {tok}
            </span>
          );
        })}
      </span>
    </p>
  );
}

function Footer({
  receivedAt,
  passesOfRecent,
}: {
  receivedAt: number | null;
  passesOfRecent: { passes: number; total: number } | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const parts: string[] = [];
  parts.push('evaluated by Dexter');
  if (receivedAt) parts.push(formatRelative(now - receivedAt));
  if (passesOfRecent && passesOfRecent.total > 1) {
    parts.push(`${passesOfRecent.passes} of ${passesOfRecent.total} recent runs passed`);
  }
  const absolute = receivedAt
    ? new Date(receivedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : undefined;

  return (
    <div className="dx-pricing__verdict-footer">
      {parts.map((p, i) => (
        <span key={i} title={i === 1 && absolute ? absolute : undefined}>
          {p}
          {i < parts.length - 1 ? <span className="dx-pricing__verdict-footer-sep"> · </span> : null}
        </span>
      ))}
    </div>
  );
}
