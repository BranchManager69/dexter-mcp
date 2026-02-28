import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-wallet.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal, useMaxHeight } from '../sdk';

const X402_WIDGET_BUILD = '2026-02-26.3';

type WalletPayload = {
  address?: string;
  network?: string;
  networkName?: string;
  balances?: { sol: number; usdc: number };
  walletFile?: string;
  tip?: string;
  error?: string;
};

function WalletDashboard() {
  const toolOutput = useOpenAIGlobal('toolOutput') as WalletPayload | null;
  const [copied, setCopied] = useState(false);
  const maxHeight = useMaxHeight();

  if (!toolOutput) {
    return <div className="wallet" style={{ maxHeight: maxHeight ?? undefined }}><div className="wallet-setup"><span className="wallet-setup__title">Loading wallet...</span></div></div>;
  }

  if (toolOutput.error && !toolOutput.address) {
    return (
      <div className="wallet" style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="wallet-setup">
          <span className="wallet-setup__title">Wallet Not Configured</span>
          <span className="wallet-setup__cmd">npx @dexterai/mcp wallet</span>
          <span className="wallet-setup__hint">Or set DEXTER_PRIVATE_KEY environment variable</span>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    if (!toolOutput.address) return;
    try {
      await navigator.clipboard.writeText(toolOutput.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const hasUsdc = (toolOutput.balances?.usdc ?? 0) > 0;
  const hasSol = (toolOutput.balances?.sol ?? 0) > 0.001;
  const ready = hasUsdc && hasSol;

  return (
    <div className="wallet" style={{ maxHeight: maxHeight ?? undefined }}>
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
          <span className="wallet-network">{toolOutput.networkName || 'Solana'}</span>
        </div>

        <div className="wallet-address" onClick={handleCopy} style={{ cursor: 'pointer' }}>
          <span className="wallet-address__text">{toolOutput.address}</span>
          <button className="wallet-address__copy">{copied ? 'Copied!' : 'Copy'}</button>
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
        </div>

        <div className={`wallet-readiness ${ready ? 'wallet-readiness--ready' : 'wallet-readiness--needs'}`}>
          {ready ? 'Ready for x402 execution' : 'Needs funding before automated x402 execution'}
        </div>

        {toolOutput.tip && <div className="wallet-tip">{toolOutput.tip}</div>}

      </div>
    </div>
  );
}

const root = document.getElementById('x402-wallet-root');
if (root) {
  root.setAttribute('data-widget-build', X402_WIDGET_BUILD);
  createRoot(root).render(<WalletDashboard />);
}

export default WalletDashboard;
