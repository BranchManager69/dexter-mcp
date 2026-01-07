import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { AppShell, Card, EmptyState, Field, Grid, Status, Warning } from '../components/AppShell';
import { abbreviateAddress, formatTimestamp, formatValue } from '../components/utils';
import type { PortfolioPayload, WalletBalance } from '../types';
import { useDisplayMode, useMaxHeight, useOpenAIGlobal, useRequestDisplayMode } from '../sdk';

interface PortfolioView {
  wallets: WalletBalance[];
  totalUsd: string;
  updatedAt: number;
}

function normalizePortfolio(payload: PortfolioPayload | null): PortfolioView | null {
  if (!payload) return null;
  const wallets = Array.isArray(payload.wallets) ? payload.wallets : [];
  return {
    wallets,
    totalUsd: payload.totalUsd ?? '0.00',
    updatedAt: payload.updatedAt ?? Date.now(),
  };
}

function PortfolioStatus() {
  const [debug, setDebug] = useState<string>('initializing...');
  
  useEffect(() => {
    // Debug: Log what window.openai looks like
    const openaiKeys = window.openai ? Object.keys(window.openai) : [];
    const toolOutput = (window as any).openai?.toolOutput;
    setDebug(`window.openai keys: [${openaiKeys.join(', ')}], toolOutput: ${JSON.stringify(toolOutput)?.slice(0, 100)}`);
  }, []);

  const props = useOpenAIGlobal('toolOutput') as PortfolioPayload | null;
  const portfolio = normalizePortfolio(props);
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  // Always show something, even if just debug info
  return (
    <AppShell style={style}>
      <Card title="Portfolio Overview" badge={{ label: portfolio ? `$${portfolio.totalUsd} USD` : 'Loading' }}>
        {/* Debug info - remove after testing */}
        <div style={{ background: '#222', color: '#0f0', padding: '8px', fontSize: '10px', fontFamily: 'monospace', marginBottom: '12px', borderRadius: '4px' }}>
          <strong>DEBUG:</strong> {debug}
        </div>
        
        {!portfolio ? (
          <EmptyState message="Fetching wallet data..." />
        ) : portfolio.wallets.length === 0 ? (
          <EmptyState message="No wallets linked." />
        ) : (
          portfolio.wallets.map((wallet, idx) => (
            <div key={wallet.address || idx} style={{ marginBottom: 12 }}>
              <Grid columns={3}>
                <Field label="Address" value={abbreviateAddress(wallet.address)} code />
                <Field label="Chain" value={formatValue(wallet.chain)} />
                <Field label="SOL" value={formatValue(wallet.sol)} />
                <Field label="USDC" value={formatValue(wallet.usdc)} />
                <Field label="USDT" value={formatValue(wallet.usdt)} />
                <Field label="Total (USD)" value={`$${formatValue(wallet.totalUsd)}`} />
              </Grid>
            </div>
          ))
        )}
        {portfolio && portfolio.wallets.length > 0 && !portfolio.wallets.every((w) => w.verified) && (
          <Warning>Some wallets are not verified. Deposits may fail until verified.</Warning>
        )}
        <Status>
          <span>Updated {formatTimestamp(portfolio?.updatedAt ?? Date.now())}</span>
        </Status>
      </Card>
    </AppShell>
  );
}

const root = document.getElementById('portfolio-status-root');
if (root) {
  createRoot(root).render(<PortfolioStatus />);
} else {
  // Fallback: create root ourselves
  const fallbackRoot = document.createElement('div');
  fallbackRoot.id = 'portfolio-status-root';
  document.body.appendChild(fallbackRoot);
  createRoot(fallbackRoot).render(<PortfolioStatus />);
}

export default PortfolioStatus;
