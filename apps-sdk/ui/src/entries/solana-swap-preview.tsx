import '../styles/global.css';

import { AppShell, Card, Field, Grid, Status, Warning } from '../components/AppShell';
import { formatTimestamp, formatValue } from '../components/utils';
import { registerReactComponent } from '../register';
import type { SwapPayload, SwapQuote } from '../types';
import { useDisplayMode, useMaxHeight, useRequestDisplayMode, useWidgetProps } from '../sdk';

function getQuote(props: SwapPayload): SwapQuote {
  const isQuote = props.result && 'quoteId' in (props.result as SwapQuote);
  if (isQuote) return props.result as SwapQuote;
  return { ...(props.result as SwapQuote), ...props.request };
}

registerReactComponent<SwapPayload>('dexter/solana-swap-preview', (initialProps) => {
  const props = useWidgetProps<SwapPayload>(() => initialProps);
  const quote = getQuote(props);
  const expired = Boolean(quote?.expired);
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  return (
    <AppShell style={style}>
      <Card
        title="Swap Preview"
        badge={{ label: expired ? 'Expired' : 'Preview' }}
        actions={
          canExpand ? (
            <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
              Expand
            </button>
          ) : null
        }
      >
        <Grid columns={3}>
          <Field label="Input Mint" value={formatValue(quote.inputMint)} />
          <Field label="Output Mint" value={formatValue(quote.outputMint)} />
          <Field label="Mode" value={formatValue(quote.mode)} />
          <Field label="Amount In (UI)" value={formatValue(quote.amountUi ?? props.request?.amountUi)} />
          <Field label="Desired Out (UI)" value={formatValue(quote.desiredOutputUi ?? props.request?.desiredOutputUi)} />
          <Field label="Expected Out (UI)" value={formatValue(quote.expectedOutputUi)} />
          <Field label="Wallet" value={formatValue(quote.walletAddress ?? props.request?.walletAddress)} />
          <Field label="Slippage (bps)" value={formatValue(quote.slippageBps ?? props.request?.slippageBps)} />
          <Field label="Route" value={formatValue(quote.route)} />
          <Field label="Price Impact (%)" value={quote.priceImpactPct ? `${formatValue(quote.priceImpactPct)}%` : '—'} />
          <Field label="Network Fee (SOL)" value={formatValue(quote.networkFeeSol)} />
          <Field label="Quote ID" value={formatValue(quote.quoteId)} />
        </Grid>
        <Status>
          <span>Quote expires at {formatTimestamp(quote.expiresAt ?? null)}</span>
          {expired ? (
            <Warning>This quote has expired. Generate a fresh preview before executing the swap.</Warning>
          ) : (
            <span>Looks good—run `solana_swap_execute` using the same parameters when you’re ready.</span>
          )}
        </Status>
      </Card>
    </AppShell>
  );
});
