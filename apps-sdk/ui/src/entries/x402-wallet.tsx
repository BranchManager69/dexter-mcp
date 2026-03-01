import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-wallet.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal, useMaxHeight, useTheme, useCallToolFn } from '../sdk';
import { CopyButton, useIntrinsicHeight, DebugPanel } from '../components/x402';

type WalletPayload = {
  address?: string;
  network?: string;
  networkName?: string;
  balances?: { sol: number; usdc: number };
  walletFile?: string;
  tip?: string;
  error?: string;
  maxPaymentUsdc?: string;
  evmAddress?: string;
  evmNetwork?: string;
};

function WalletDashboard() {
  const toolOutput = useOpenAIGlobal('toolOutput') as WalletPayload | null;
  const theme = useTheme();
  const callTool = useCallToolFn();
  const maxHeight = useMaxHeight();
  const containerRef = useIntrinsicHeight();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await callTool('x402_wallet', {});
    } finally {
      setRefreshing(false);
    }
  };

  if (!toolOutput) {
    return <div className="wallet" data-theme={theme} style={{ maxHeight: maxHeight ?? undefined }}><div className="wallet-setup"><span className="wallet-setup__title">Loading wallet...</span></div></div>;
  }

  if (toolOutput.error && !toolOutput.address) {
    return (
      <div className="wallet" data-theme={theme} style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="wallet-setup">
          <span className="wallet-setup__title">Wallet Not Configured</span>
          <span className="wallet-setup__cmd">npx @dexterai/opendexter wallet</span>
          <span className="wallet-setup__hint">Or set DEXTER_PRIVATE_KEY environment variable</span>
        </div>
      </div>
    );
  }

  const hasUsdc = (toolOutput.balances?.usdc ?? 0) > 0;
  const hasSol = (toolOutput.balances?.sol ?? 0) > 0.001;
  const ready = hasUsdc && hasSol;

  return (
    <div className="wallet" data-theme={theme} ref={containerRef} style={{ maxHeight: maxHeight ?? undefined }}>
      <div className="wallet-card">
        <div className="wallet-header">
          <div className="wallet-header__title-wrap">
            <span className="wallet-header__eyebrow">x402 Settlement Wallet</span>
            <span className="wallet-header__title">
              <span className="wallet-chain-icon wallet-chain-icon--solana" aria-hidden="true" />
              Wallet Overview
            </span>
            <span className="wallet-header__subtitle">Funding state for automated x402 execution.</span>
          </div>
          <div className="wallet-header__actions">
            <button className="wallet-refresh-btn" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? '...' : 'Refresh'}
            </button>
            <span className="wallet-network">{toolOutput.networkName || 'Solana'}</span>
          </div>
        </div>

        <div className="wallet-address">
          <span className="wallet-address__text">{toolOutput.address}</span>
          {toolOutput.address && <CopyButton text={toolOutput.address} label="Copy" className="wallet-address__copy" />}
        </div>

        <div className="wallet-balances">
          <div className="wallet-balance">
            <span className="wallet-balance__label">
              <span className="wallet-token-dot wallet-token-dot--usdc" aria-hidden="true" />
              USDC
            </span>
            <span className={`wallet-balance__value ${hasUsdc ? 'wallet-balance__value--usdc' : 'wallet-balance__value--zero'}`}>
              ${toolOutput.balances?.usdc.toFixed(2) ?? '0.00'}
            </span>
          </div>
          <div className="wallet-balance">
            <span className="wallet-balance__label">SOL</span>
            <span className="wallet-balance__value">
              {toolOutput.balances?.sol.toFixed(4) ?? '0.0000'}
              <span className="wallet-balance__unit"> SOL</span>
            </span>
          </div>
          {toolOutput.maxPaymentUsdc && (
            <div className="wallet-balance">
              <span className="wallet-balance__label">Spend limit</span>
              <span className="wallet-balance__value">${toolOutput.maxPaymentUsdc}/call</span>
            </div>
          )}
        </div>

        {toolOutput.evmAddress && (
          <div className="wallet-evm">
            <span className="wallet-evm__label">EVM ({toolOutput.evmNetwork || 'Base'})</span>
            <span className="wallet-evm__addr">{toolOutput.evmAddress}</span>
            <CopyButton text={toolOutput.evmAddress} label="Copy" className="wallet-evm__copy" />
          </div>
        )}

        <div className={`wallet-readiness ${ready ? 'wallet-readiness--ready' : 'wallet-readiness--needs'}`}>
          {ready ? 'Ready for x402 execution' : 'Needs funding before automated x402 execution'}
        </div>

        {toolOutput.tip && <div className="wallet-tip">{toolOutput.tip}</div>}
        <DebugPanel widgetName="x402-wallet" />
      </div>
    </div>
  );
}

const root = document.getElementById('x402-wallet-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-02-28.2');
  createRoot(root).render(<WalletDashboard />);
}

export default WalletDashboard;
