import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-wallet.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal, useMaxHeight } from '../sdk';

const X402_WIDGET_BUILD = '2026-02-26.1';

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
  const qrSrc = toolOutput?.address
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(toolOutput.address)}`
    : null;

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

  return (
    <div className="wallet" style={{ maxHeight: maxHeight ?? undefined }}>
      <div className="wallet-card">
        <div className="wallet-header">
          <span className="wallet-header__title">
            <img
              className="wallet-header__logo"
              src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/sol.png"
              alt="Solana"
            />
            x402 Wallet
          </span>
          <span className="wallet-network">{toolOutput.networkName || 'Solana'}</span>
        </div>

        <div className="wallet-address" onClick={handleCopy} style={{ cursor: 'pointer' }}>
          <span className="wallet-address__text">{toolOutput.address}</span>
          <button className="wallet-address__copy">{copied ? 'Copied!' : 'Copy'}</button>
        </div>

        <div className="wallet-balances">
          <div className="wallet-balance">
            <span className="wallet-balance__label">USDC</span>
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

        {toolOutput.tip && <div className="wallet-tip">{toolOutput.tip}</div>}

        {qrSrc && (
          <div className="wallet-qr">
            <img src={qrSrc} alt="Wallet QR code" width={160} height={160} style={{ borderRadius: 12 }} />
          </div>
        )}
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
