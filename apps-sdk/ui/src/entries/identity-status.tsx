import '../styles/base.css';
import '../styles/components.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState, Field, Grid, Status, Warning } from '../components/AppShell';
import { abbreviateAddress, formatTimestamp, formatValue } from '../components/utils';
import type { Identity, IdentityStatusPayload } from '../types';
import { useDisplayMode, useMaxHeight, useOpenAIGlobal, useRequestDisplayMode } from '../sdk';

function IdentityCard({ identity }: { identity: Identity }) {
  return (
    <div style={{ marginBottom: '12px', padding: '12px', background: 'var(--dexter-bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
      <Grid columns={2}>
        <Field label="Name" value={identity.name || 'Unnamed'} />
        <Field label="Chain" value={formatValue(identity.chain)} />
        <Field label="Agent ID" value={abbreviateAddress(identity.agentId ?? '')} code />
        <Field label="Status" value={formatValue(identity.status)} />
        {identity.agentWallet && (
          <Field label="Wallet" value={abbreviateAddress(identity.agentWallet)} code />
        )}
        {identity.mintedAt && (
          <Field label="Minted" value={formatTimestamp(identity.mintedAt)} />
        )}
      </Grid>
      {identity.services && identity.services.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--dexter-text-muted, #666)' }}>
            Services: {identity.services.map(s => s.name).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

function IdentityStatus() {
  const props = useOpenAIGlobal('toolOutput') as IdentityStatusPayload | null;
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  if (!props) {
    return (
      <AppShell style={style}>
        <Card title="Identity Status" badge={{ label: 'Loading' }}>
          <EmptyState message="Checking identity..." />
        </Card>
      </AppShell>
    );
  }

  const { hasIdentity, hasBase, hasSolana, identity, identities, recommended } = props;

  // Single identity view
  if (identity) {
    return (
      <AppShell style={style}>
        <Card
          title="ERC-8004 Identity"
          badge={{ label: identity.status === 'minted' ? 'Active' : formatValue(identity.status) }}
          actions={
            canExpand ? (
              <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
                Expand
              </button>
            ) : null
          }
        >
          <IdentityCard identity={identity} />
          {identity.description && (
            <p style={{ fontSize: '14px', color: 'var(--dexter-text-secondary, #444)', margin: '8px 0' }}>
              {identity.description}
            </p>
          )}
          <Status>
            <span>ERC-8004 on {identity.chain}</span>
          </Status>
        </Card>
      </AppShell>
    );
  }

  // Multiple identities view
  if (identities && identities.length > 0) {
    return (
      <AppShell style={style}>
        <Card
          title="Your Identities"
          badge={{ label: `${identities.length} found` }}
          actions={
            canExpand ? (
              <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
                Expand
              </button>
            ) : null
          }
        >
          {identities.map((id, idx) => (
            <IdentityCard key={id.id || idx} identity={id} />
          ))}
          <Status>
            <span>Base: {hasBase ? '✓' : '✗'} | Solana: {hasSolana ? '✓' : '✗'}</span>
          </Status>
        </Card>
      </AppShell>
    );
  }

  // Status check view (no identity details)
  return (
    <AppShell style={style}>
      <Card
        title="Identity Status"
        badge={{ label: hasIdentity ? 'Found' : 'Not Found' }}
        actions={
          canExpand ? (
            <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
              Expand
            </button>
          ) : null
        }
      >
        <Grid columns={2}>
          <Field label="Has Identity" value={hasIdentity ? 'Yes' : 'No'} />
          <Field label="Base" value={hasBase ? 'Yes' : 'No'} />
          <Field label="Solana" value={hasSolana ? 'Yes' : 'No'} />
          {recommended && <Field label="Recommended" value={recommended} />}
        </Grid>
        {!hasIdentity && (
          <Warning>No ERC-8004 identity found. Use mint_identity to create one.</Warning>
        )}
        <Status>
          <span>ERC-8004 Identity Check</span>
        </Status>
      </Card>
    </AppShell>
  );
}

const root = document.getElementById('identity-status-root');
if (root) {
  createRoot(root).render(<IdentityStatus />);
}

export default IdentityStatus;
