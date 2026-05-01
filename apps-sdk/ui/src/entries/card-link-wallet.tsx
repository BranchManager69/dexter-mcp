import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/dextercard.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState } from '../components/AppShell';
import { useOpenAIGlobal } from '../sdk';
import { VirtualCard } from '../components/dextercard/VirtualCard';

interface CardLinkWalletPayload {
  ok: boolean;
  linked?: {
    wallet: string;
    chain?: string;
    currency: string;
    amount?: number;
    status?: string;
  };
  tip?: string;
  error?: string;
}

function CardLinkWalletWidget() {
  const props = useOpenAIGlobal('toolOutput') as CardLinkWalletPayload | null;

  if (!props) {
    return (
      <AppShell>
        <Card title="Link Wallet" badge={{ label: 'Loading' }}>
          <EmptyState message="Linking wallet…" />
        </Card>
      </AppShell>
    );
  }

  const { ok, linked, tip, error } = props;
  const linkedAmount =
    linked?.amount && linked.currency
      ? `${linked.amount.toLocaleString()} ${linked.currency.toUpperCase()}`
      : null;

  return (
    <AppShell>
      <Card
        title="Link Wallet to Dextercard"
        badge={{ label: ok ? 'Linked' : 'Not linked' }}
      >
        <VirtualCard theme="orange" stage={ok ? 'active' : undefined} />

        <div className="dxc-meta">
          {ok && linked ? (
            <>
              <p className="dxc-meta-copy">
                {linked.wallet} is now authorized to fund Dextercard transactions
                {linkedAmount ? ` up to ${linkedAmount}` : ''}.
              </p>
              <div className="dxc-fields">
                <div className="dxc-field-row">
                  <span>Wallet</span>
                  <span>{linked.wallet}</span>
                </div>
                {linked.chain ? (
                  <div className="dxc-field-row">
                    <span>Chain</span>
                    <span>{linked.chain}</span>
                  </div>
                ) : null}
                <div className="dxc-field-row">
                  <span>Currency</span>
                  <span>{linked.currency.toUpperCase()}</span>
                </div>
                {linkedAmount ? (
                  <div className="dxc-field-row">
                    <span>Cap</span>
                    <span>{linkedAmount}</span>
                  </div>
                ) : null}
                {linked.status ? (
                  <div className="dxc-field-row">
                    <span>Status</span>
                    <span>{linked.status}</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="dxc-meta-copy">
                {tip || error || 'Wallet could not be linked. Verify the card is active and the wallet exists in the carrier wallet store.'}
              </p>
            </>
          )}
        </div>
      </Card>
    </AppShell>
  );
}

const root = document.getElementById('card-link-wallet-root');
if (root) {
  createRoot(root).render(<CardLinkWalletWidget />);
}

export default CardLinkWalletWidget;
