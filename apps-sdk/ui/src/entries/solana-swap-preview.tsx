import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState, Field, Grid, Status, Warning } from '../components/AppShell';
import { formatValue } from '../components/utils';
import type { SwapPreviewPayload, SwapQuote } from '../types';
import { useDisplayMode, useMaxHeight, useOpenAIGlobal, useRequestDisplayMode } from '../sdk';

function normalizeQuote(payload: SwapPreviewPayload | null): SwapQuote | null {
  if (!payload) return null;
  return (payload.result ?? payload.quote ?? payload) as SwapQuote | null;
}

function SolanaSwapPreview() {
  const props = useOpenAIGlobal('toolOutput') as SwapPreviewPayload | null;
  const quote = normalizeQuote(props);
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  if (!quote) {
    return (
      <AppShell style={style}>
        <Card title="Swap Preview" badge={{ label: 'Loading' }}>
          <EmptyState message="Fetching swap quote..." />
        </Card>
      </AppShell>
    );
  }

  const priceImpact = quote.priceImpactPct != null ? Number(quote.priceImpactPct) : null;
  const highImpact = priceImpact != null && priceImpact > 1;

  return (
    <AppShell style={style}>
      <Card
        title="Swap Preview"
        badge={{ label: quote.routeLabel ?? 'Jupiter' }}
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
          <Field label="Amount In (UI)" value={formatValue(quote.amountUi ?? quote.inAmountUi)} />
          <Field label="Expected Output" value={formatValue(quote.expectedOutputUi ?? quote.outAmountUi)} />
          <Field label="Price Impact (%)" value={priceImpact != null ? `${priceImpact.toFixed(2)}%` : '—'} />
          <Field label="Slippage (bps)" value={formatValue(quote.slippageBps)} />
          <Field label="Network Fee (SOL)" value={formatValue(quote.networkFeeSol)} />
          <Field label="Route" value={formatValue(quote.route ?? quote.routeLabel)} />
        </Grid>
        {highImpact && <Warning>High price impact! Consider using a smaller amount.</Warning>}
        <Status>
          <span>Quote ID: {formatValue(quote.quoteId ?? quote.swapId)}</span>
          <span>Valid for execution</span>
        </Status>
      </Card>
    </AppShell>
  );
}

const root = document.getElementById('solana-swap-preview-root');
if (root) {
  createRoot(root).render(<SolanaSwapPreview />);
}

export default SolanaSwapPreview;
