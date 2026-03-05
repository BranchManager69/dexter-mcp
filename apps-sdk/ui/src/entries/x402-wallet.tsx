import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { Alert } from '@openai/apps-sdk-ui/components/Alert';
import { Globe, Warning } from '@openai/apps-sdk-ui/components/Icon';
import { useOpenAIGlobal, useMaxHeight, useTheme, useCallToolFn, useOpenExternal } from '../sdk';
import { useIntrinsicHeight, DebugPanel } from '../components/x402';

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

function formatUsdcAtomic(atomic: string | undefined): string {
  if (!atomic) return '$0.00';
  const n = Number(atomic) / 1e6;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function formatUsdcDisplay(value: number): string {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

function SessionFundingPanel({ funding, state }: { funding: SessionFunding; state?: string }) {
  const openExternal = useOpenExternal();
  const walletAddress = funding.walletAddress || funding.payTo;
  const qrUrl = funding.solanaPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(funding.solanaPayUrl)}`
    : null;
  const isFunded = state === 'active' || state === 'depleted';

  return (
    <div className="rounded-xl bg-surface-secondary p-4 flex flex-col items-center gap-3">
      <span className="text-sm font-bold uppercase tracking-wide text-warning">
        {isFunded ? 'Add Funds' : 'Fund Session'}
      </span>
      {funding.amountUsdc !== undefined && (
        <span className="heading-xl">${Number(funding.amountUsdc).toFixed(2)} USDC</span>
      )}
      {walletAddress && (
        <div className="flex items-center gap-2 min-w-0 w-full">
          <span className="text-xs text-tertiary flex-shrink-0">Deposit to:</span>
          <span className="text-xs font-mono text-secondary truncate flex-1">{walletAddress}</span>
          <CopyButton copyValue={walletAddress} variant="ghost" color="secondary" size="sm" />
        </div>
      )}
      {qrUrl && (
        <div className="p-2 bg-white rounded-lg inline-block">
          <img src={qrUrl} alt="Solana Pay QR Code" width={140} height={140} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 w-full">
        {funding.txUrl && (
          <Button color="primary" block onClick={() => openExternal(funding.txUrl!)}>
            Open Funding Page
          </Button>
        )}
        {funding.solanaPayUrl && (
          <Button variant="soft" color="secondary" block onClick={() => openExternal(funding.solanaPayUrl!)}>
            Solana Pay
          </Button>
        )}
      </div>
    </div>
  );
}

function SessionDetails({ sessionToken, sessionId, expiresAt, walletAddress }: {
  sessionToken: string;
  sessionId?: string;
  expiresAt?: string | null;
  walletAddress?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-subtle overflow-hidden">
      <button
        className="flex justify-between items-center w-full px-4 py-2.5 bg-surface-secondary text-xs font-semibold text-tertiary hover:text-secondary transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span>Session Details</span>
        <span className="text-2xs">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && (
        <div className="px-4 py-3 flex flex-col gap-2 border-t border-subtle bg-surface">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-tertiary w-14 flex-shrink-0">Token</span>
            <span className="text-xs font-mono text-secondary truncate flex-1">{sessionToken}</span>
            <CopyButton copyValue={sessionToken} variant="ghost" color="secondary" size="sm" />
          </div>
          {sessionId && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-tertiary w-14 flex-shrink-0">ID</span>
              <span className="text-xs font-mono text-secondary truncate flex-1">{sessionId}</span>
              <CopyButton copyValue={sessionId} variant="ghost" color="secondary" size="sm" />
            </div>
          )}
          {walletAddress && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-tertiary w-14 flex-shrink-0">Wallet</span>
              <span className="text-xs font-mono text-secondary truncate flex-1">{walletAddress}</span>
              <CopyButton copyValue={walletAddress} variant="ghost" color="secondary" size="sm" />
            </div>
          )}
          {expiresAt && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-tertiary w-14 flex-shrink-0">Expires</span>
              <span className="text-xs text-secondary">{new Date(expiresAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WalletDashboard() {
  const toolOutput = useOpenAIGlobal('toolOutput') as WalletPayload | null;
  const toolMeta = useOpenAIGlobal('toolResponseMetadata') as Record<string, unknown> | null;
  const widgetState = useOpenAIGlobal('widgetState') as { sessionToken?: string } | null;
  const theme = useTheme();
  const callTool = useCallToolFn();
  const maxHeight = useMaxHeight();
  const containerRef = useIntrinsicHeight();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const metaToken = (toolMeta as any)?.sessionToken as string | undefined;
  const storedToken = widgetState?.sessionToken;
  const sessionToken = metaToken || storedToken;

  useEffect(() => {
    if (sessionToken && sessionToken !== storedToken) {
      try {
        (window as any).openai?.setWidgetState?.({ sessionToken });
      } catch {}
    }
  }, [sessionToken, storedToken]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await callTool('x402_wallet', sessionToken ? { sessionToken } : {});
    } finally {
      setRefreshing(false);
    }
  };

  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (toolOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [toolOutput]);

  if (!toolOutput) {
    return (
      <div data-theme={theme} className="p-4 flex flex-col gap-2" style={{ maxHeight: maxHeight ?? undefined }}>
        <p className="text-sm text-secondary">{loadingElapsed < 5 ? 'Loading wallet...' : 'Still loading — this is taking longer than expected.'}</p>
        {loadingElapsed >= 8 && (
          <Button variant="soft" color="secondary" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (toolOutput.error && !toolOutput.address) {
    const isSessionError = toolOutput.mode === 'session_error';
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <Alert
          color="warning"
          title={isSessionError
            ? (toolOutput.error === 'unknown_session_token' ? 'Session Not Found' : 'Session Error')
            : 'Wallet Not Configured'}
          description={toolOutput.message || toolOutput.hint || (isSessionError
            ? 'Call x402_wallet with no arguments to create a new session.'
            : 'Run npx @dexterai/opendexter wallet or set DEXTER_PRIVATE_KEY environment variable.')}
        />
      </div>
    );
  }

  const isSession = Boolean(toolOutput.sessionId || toolOutput.sessionFunding);
  const usdcBalance = toolOutput.balances?.usdc ?? 0;
  const solBalance = toolOutput.balances?.sol ?? 0;
  const hasUsdc = usdcBalance > 0;
  const ready = isSession ? (toolOutput.state === 'active') : (hasUsdc && solBalance > 0.001);

  const eyebrow = isSession ? 'OpenDexter Session' : 'x402 Settlement Wallet';
  const subtitle = isSession
    ? (toolOutput.state === 'active' ? 'Session funded and ready for x402 calls.'
      : toolOutput.state === 'depleted' ? 'Session balance exhausted.'
      : 'Fund this session to start making x402 calls.')
    : 'Funding state for automated x402 execution.';

  return (
    <div data-theme={theme} ref={containerRef} className="p-4 overflow-y-auto" style={{ maxHeight: maxHeight ?? undefined }}>
      <div className="rounded-2xl border border-default bg-surface p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-tertiary uppercase tracking-wider font-semibold">{eyebrow}</span>
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-tertiary" />
              <span className="heading-lg">Wallet Overview</span>
            </div>
            <span className="text-sm text-secondary">{subtitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="soft" color="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? '...' : 'Refresh'}
            </Button>
            <Badge color="info" variant="outline">{toolOutput.networkName || 'Solana'}</Badge>
          </div>
        </div>

        {/* Wallet address */}
        {toolOutput.address && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-secondary min-w-0">
            <span className="text-sm font-mono text-primary truncate flex-1">{toolOutput.address}</span>
            <CopyButton copyValue={toolOutput.address} variant="ghost" color="secondary" size="sm">
              Copy
            </CopyButton>
          </div>
        )}

        {/* Balances */}
        <div className={`grid gap-3 ${isSession ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
          <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-secondary border border-subtle">
            <span className="text-xs text-tertiary uppercase">USDC</span>
            <span className={`heading-xl ${hasUsdc ? 'text-success' : 'text-tertiary'}`}>
              {formatUsdcDisplay(usdcBalance)}
            </span>
          </div>
          {!isSession && (
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-secondary border border-subtle">
              <span className="text-xs text-tertiary uppercase">SOL</span>
              <span className="heading-xl">{solBalance.toFixed(4)}</span>
            </div>
          )}
          {isSession && toolOutput.balances?.spentAtomic && Number(toolOutput.balances.spentAtomic) > 0 && (
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-secondary border border-subtle">
              <span className="text-xs text-tertiary uppercase">Spent</span>
              <span className="heading-xl">{formatUsdcAtomic(toolOutput.balances.spentAtomic)}</span>
            </div>
          )}
        </div>

        {/* EVM address */}
        {toolOutput.evmAddress && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-secondary border border-subtle min-w-0">
            <span className="text-xs text-tertiary flex-shrink-0">EVM ({toolOutput.evmNetwork || 'Base'})</span>
            <span className="text-xs font-mono text-secondary truncate flex-1">{toolOutput.evmAddress}</span>
            <CopyButton copyValue={toolOutput.evmAddress} variant="ghost" color="secondary" size="sm" />
          </div>
        )}

        {/* Session token details */}
        {isSession && sessionToken && (
          <SessionDetails
            sessionToken={sessionToken}
            sessionId={toolOutput.sessionId}
            expiresAt={toolOutput.expiresAt}
            walletAddress={toolOutput.address}
          />
        )}

        {/* Funding panel */}
        {isSession && toolOutput.sessionFunding && (
          <SessionFundingPanel funding={toolOutput.sessionFunding} state={toolOutput.state} />
        )}

        {/* Readiness */}
        <Alert
          color={ready ? 'success' : 'warning'}
          title={ready
            ? 'Ready for x402 execution'
            : isSession
              ? 'Awaiting session funding'
              : 'Needs funding before automated x402 execution'}
        />

        {/* Tip */}
        {toolOutput.tip && (
          <Alert color="info" variant="soft" description={toolOutput.tip} />
        )}

        <DebugPanel widgetName="x402-wallet" />
      </div>
    </div>
  );
}

const root = document.getElementById('x402-wallet-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-04.2');
  createRoot(root).render(<WalletDashboard />);
}

export default WalletDashboard;
