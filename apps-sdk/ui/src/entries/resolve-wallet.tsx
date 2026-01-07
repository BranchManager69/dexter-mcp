import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState, Field, Grid, Status, Warning } from '../components/AppShell';
import { abbreviateAddress, formatTimestamp, formatValue } from '../components/utils';
import type { ResolveWalletPayload, ResolvedWallet } from '../types';
import { useDisplayMode, useMaxHeight, useOpenAIGlobal, useRequestDisplayMode } from '../sdk';

function normalizeResolved(payload: ResolveWalletPayload | null): ResolvedWallet | null {
  if (!payload) return null;
  const { result, ...rest } = payload;
  return (result ?? rest) as ResolvedWallet | null;
}

function ResolveWallet() {
  const props = useOpenAIGlobal('toolOutput') as ResolveWalletPayload | null;
  const resolved = normalizeResolved(props);
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  if (!resolved) {
    return (
      <AppShell style={style}>
        <Card title="Wallet Resolution" badge={{ label: 'Loading' }}>
          <EmptyState message="Resolving wallet..." />
        </Card>
      </AppShell>
    );
  }

  const address = resolved.address ?? resolved.walletAddress ?? null;
  const chain = resolved.chain ?? 'solana';
  const source = resolved.source ?? resolved.resolvedVia ?? 'unknown';
  const verified = resolved.verified ?? false;
  const linkedAt = resolved.linkedAt ?? null;

  return (
    <AppShell style={style}>
      <Card
        title="Wallet Resolution"
        badge={{ label: verified ? 'Verified' : 'Unverified' }}
        actions={
          canExpand ? (
            <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
              Expand
            </button>
          ) : null
        }
      >
        <Grid columns={2}>
          <Field label="Address" value={abbreviateAddress(address ?? '')} code />
          <Field label="Chain" value={formatValue(chain)} />
          <Field label="Source" value={formatValue(source)} />
          <Field label="Verified" value={verified ? 'Yes' : 'No'} />
          {linkedAt && <Field label="Linked At" value={formatTimestamp(linkedAt)} />}
        </Grid>
        {!verified && <Warning>This wallet is not verified. Resolve again to confirm.</Warning>}
        <Status>
          <span>Resolved via {source}</span>
        </Status>
      </Card>
    </AppShell>
  );
}

const root = document.getElementById('resolve-wallet-root');
if (root) {
  createRoot(root).render(<ResolveWallet />);
}

export default ResolveWallet;
