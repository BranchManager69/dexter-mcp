import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/dextercard.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState } from '../components/AppShell';
import { useDisplayMode, useMaxHeight, useOpenAIGlobal, useRequestDisplayMode } from '../sdk';
import { VirtualCard, type CardStage } from '../components/dextercard/VirtualCard';
import type { CardThemeId } from '../components/dextercard/cardThemes';

interface CardStatusPayload {
  stage: CardStage;
  user?: { id: string; email: string };
  card?: {
    cardId?: string;
    status?: string;
    last4?: string;
    expiry?: string;
    [k: string]: unknown;
  } | null;
  onboarding?: unknown;
  wallets?: Array<{ wallet: string; currency?: string; amount?: number; status?: string }>;
  recentTransactions?: Array<{
    id: string;
    amount?: number;
    currency?: string;
    merchant?: string;
    status?: string;
    createdAt?: string;
  }>;
  tip?: string;
}

function StageCopy({ stage }: { stage: CardStage }) {
  const copy: Record<CardStage, string> = {
    no_session: 'Sign in to view your Dextercard.',
    onboarding_required:
      'Identity verification is the next step. Run `card_issue` to start.',
    pending_kyc: 'Identity check is in flight. Re-run `card_status` to refresh.',
    pending_finalize:
      'KYC verified. Provide a residential address to finalize and create your card.',
    not_issued:
      'Onboarding complete. Run `card_issue step="create"` to issue your virtual card.',
    active: 'Card is active. Spend USDC anywhere Mastercard is accepted.',
    frozen: 'Card is frozen. Run `card_freeze frozen=false` to resume spending.',
  };
  return <p className="dxc-meta-copy">{copy[stage]}</p>;
}

function pickTheme(): CardThemeId {
  // Default theme for the MCP widget surface. Branch's preferred orange.
  // (When a Dextercard-branded theme ships, swap here.)
  return 'orange';
}

function CardStatusWidget() {
  const props = useOpenAIGlobal('toolOutput') as CardStatusPayload | null;
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  if (!props) {
    return (
      <AppShell style={style}>
        <Card title="Dextercard" badge={{ label: 'Loading' }}>
          <EmptyState message="Reading card status…" />
        </Card>
      </AppShell>
    );
  }

  const { stage, user, card, wallets, recentTransactions, tip } = props;
  const theme = pickTheme();
  const cardholder = user?.email?.split('@')[0]?.toUpperCase() || 'DEXTER HOLDER';
  const lastFour = card?.last4 ?? 'x402';
  const expiry = card?.expiry ?? '••/••';

  return (
    <AppShell style={style}>
      <Card
        title="Dextercard"
        badge={{ label: stageBadge(stage) }}
        actions={
          canExpand ? (
            <button
              className="dexter-link"
              onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}
            >
              Expand
            </button>
          ) : null
        }
      >
        <VirtualCard
          theme={theme}
          stage={stage}
          cardholderName={cardholder}
          lastFour={lastFour}
          expiry={expiry}
        />

        <div className="dxc-meta">
          <StageCopy stage={stage} />
          {tip ? <p className="dxc-meta-copy">{tip}</p> : null}

          {wallets && wallets.length > 0 ? (
            <div>
              <p className="dxc-section-title">Linked wallets</p>
              <ul className="dxc-list">
                {wallets.map((w, i) => (
                  <li key={`${w.wallet}-${w.currency}-${i}`}>
                    <span>
                      {w.wallet} · {(w.currency || '').toUpperCase()}
                      {typeof w.amount === 'number' ? ` · ${w.amount.toLocaleString()} cap` : ''}
                    </span>
                    <code>{w.status || ''}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : stage === 'active' || stage === 'frozen' ? (
            <p className="dxc-empty">No wallets linked yet. Run `card_link_wallet` to authorize one.</p>
          ) : null}

          {recentTransactions && recentTransactions.length > 0 ? (
            <div>
              <p className="dxc-section-title">Recent transactions</p>
              <ul className="dxc-list">
                {recentTransactions.slice(0, 8).map((tx) => (
                  <li key={tx.id}>
                    <span>
                      {tx.merchant || 'Transaction'}
                      {typeof tx.amount === 'number'
                        ? ` · ${tx.amount.toFixed(2)} ${(tx.currency || '').toUpperCase()}`
                        : ''}
                    </span>
                    <code>{tx.status || formatDate(tx.createdAt)}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Card>
    </AppShell>
  );
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

function formatDate(s?: string): string {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return s;
  }
}

const root = document.getElementById('card-status-root');
if (root) {
  createRoot(root).render(<CardStatusWidget />);
}

export default CardStatusWidget;
