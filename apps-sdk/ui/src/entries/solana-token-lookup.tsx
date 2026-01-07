import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState, Field, Grid, Status } from '../components/AppShell';
import { formatValue } from '../components/utils';
import type { TokenLookupPayload, TokenMeta } from '../types';
import { useDisplayMode, useMaxHeight, useOpenAIGlobal, useRequestDisplayMode } from '../sdk';

function normalizeMeta(payload: TokenLookupPayload | null): TokenMeta | null {
  if (!payload) return null;
  return (payload.result ?? payload.token ?? payload) as TokenMeta | null;
}

function formatUsd(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}

function SolanaTokenLookup() {
  const props = useOpenAIGlobal('toolOutput') as TokenLookupPayload | null;
  const meta = normalizeMeta(props);
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  if (!meta) {
    return (
      <AppShell style={style}>
        <Card title="Token Lookup" badge={{ label: 'Loading' }}>
          <EmptyState message="Fetching token data..." />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell style={style}>
      <Card
        title={meta.name ?? 'Token Lookup'}
        badge={{ label: meta.symbol ?? 'Token' }}
        actions={
          canExpand ? (
            <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
              Expand
            </button>
          ) : null
        }
      >
        <Grid columns={3}>
          <Field label="Symbol" value={formatValue(meta.symbol)} />
          <Field label="Decimals" value={formatValue(meta.decimals)} />
          <Field label="Mint" value={formatValue(meta.address ?? meta.mint)} code />
          <Field label="Price (USD)" value={formatUsd(meta.priceUsd)} />
          <Field label="Market Cap" value={formatUsd(meta.marketCap)} />
          <Field label="24h Volume" value={formatUsd(meta.volume24h)} />
          {meta.logoURI && (
            <Field
              label="Logo"
              value={<img src={meta.logoURI} alt={meta.symbol ?? 'logo'} style={{ width: 24, height: 24 }} />}
            />
          )}
        </Grid>
        <Status>
          <span>Chain: Solana</span>
          {meta.address && (
            <a
              className="dexter-link"
              href={`https://solscan.io/token/${meta.address}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Solscan
            </a>
          )}
        </Status>
      </Card>
    </AppShell>
  );
}

const root = document.getElementById('solana-token-lookup-root');
if (root) {
  createRoot(root).render(<SolanaTokenLookup />);
}

export default SolanaTokenLookup;
