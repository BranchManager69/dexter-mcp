import '../styles/global.css';

import { AppShell, Card, Field, Grid, Status, Warning } from '../components/AppShell';
import { formatTimestamp, formatValue } from '../components/utils';
import { registerReactComponent } from '../register';
import type { SwapPayload, SwapQuote } from '../types';

function getQuote(props: SwapPayload): SwapQuote {
  const isQuote = props.result && 'quoteId' in (props.result as SwapQuote);
  if (isQuote) return props.result as SwapQuote;
  return { ...(props.result as SwapQuote), ...props.request };
}

registerReactComponent<SwapPayload>('dexter-mcp/solana-swap-preview', (props) => {
  const quote = getQuote(props);
  const expired = Boolean(quote?.expired);

  return (
    <AppShell>
      <Card title="Swap Preview" badge={{ label: expired ? 'Expired' : 'Preview' }}>
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
