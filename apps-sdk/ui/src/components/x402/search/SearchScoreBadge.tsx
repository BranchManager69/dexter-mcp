import { scoreTone } from './utils';

function toneClasses(tone: ReturnType<typeof scoreTone>) {
  if (tone === 'good') {
    return 'border-emerald-500/28 bg-emerald-500/10 text-emerald-300 shadow-[0_6px_18px_rgba(16,185,129,0.14)]';
  }
  if (tone === 'warn') {
    return 'border-amber-500/28 bg-amber-500/10 text-amber-300 shadow-[0_6px_18px_rgba(245,158,11,0.12)]';
  }
  if (tone === 'low') {
    return 'border-rose-500/28 bg-rose-500/10 text-rose-300 shadow-[0_6px_18px_rgba(244,63,94,0.12)]';
  }
  return 'border-subtle bg-surface-secondary text-tertiary';
}

export function SearchScoreBadge({
  score,
  variant = 'card',
}: {
  score: number | null | undefined;
  variant?: 'card' | 'detail';
}) {
  const tone = scoreTone(score);
  const sizeClasses = variant === 'detail'
    ? 'min-h-[52px] min-w-[52px] text-xl rounded-[18px]'
    : 'min-h-[40px] min-w-[40px] text-base rounded-[14px]';

  return (
    <div
      className={`inline-flex items-center justify-center border px-2.5 py-2 font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${sizeClasses} ${toneClasses(tone)}`}
      title={score != null ? `AI verification score ${score}` : 'No AI verification score yet'}
    >
      {score != null && score > 0 ? score : '—'}
    </div>
  );
}
