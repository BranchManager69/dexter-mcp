import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-wallet.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal, useMaxHeight, useTheme, useCallToolFn, useOpenExternal } from '../sdk';
import { CopyButton, useIntrinsicHeight, DebugPanel } from '../components/x402';

type SessionFunding = {
  amountAtomic?: string;
  amountUsdc?: number;
  walletAddress?: string;
  payTo?: string;
  txUrl?: string;
  solanaPayUrl?: string;
  reference?: string;
  network?: string;
  escrowNote?: string;
};

type WalletPayload = {
  address?: string;
  network?: string;
  networkName?: string;
  balances?: { sol?: number; usdc?: number; fundedAtomic?: string; spentAtomic?: string; availableAtomic?: string };
  walletFile?: string;
  tip?: string;
  error?: string;
  maxPaymentUsdc?: string;
  evmAddress?: string;
  evmNetwork?: string;
  state?: string;
  sessionId?: string;
  sessionToken?: string;
  sessionFunding?: SessionFunding;
  mode?: string;
  expiresAt?: string;
};

function formatUsdc(atomic: string | undefined): string {
  if (!atomic) return '0.00';
  return (Number(atomic) / 1e6).toFixed(2);
}

function SessionFundingPanel({ funding, state }: { funding: SessionFunding; state?: string }) {
  const openExternal = useOpenExternal();
  const walletAddress = funding.walletAddress || funding.payTo;
  const qrUrl = funding.solanaPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(funding.solanaPayUrl)}`
    : null;

  const isFunded = state === 'active' || state === 'depleted';

  return (
    <div className="wallet-funding">
      <div className="wallet-funding__title">{isFunded ? 'Add Funds' : 'Fund Session'}</div>
      {funding.amountUsdc !== undefined && (
        <div className="wallet-funding__amount">${Number(funding.amountUsdc).toFixed(2)} USDC</div>
      )}
      {walletAddress && (
        <div className="wallet-funding__address">
          <span className="wallet-funding__label">Deposit to:</span>
          <span className="wallet-funding__value">{walletAddress}</span>
          <CopyButton text={walletAddress} className="wallet-funding__copy" />
        </div>
      )}
      {qrUrl && (
        <div className="wallet-funding__qr">
          <img src={qrUrl} alt="Solana Pay QR Code" width={160} height={160} />
        </div>
      )}
      {funding.txUrl && (
        <button className="wallet-funding__action" onClick={() => openExternal(funding.txUrl!)}>
          Open Funding Page
        </button>
      )}
      {funding.solanaPayUrl && (
        <button className="wallet-funding__action" onClick={() => openExternal(funding.solanaPayUrl!)}>
          Open in Solana Wallet
        </button>
      )}
    </div>
  );
}

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
      const sessionToken = toolOutput?.sessionToken;
      await callTool('x402_wallet', sessionToken ? { sessionToken } : {});
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

  const isSession = Boolean(toolOutput.sessionId || toolOutput.sessionFunding);
  const usdcBalance = toolOutput.balances?.usdc ?? 0;
  const solBalance = toolOutput.balances?.sol ?? 0;
  const hasUsdc = usdcBalance > 0;
  const hasSol = solBalance > 0.001;
  const ready = isSession
    ? (toolOutput.state === 'active')
    : (hasUsdc && hasSol);

  const eyebrow = isSession ? 'OpenDexter Session' : 'x402 Settlement Wallet';
  const subtitle = isSession
    ? (toolOutput.state === 'active'
      ? 'Session funded and ready for x402 calls.'
      : toolOutput.state === 'depleted'
        ? 'Session balance exhausted.'
        : 'Fund this session to start making x402 calls.')
    : 'Funding state for automated x402 execution.';

  return (
    <div className="wallet" data-theme={theme} ref={containerRef} style={{ maxHeight: maxHeight ?? undefined }}>
      <div className="wallet-card">
        <div className="wallet-header">
          <div className="wallet-header__title-wrap">
            <span className="wallet-header__eyebrow">{eyebrow}</span>
            <span className="wallet-header__title">
              <span className="wallet-chain-icon wallet-chain-icon--solana" aria-hidden="true" />
              Wallet Overview
            </span>
            <span className="wallet-header__subtitle">{subtitle}</span>
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
              ${usdcBalance.toFixed(2)}
            </span>
          </div>
          {!isSession && (
            <div className="wallet-balance">
              <span className="wallet-balance__label">SOL</span>
              <span className="wallet-balance__value">
                {solBalance.toFixed(4)}
                <span className="wallet-balance__unit"> SOL</span>
              </span>
            </div>
          )}
          {isSession && toolOutput.balances?.spentAtomic && Number(toolOutput.balances.spentAtomic) > 0 && (
            <div className="wallet-balance">
              <span className="wallet-balance__label">Spent</span>
              <span className="wallet-balance__value">${formatUsdc(toolOutput.balances.spentAtomic)}</span>
            </div>
          )}
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

        {isSession && toolOutput.sessionFunding && (
          <SessionFundingPanel funding={toolOutput.sessionFunding} state={toolOutput.state} />
        )}

        <div className={`wallet-readiness ${ready ? 'wallet-readiness--ready' : 'wallet-readiness--needs'}`}>
          {ready ? 'Ready for x402 execution' : isSession ? 'Awaiting session funding' : 'Needs funding before automated x402 execution'}
        </div>

        {toolOutput.tip && <div className="wallet-tip">{toolOutput.tip}</div>}
        <DebugPanel widgetName="x402-wallet" />
      </div>
    </div>
  );
}

const root = document.getElementById('x402-wallet-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-01.1');
  createRoot(root).render(<WalletDashboard />);
}

export default WalletDashboard;
