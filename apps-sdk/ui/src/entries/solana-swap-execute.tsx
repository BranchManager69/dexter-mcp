import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState, Field, Grid, Status } from '../components/AppShell';
import { formatValue } from '../components/utils';
import type { SwapExecution, SwapPayload } from '../types';
import { useDisplayMode, useMaxHeight, useOpenAIGlobal, useRequestDisplayMode } from '../sdk';

function getExecution(props: SwapPayload | null): SwapExecution | null {
  if (!props) return null;
  if (!props.result) return props as unknown as SwapExecution;
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

function SolanaSwapExecute() {
  const props = useOpenAIGlobal('toolOutput') as SwapPayload | null;
  const execution = getExecution(props);
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  if (!execution) {
    return (
      <AppShell style={style}>
        <Card title="Swap Execution" badge={{ label: 'Loading' }}>
          <EmptyState message="Processing swap..." />
        </Card>
      </AppShell>
    );
  }

  const signature = execution.txSignature ?? execution.transactionSignature ?? execution.signature ?? null;

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
          <Field label="Input Mint" value={formatValue(execution.inputMint)} />
          <Field label="Output Mint" value={formatValue(execution.outputMint)} />
          <Field label="Wallet" value={formatValue(execution.walletAddress)} />
          <Field label="Amount In (UI)" value={formatValue(execution.amountUi)} />
          <Field label="Output (UI)" value={formatValue(execution.outputAmountUi ?? execution.expectedOutputUi)} />
          <Field label="Price Impact (%)" value={execution.priceImpactPct ? `${formatValue(execution.priceImpactPct)}%` : '—'} />
          <Field label="Network Fee (SOL)" value={formatValue(execution.networkFeeSol)} />
          <Field label="Slippage (bps)" value={formatValue(execution.slippageBps)} />
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
}

const root = document.getElementById('solana-swap-execute-root');
if (root) {
  createRoot(root).render(<SolanaSwapExecute />);
}

export default SolanaSwapExecute;
