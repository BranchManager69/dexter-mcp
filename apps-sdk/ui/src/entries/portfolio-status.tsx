import '../styles/global.css';

import { AppShell, Card, Field, Grid, EmptyState } from '../components/AppShell';
import { abbreviateAddress, formatValue } from '../components/utils';
import { registerReactComponent } from '../register';
import type { PortfolioPayload, PortfolioWallet } from '../types';
import { useDisplayMode, useMaxHeight, useRequestDisplayMode, useWidgetProps } from '../sdk';

function WalletCard({ wallet, index }: { wallet: PortfolioWallet; index: number }) {
  const address = wallet.address ?? wallet.public_key ?? wallet.publicKey ?? '';
  const label = wallet.label || `Wallet ${index + 1}`;
  return (
    <Card
      title={label}
      badge={
        wallet.is_default
          ? {
              label: 'Default',
            }
          : undefined
      }
    >
      <Grid columns={2}>
        <Field label="Address" value={abbreviateAddress(address)} code />
        <Field label="Status" value={formatValue(wallet.status || (wallet.is_default ? 'Active' : 'Registered'))} />
        <Field label="Full Address" value={address || '—'} code />
        <Field label="Label" value={formatValue(wallet.label)} />
      </Grid>
    </Card>
  );
}

registerReactComponent<PortfolioPayload>('dexter/portfolio-status', (initialProps) => {
  const props = useWidgetProps<PortfolioPayload>(() => initialProps);
  const wallets = Array.isArray(props.wallets) ? props.wallets : [];
  const userId = props.user?.id ? String(props.user.id) : null;
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  return (
    <AppShell style={style}>
      <Card
        title="Dexter Wallets"
        badge={wallets.length ? { label: `${wallets.length} Wallet${wallets.length === 1 ? '' : 's'}` } : undefined}
        actions={
          canExpand ? (
            <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
              Expand
            </button>
          ) : null
        }
      >
        <Grid columns={2}>
          <Field label="User ID" value={formatValue(userId)} />
          <Field label="Default Wallet" value={wallets.find((wallet) => wallet.is_default)?.address ?? '—'} code />
        </Grid>
      </Card>
      {wallets.length ? (
        <div className="dexter-token-list">
          {wallets.map((wallet, index) => (
            <WalletCard key={`${wallet.address ?? wallet.public_key ?? index}`} wallet={wallet} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState message="No wallets linked to this session yet." />
      )}
    </AppShell>
  );
});
