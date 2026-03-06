import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { Alert } from '@openai/apps-sdk-ui/components/Alert';
import { Globe } from '@openai/apps-sdk-ui/components/Icon';
import { useOpenAIGlobal, useMaxHeight, useTheme, useCallToolFn, useOpenExternal } from '../sdk';
import { ChainIcon, UsdcIcon, useIntrinsicHeight, DebugPanel, normalizeWalletPayload, type WalletChainBalance } from '../components/x402';

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

function formatUsdcDisplay(value: number): string {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

function formatAtomicUsdc(atomic: string): string {
  const n = Number(atomic) / 1e6;
  return formatUsdcDisplay(n);
}

function ChainBalanceRow({ caip2, balance }: { caip2: string; balance: WalletChainBalance }) {
  const amount = Number(balance.available) / 1e6;
  const hasFunds = amount > 0;
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <ChainIcon network={caip2} size={20} />
      <span className="text-sm flex-1">{balance.name}</span>
      <span className={`text-sm font-semibold tabular-nums ${hasFunds ? 'text-success' : 'text-tertiary'}`}>
        {formatUsdcDisplay(amount)}
      </span>
    </div>
  );
}

function DepositPanel({ solanaAddress, evmAddress, funding }: {
  solanaAddress?: string;
  evmAddress?: string;
  funding?: SessionFunding;
}) {
  const openExternal = useOpenExternal();
  const qrUrl = funding?.solanaPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(funding.solanaPayUrl)}`
    : null;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-tertiary uppercase font-semibold text-center">Deposit USDC</span>

      {/* Solana deposit */}
      {solanaAddress && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ChainIcon network="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" size={16} />
            <span className="text-xs font-semibold">Solana</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-secondary truncate flex-1">{solanaAddress}</span>
            <CopyButton copyValue={solanaAddress} variant="ghost" color="secondary" size="sm" />
          </div>
          {qrUrl && (
            <div className="flex justify-center">
              <div className="p-2 bg-white rounded-lg inline-block">
                <img src={qrUrl} alt="Solana Pay QR" width={120} height={120} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            {funding?.txUrl && (
              <Button variant="soft" color="secondary" size="sm" block onClick={() => openExternal(funding.txUrl!)}>
                Open Funding Page
              </Button>
            )}
          </div>
        </div>
      )}

      {/* EVM deposit */}
      {evmAddress && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ChainIcon network="eip155:8453" size={16} />
            <span className="text-xs font-semibold">EVM Chains</span>
            <span className="text-3xs text-tertiary">(Base, Polygon, Arbitrum, Optimism, Avalanche)</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-secondary truncate flex-1">{evmAddress}</span>
            <CopyButton copyValue={evmAddress} variant="ghost" color="secondary" size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}

function SessionDetails({ sessionToken, sessionId, expiresAt }: {
  sessionToken: string;
  sessionId?: string;
  expiresAt?: string | null;
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
          <span className="text-3xs text-tertiary">
            Session ID is a reference identifier. Session Token is the secret credential used to resume the session.
          </span>
          {sessionId && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-tertiary w-16 flex-shrink-0">Session ID</span>
              <span className="text-xs font-mono text-secondary truncate flex-1">{sessionId}</span>
              <CopyButton copyValue={sessionId} variant="ghost" color="secondary" size="sm" />
            </div>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-tertiary w-16 flex-shrink-0">Token</span>
            <span className="text-xs font-mono text-secondary truncate flex-1">{sessionToken}</span>
            <CopyButton copyValue={sessionToken} variant="ghost" color="secondary" size="sm" />
          </div>
          {expiresAt && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-tertiary w-10 flex-shrink-0">Exp</span>
              <span className="text-xs text-secondary">{new Date(expiresAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WalletDashboard() {
  const rawToolOutput = useOpenAIGlobal('toolOutput') as Record<string, unknown> | null;
  const toolMeta = useOpenAIGlobal('toolResponseMetadata') as Record<string, unknown> | null;
  const widgetState = useOpenAIGlobal('widgetState') as { sessionToken?: string } | null;
  const theme = useTheme();
  const callTool = useCallToolFn();
  const maxHeight = useMaxHeight();
  const containerRef = useIntrinsicHeight();
  const [refreshing, setRefreshing] = useState(false);

  // Multiple wallet producers existed before the canonical contract landed.
  // Normalize here so ChatGPT can render legacy, transitional, and canonical
  // payloads while server-side producers converge on one stable shape.
  const toolOutput = normalizeWalletPayload(rawToolOutput);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const metaToken = (toolMeta as any)?.sessionToken as string | undefined;
  const storedToken = widgetState?.sessionToken;
  const sessionToken = metaToken || storedToken;

  useEffect(() => {
    // Widget state is only a client-side convenience cache for follow-up calls.
    // The server-side session resolution result remains the source of truth.
    if (sessionToken && sessionToken !== storedToken) {
      try { (window as any).openai?.setWidgetState?.({ sessionToken }); } catch {}
    }
  }, [sessionToken, storedToken]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await callTool('x402_wallet', sessionToken ? { sessionToken } : {}); }
    finally { setRefreshing(false); }
  };

  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (rawToolOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [rawToolOutput]);

  if (!rawToolOutput) {
    return (
      <div data-theme={theme} className="p-4 flex flex-col gap-2" style={{ maxHeight: maxHeight ?? undefined }}>
        <p className="text-sm text-secondary">{loadingElapsed < 5 ? 'Loading wallet...' : 'Still loading — this is taking longer than expected.'}</p>
        {loadingElapsed >= 8 && (
          <Button variant="soft" color="secondary" size="sm" onClick={() => window.location.reload()}>Retry</Button>
        )}
      </div>
    );
  }

  if (toolOutput.error && !toolOutput.solanaAddress && !toolOutput.address) {
    const isSessionError = toolOutput.mode === 'session_error';
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <Alert
          color="warning"
          title={isSessionError
            ? (toolOutput.error === 'unknown_session_token' ? 'Session Not Found' : 'Session Error')
            : 'Wallet Not Configured'}
          description={toolOutput.message || toolOutput.hint || toolOutput.tip || (isSessionError
            ? 'Call x402_wallet with no arguments to create a new session.'
            : 'Open the wallet tool on the active MCP surface to create or resolve a usable x402 wallet.')}
        />
      </div>
    );
  }

  const isSession = Boolean(toolOutput.sessionId || toolOutput.sessionFunding);
  const chainBals = toolOutput.chainBalances || {};
  const totalUsdc = toolOutput.balances?.usdc ?? 0;
  const hasAnyFunds = totalUsdc > 0;
  const ready = isSession ? (toolOutput.state === 'active') : hasAnyFunds;
  const sessionResolution = toolOutput.sessionResolution?.mode;

  const solanaAddress = toolOutput.solanaAddress || toolOutput.address;
  const evmAddress = toolOutput.evmAddress;

  const firstClassChains = Object.entries(chainBals).filter(([, b]) => b.tier === 'first');
  const secondClassFunded = Object.entries(chainBals).filter(([, b]) => b.tier === 'second' && Number(b.available) > 0);

  return (
    <div data-theme={theme} ref={containerRef} className="p-4 overflow-y-auto" style={{ maxHeight: maxHeight ?? undefined }}>
      <div className="rounded-2xl border border-default bg-surface p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-tertiary uppercase tracking-wider font-semibold">
              {isSession ? 'OpenDexter Session' : 'x402 Settlement Wallet'}
            </span>
            <span className="heading-lg">Wallet Overview</span>
          </div>
          <Button variant="soft" color="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? '...' : 'Refresh'}
          </Button>
        </div>

        {/* Total balance */}
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-surface-secondary">
          <UsdcIcon size={24} />
          <span className="text-xs text-tertiary uppercase flex-1">Total Available</span>
          <span className={`heading-xl ${hasAnyFunds ? 'text-success' : 'text-tertiary'}`}>
            {formatUsdcDisplay(totalUsdc)}
          </span>
        </div>

        {/* Per-chain balances */}
        {(firstClassChains.length > 0 || secondClassFunded.length > 0) && (
          <div className="rounded-xl bg-surface-secondary overflow-hidden divide-y divide-subtle">
            {firstClassChains.map(([caip2, bal]) => (
              <ChainBalanceRow key={caip2} caip2={caip2} balance={bal} />
            ))}
            {secondClassFunded.map(([caip2, bal]) => (
              <ChainBalanceRow key={caip2} caip2={caip2} balance={bal} />
            ))}
          </div>
        )}

        {/* Session details */}
        {isSession && sessionToken && (
          <SessionDetails sessionToken={sessionToken} sessionId={toolOutput.sessionId} expiresAt={toolOutput.expiresAt} />
        )}

        {isSession && sessionResolution && (
          <Alert
            color={sessionResolution === 'created_new' ? 'info' : 'success'}
            variant="soft"
            title={
              sessionResolution === 'created_new'
                ? 'New session created'
                : sessionResolution === 'resumed_from_context'
                  ? 'Resumed from conversation'
                  : sessionResolution === 'resumed_from_token'
                    ? 'Resumed from session token'
                    : 'Session resolved'
            }
            description={
              sessionResolution === 'created_new'
                ? 'No reusable session was found for this conversation, so OpenDexter created a new one.'
                : sessionResolution === 'resumed_from_context'
                  ? 'OpenDexter reused the session already bound to this conversation.'
                  : sessionResolution === 'resumed_from_token'
                    ? 'OpenDexter resumed the session from the provided secret token.'
                    : toolOutput.sessionResolution?.reason
            }
          />
        )}

        {/* Deposit section */}
        {isSession && (
          <DepositPanel
            solanaAddress={solanaAddress}
            evmAddress={evmAddress}
            funding={toolOutput.sessionFunding as SessionFunding | undefined}
          />
        )}

        {/* Readiness */}
        <Alert
          color={ready ? 'success' : 'warning'}
          title={ready
            ? 'Ready for x402 execution'
            : isSession ? 'Awaiting funding on any chain' : 'Needs funding'}
        />

        {toolOutput.tip && <Alert color="info" variant="soft" description={toolOutput.tip} />}
        <DebugPanel widgetName="x402-wallet" />
      </div>
    </div>
  );
}

const root = document.getElementById('x402-wallet-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-05.1');
  createRoot(root).render(<WalletDashboard />);
}

export default WalletDashboard;
