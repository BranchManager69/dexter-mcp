import '../styles/global.css';

import { AppShell, Card, EmptyState, Field, Grid, Status, Warning } from '../components/AppShell';
import { abbreviateAddress, formatTimestamp, formatValue } from '../components/utils';
import { registerReactComponent } from '../register';
import type { SolanaSendPayload, SolanaSendTransfer } from '../types';
import { useDisplayMode, useMaxHeight, useRequestDisplayMode, useWidgetProps } from '../sdk';

function normalizeTransfer(payload: SolanaSendPayload): SolanaSendTransfer | null {
  if (payload.result) {
    return payload.result;
  }
  if (payload.transfer) {
    const { transfer } = payload;
    if (transfer && !transfer.destination && transfer.recipient) {
      return { ...transfer, destination: transfer.recipient };
    }
    return transfer ?? null;
  }
  return null;
}

function formatUsd(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatHandle(handle: string | null | undefined): string {
  if (!handle) return '—';
  const trimmed = handle.startsWith('@') ? handle.slice(1) : handle;
  const clean = trimmed.trim();
  if (!clean) return '—';
  return `@${clean}`;
}

registerReactComponent<SolanaSendPayload>('dexter/solana-send', (initialProps) => {
  const props = useWidgetProps<SolanaSendPayload>(() => initialProps);
  const transfer = normalizeTransfer(props);
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const status = props.ok ? 'sent' : props.error === 'confirmation_required' ? 'confirm' : 'error';
  const badgeLabel = status === 'sent' ? 'Sent' : status === 'confirm' ? 'Confirm' : 'Failed';

  const destination = transfer?.destination ?? transfer?.recipient ?? null;
  const signature = transfer?.signature ?? null;
  const solscanUrl = transfer?.solscanUrl ?? (signature ? `https://solscan.io/tx/${signature}` : null);
  const threshold = props.thresholdUsd ?? null;
  const amountDisplay = transfer?.amountUi != null
    ? `${formatValue(transfer.amountUi)}${transfer?.mint ? ` ${transfer.mint}` : ''}`.trim()
    : '—';
  const valueUsd = formatUsd(transfer?.valueUsd ?? null);
  const priceUsd = formatUsd(transfer?.priceUsd ?? null);

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  return (
    <AppShell style={style}>
      <Card
        title="Solana Transfer"
        badge={{ label: badgeLabel }}
        actions={
          canExpand ? (
            <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
              Expand
            </button>
          ) : null
        }
      >
        {transfer ? (
          <Grid columns={3}>
            <Field label="Source Wallet" value={abbreviateAddress(transfer.walletAddress ?? '')} code />
            <Field label="Destination" value={abbreviateAddress(destination ?? '')} code />
            <Field label="Recipient Handle" value={formatHandle(transfer.recipientHandle)} />
            <Field label="Mint" value={formatValue(transfer.mint)} />
            <Field label="Amount (UI)" value={amountDisplay} />
            <Field label="Value (USD)" value={valueUsd} />
            <Field label="Price (USD)" value={priceUsd} />
            <Field label="Decimals" value={formatValue(transfer.decimals)} />
            <Field label="Raw Amount" value={formatValue(transfer.amountRaw)} />
            <Field label="Memo" value={formatValue(transfer.memo)} />
            {status === 'confirm' && threshold != null ? (
              <Field label="Confirmation Threshold" value={formatUsd(threshold)} />
            ) : null}
          </Grid>
        ) : (
          <EmptyState message="No transfer details were returned." />
        )}
        <Status>
          <span>Updated {formatTimestamp(Date.now())}</span>
          {status === 'sent' ? (
            <>
              <span>Transfer broadcast successfully.</span>
              {signature ? <span>Signature: {signature}</span> : null}
              {solscanUrl ? (
                <a className="dexter-link" href={solscanUrl} target="_blank" rel="noreferrer">
                  View on Solscan
                </a>
              ) : null}
            </>
          ) : status === 'confirm' ? (
            <>
              <span>This transfer meets or exceeds the confirmation threshold.</span>
              <Warning>Re-run the tool with <code>confirm=true</code> to approve this transfer.</Warning>
            </>
          ) : (
            <>
              <span>{formatValue(props.message || props.error || 'Send failed')}</span>
              <Warning>Review the parameters and try again.</Warning>
            </>
          )}
        </Status>
      </Card>
    </AppShell>
  );
});
