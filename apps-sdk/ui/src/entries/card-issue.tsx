import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/dextercard.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState } from '../components/AppShell';
import { useOpenAIGlobal } from '../sdk';
import { VirtualCard, type CardStage } from '../components/dextercard/VirtualCard';

interface CardIssuePayload {
  stage: CardStage;
  nextAction?: string;
  required?: string[];
  // Stage-specific payloads — only one will be present per call
  onboardingStart?: { kycUrl?: string; status?: string; [k: string]: unknown };
  onboardingCheck?: {
    status?: string;
    terms?: { termsAndConditions: string; privacyPolicy: string; eSignConsentDisclosure?: string };
    [k: string]: unknown;
  };
  onboardingFinish?: unknown;
  card?: { cardId?: string; status?: string; last4?: string; expiry?: string; [k: string]: unknown };
  reveal?: { url: string; expiresAt?: string };
  tip?: string;
}

function CardIssueWidget() {
  const props = useOpenAIGlobal('toolOutput') as CardIssuePayload | null;

  if (!props) {
    return (
      <AppShell>
        <Card title="Dextercard Issuance" badge={{ label: 'Loading' }}>
          <EmptyState message="Working on card issuance…" />
        </Card>
      </AppShell>
    );
  }

  const { stage, nextAction, required, onboardingStart, onboardingCheck, card, reveal, tip } = props;

  return (
    <AppShell>
      <Card title="Dextercard Issuance" badge={{ label: stageBadge(stage) }}>
        <VirtualCard
          theme="orange"
          stage={stage}
          lastFour={card?.last4 ?? 'x402'}
          expiry={card?.expiry ?? '••/••'}
        />

        <div className="dxc-meta">
          <StageBody
            stage={stage}
            onboardingStart={onboardingStart}
            onboardingCheck={onboardingCheck}
            reveal={reveal}
            required={required}
            tip={tip}
          />

          {nextAction ? (
            <span className="dxc-next-action">
              Next: {humanizeAction(nextAction)}
            </span>
          ) : null}
        </div>
      </Card>
    </AppShell>
  );
}

function StageBody(props: {
  stage: CardStage;
  onboardingStart?: CardIssuePayload['onboardingStart'];
  onboardingCheck?: CardIssuePayload['onboardingCheck'];
  reveal?: CardIssuePayload['reveal'];
  required?: string[];
  tip?: string;
}) {
  const { stage, onboardingStart, onboardingCheck, reveal, required, tip } = props;

  if (stage === 'no_session') {
    return <p className="dxc-meta-copy">{tip || 'Sign in to issue a Dextercard.'}</p>;
  }

  if (stage === 'onboarding_required') {
    return (
      <>
        <p className="dxc-meta-copy">
          A regulated card issuer needs identity verification before issuing your card. Provide
          the fields below and the agent will start onboarding.
        </p>
        {required && required.length > 0 ? (
          <div className="dxc-fields">
            {required.map((f) => (
              <div className="dxc-field-row" key={f}>
                <span>{humanizeField(f)}</span>
                <span>—</span>
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  if (stage === 'pending_kyc') {
    return (
      <>
        <p className="dxc-meta-copy">
          Complete identity verification in the link below. Once you finish, the agent can poll
          status with `card_issue step="check"`.
        </p>
        {onboardingStart?.kycUrl ? (
          <span className="dxc-next-action">
            <a
              href={onboardingStart.kycUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              Open identity verification ↗
            </a>
          </span>
        ) : null}
      </>
    );
  }

  if (stage === 'pending_finalize') {
    return (
      <>
        <p className="dxc-meta-copy">
          Identity verified. Provide a residential address and accept the issuer's terms to
          finalize. The agent will run `card_issue step="finish"` once you've gathered them.
        </p>
        {onboardingCheck?.terms ? (
          <ul className="dxc-list">
            <li>
              <span>Terms and Conditions</span>
              <code>
                <a href={onboardingCheck.terms.termsAndConditions} target="_blank" rel="noreferrer">
                  open
                </a>
              </code>
            </li>
            <li>
              <span>Privacy Policy</span>
              <code>
                <a href={onboardingCheck.terms.privacyPolicy} target="_blank" rel="noreferrer">
                  open
                </a>
              </code>
            </li>
            {onboardingCheck.terms.eSignConsentDisclosure ? (
              <li>
                <span>E-Sign Consent (US)</span>
                <code>
                  <a
                    href={onboardingCheck.terms.eSignConsentDisclosure}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open
                  </a>
                </code>
              </li>
            ) : null}
          </ul>
        ) : null}
      </>
    );
  }

  if (stage === 'not_issued') {
    return (
      <p className="dxc-meta-copy">
        Onboarding complete. Run `card_issue step="create"` to issue your virtual Mastercard.
      </p>
    );
  }

  if (stage === 'active' && reveal?.url) {
    return (
      <>
        <p className="dxc-meta-copy">
          Card issued. Use the single-use reveal link to view your PAN, CVV, and expiry. The link
          expires after one view.
        </p>
        <span className="dxc-next-action">
          <a
            href={reveal.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            Reveal card details ↗
          </a>
        </span>
      </>
    );
  }

  if (stage === 'active') {
    return (
      <p className="dxc-meta-copy">
        Card is active. Run `card_link_wallet` to authorize a wallet to fund transactions.
      </p>
    );
  }

  if (stage === 'frozen') {
    return (
      <p className="dxc-meta-copy">
        Card is frozen. Run `card_freeze frozen=false` to resume spending.
      </p>
    );
  }

  return null;
}

function stageBadge(stage: CardStage): string {
  switch (stage) {
    case 'active': return 'Active';
    case 'frozen': return 'Frozen';
    case 'pending_kyc': return 'KYC in flight';
    case 'pending_finalize': return 'Awaiting address';
    case 'onboarding_required': return 'Not onboarded';
    case 'not_issued': return 'Ready to issue';
    case 'no_session': return 'Sign in';
    default: return 'Unknown';
  }
}

function humanizeField(f: string): string {
  // PascalCase → spaced
  return f
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function humanizeAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\bcollect identity\b/i, 'collect identity')
    .replace(/\bcall card status\b/i, 'call card_status')
    .replace(/\bcall card issue\b/i, 'call card_issue')
    .replace(/\bsend user to kyc url\b/i, 'open KYC URL');
}

const root = document.getElementById('card-issue-root');
if (root) {
  createRoot(root).render(<CardIssueWidget />);
}

export default CardIssueWidget;
