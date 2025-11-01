import '../styles/global.css';

import { AppShell, Card, Field, Grid, Status } from '../components/AppShell';
import { formatValue } from '../components/utils';
import { registerReactComponent } from '../register';
import type { SwapExecution, SwapPayload } from '../types';
import { useDisplayMode, useMaxHeight, useRequestDisplayMode, useWidgetProps } from '../sdk';

function getExecution(props: SwapPayload): SwapExecution {
  if (!props.result) return {};
  return props.result as SwapExecution;
}

function buildExplorerLink(signature: string | null | undefined) {
  if (!signature) return null;
  const url = `https://solscan.io/tx/${signature}`;
  return (
    <a className="dexter-link" href={url} target="_blank" rel="noreferrer">
      View on Solscan
    </a>
  );
}

registerReactComponent<SwapPayload>('dexter/solana-swap-execute', (initialProps) => {
  const props = useWidgetProps<SwapPayload>(() => initialProps);
  const execution = getExecution(props);
  const signature = execution.txSignature ?? execution.transactionSignature ?? execution.signature ?? null;
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  return (
    <AppShell style={style}>
      <Card
        title="Swap Execution"
        badge={{ label: execution.status ? execution.status.toUpperCase() : 'Executed' }}
        actions={
          canExpand ? (
            <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
              Expand
            </button>
          ) : null
        }
      >
        <Grid columns={3}>
          <Field label="Input Mint" value={formatValue(execution.inputMint ?? props.request?.inputMint)} />
          <Field label="Output Mint" value={formatValue(execution.outputMint ?? props.request?.outputMint)} />
          <Field label="Wallet" value={formatValue(execution.walletAddress ?? props.request?.walletAddress)} />
          <Field label="Amount In (UI)" value={formatValue(execution.amountUi ?? props.request?.amountUi)} />
          <Field label="Output (UI)" value={formatValue(execution.outputAmountUi ?? execution.expectedOutputUi)} />
          <Field label="Price Impact (%)" value={execution.priceImpactPct ? `${formatValue(execution.priceImpactPct)}%` : '—'} />
          <Field label="Network Fee (SOL)" value={formatValue(execution.networkFeeSol)} />
          <Field label="Slippage (bps)" value={formatValue(execution.slippageBps ?? props.request?.slippageBps)} />
          <Field label="Route" value={formatValue(execution.route)} />
        </Grid>
        <Status>
          <span>Swap ID: {formatValue(execution.swapId)}</span>
          {signature ? <span>Signature: {signature}</span> : <span>No signature returned.</span>}
          {buildExplorerLink(signature)}
        </Status>
      </Card>
    </AppShell>
  );
});
