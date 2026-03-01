function getTone(score: number | null): 'high' | 'mid' | 'low' | 'na' {
  if (score === null || Number.isNaN(score)) return 'na';
  if (score >= 85) return 'high';
  if (score >= 65) return 'mid';
  return 'low';
}

export function QualityBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const tone = getTone(score);
  return (
    <span className={`x4-quality x4-quality--${tone}`}>
      Quality {score}
    </span>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span className={verified ? 'x4-verified' : 'x4-unverified'}>
      {verified ? '✓ Verified' : '○ Unverified'}
    </span>
  );
}
