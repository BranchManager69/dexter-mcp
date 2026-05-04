import { useState } from 'react';
import { DexterAvatar } from './primitives/DexterAvatar';
import { SpeechBubble } from './primitives/SpeechBubble';

interface Props {
  fixText: string;
  animate: boolean;
}

/** Doctor Dexter — appears only when there's a fix to prescribe. Stethoscope
 *  avatar, prescription-toned bubble, copy-to-clipboard. */
export function DoctorDexterCard({ fixText, animate }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(fixText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* best-effort */
    }
  };

  return (
    <div className={`dx-pricing__doctor ${animate ? 'dx-pricing__doctor--animate' : ''}`}>
      <div className="dx-pricing__verdict-rail">
        <DexterAvatar role="doctor" tone="prescription" />
        <div className="dx-pricing__doctor-rail-cap">prescription</div>
      </div>
      <SpeechBubble tone="prescription" className="dx-pricing__verdict-bubble">
        <div className="dx-pricing__verdict-bubble-header">
          <div className="dx-pricing__verdict-bubble-eyebrow">
            <span className="dx-pricing__verdict-bubble-name">Doctor Dexter</span>
            <span className="dx-pricing__verdict-bubble-action">prescribes</span>
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="dx-pricing__doctor-copy"
            aria-label={copied ? 'Fix instructions copied' : 'Copy fix instructions'}
            aria-live="polite"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="dx-pricing__doctor-text">{fixText}</p>
      </SpeechBubble>
    </div>
  );
}
