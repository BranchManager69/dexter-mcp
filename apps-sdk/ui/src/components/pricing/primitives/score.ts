/**
 * Score → tone / letter / celebration tier.
 *
 * Canonical bands shared with x402gle's ai-verdict.tsx so the OG share image,
 * the test theater, and the pricing widget all agree on what a score means.
 */

export type Tone = 'high' | 'mid' | 'low' | 'unknown';

export function scoreToTone(score: number | null | undefined): Tone {
  if (typeof score !== 'number') return 'unknown';
  if (score >= 75) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

export function scoreToLetter(score: number | null | undefined): string {
  if (typeof score !== 'number') return '?';
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export type CelebrationTier = 'sparks' | 'glow' | 'none';

export function scoreToCelebration(score: number | null | undefined): CelebrationTier {
  if (typeof score !== 'number') return 'none';
  if (score >= 90) return 'sparks';
  if (score >= 75) return 'glow';
  return 'none';
}

export function toneColorVar(tone: Tone): string {
  if (tone === 'high') return 'var(--dx-success)';
  if (tone === 'mid') return 'var(--dx-warn)';
  if (tone === 'low') return 'var(--dx-danger)';
  return 'var(--dx-fg-quiet)';
}
