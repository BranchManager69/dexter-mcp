import type { Tone } from './score';

const LOGO_URL = 'https://dexter.cash/assets/pokedexter/dexter-logo.svg';

interface Props {
  role: 'professor' | 'doctor';
  tone: Tone | 'prescription';
}

/**
 * Avatar with role-badge overlay (mortarboard for Professor, stethoscope for
 * Doctor). Tone-tinted ring. The widget bundle can't pull from Next.js
 * Image, so we use a plain `<img>` against the public Dexter CDN.
 */
export function DexterAvatar({ role, tone }: Props) {
  const ringClass =
    tone === 'high' ? 'dx-pricing__avatar--high'
    : tone === 'mid' ? 'dx-pricing__avatar--mid'
    : tone === 'low' ? 'dx-pricing__avatar--low'
    : tone === 'prescription' ? 'dx-pricing__avatar--prescription'
    : 'dx-pricing__avatar--unknown';

  return (
    <div className={`dx-pricing__avatar ${ringClass}`}>
      <img
        src={LOGO_URL}
        alt=""
        width={36}
        height={36}
        className="dx-pricing__avatar-img"
        aria-hidden
      />
      <span className="dx-pricing__avatar-badge" aria-hidden>
        {role === 'professor' ? <MortarboardIcon /> : <StethoscopeIcon />}
      </span>
    </div>
  );
}

function MortarboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="dx-pricing__avatar-badge-icon" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10 12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c3 2 9 2 12 0v-5" />
      <path d="M22 10v6" />
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="dx-pricing__avatar-badge-icon" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v3a3 3 0 0 0 6 0v-1" />
      <circle cx={20} cy={10} r={2} />
    </svg>
  );
}
