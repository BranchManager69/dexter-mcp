import '../styles/sdk.css';
import '../styles/widgets/passkey-onboard.css';

import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState } from 'react';
// Side-effect import: triggers initMcpAppsOnce() so the iframe runs the
// MCP Apps handshake (ui/initialize + size-changed notifications) and the
// host actually grows the iframe. Without this the widget mounts at
// height 0 and never becomes visible. Same gotcha as passkey-probe.
import '../sdk';
import { useToolOutput, useCallToolFn } from '../sdk';
import { openLink } from '../sdk/mcp-apps-bridge';

const WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';
const POLL_INTERVAL_MS = 3000;
const ENROLL_URL = 'https://dexter.cash/wallet/setup-passkey';

// ─────────────────────────────────────────────────────────────────────────────
// Tool output shape — matches what dexter_passkey returns in structuredContent.
// Mirrors the contract in docs/phase-c-contract.md.
// ─────────────────────────────────────────────────────────────────────────────

type VaultStatus =
  | 'not_enrolled'
  | 'provisioning'
  | 'ready'
  | 'user_not_paired'
  | 'error';

type PasskeyPayload = {
  vault_status: VaultStatus;
  vault_address?: string | null;
  swig_address?: string | null;
  enroll_url?: string;
  user_bound?: boolean;
  pairing_url?: string | null;
  error?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

function PasskeyOnboard() {
  const toolOutput = useToolOutput<PasskeyPayload>();
  const callTool = useCallToolFn();
  const [polling, setPolling] = useState(false);
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  // Refs so the polling effect doesn't restart on every state change.
  const pollingRef = useRef(false);
  const callToolRef = useRef(callTool);
  callToolRef.current = callTool;

  // Auto-stop polling when the user has a vault.
  useEffect(() => {
    if (toolOutput?.vault_status === 'ready' && pollingRef.current) {
      pollingRef.current = false;
      setPolling(false);
    }
  }, [toolOutput?.vault_status]);

  // Polling loop: re-invoke dexter_passkey every POLL_INTERVAL_MS while
  // polling is on. We use callTool (host's tools/call) rather than a
  // direct fetch because the host is the only thing that can actually
  // refresh structuredContent — and the auth bridge lives MCP-side.
  useEffect(() => {
    if (!polling) return;
    pollingRef.current = true;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || !pollingRef.current) return;
      try {
        await callToolRef.current('dexter_passkey', {});
      } catch {
        /* swallow — next tick will retry */
      }
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [polling]);

  const onTapEnroll = useCallback(() => {
    const url = toolOutput?.enroll_url || ENROLL_URL;
    openLink(url);
    setOpenedAt(Date.now());
    setPolling(true);
    pollingRef.current = true;
  }, [toolOutput?.enroll_url]);

  const onTapPair = useCallback(() => {
    const url = toolOutput?.pairing_url;
    if (url) openLink(url);
    setOpenedAt(Date.now());
    setPolling(true);
    pollingRef.current = true;
  }, [toolOutput?.pairing_url]);

  // Initial render before tool returns its first payload — show a
  // neutral loading frame so the iframe has something to size against.
  if (!toolOutput) {
    return (
      <div className="dx-passkey">
        <Header />
        <div className="dx-passkey__stage">
          <div className="dx-passkey__disc">
            <KeyGlyph />
          </div>
          <p className="dx-passkey__stage-supporting">Loading wallet status…</p>
        </div>
      </div>
    );
  }

  const status = toolOutput.vault_status;

  // ─── State: user_not_paired ────────────────────────────────────────────
  if (status === 'user_not_paired' || toolOutput.user_bound === false) {
    const pairingUrl = toolOutput.pairing_url;
    return (
      <div className="dx-passkey">
        <Header />
        <div className="dx-passkey__stage">
          <div className="dx-passkey__disc">
            <LinkGlyph />
          </div>
          <h2 className="dx-passkey__stage-heading">Link your Dexter account first</h2>
          <p className="dx-passkey__stage-supporting">
            Your Dexter wallet is tied to your Dexter account. Sign in to dexter.cash and the wallet will follow.
          </p>
          {pairingUrl ? (
            <button type="button" className="dx-passkey__cta" onClick={onTapPair}>
              Sign in on dexter.cash
            </button>
          ) : (
            <p className="dx-passkey__error">Couldn't mint a sign-in link. Refresh the chat and try again.</p>
          )}
        </div>
      </div>
    );
  }

  // ─── State: error ──────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="dx-passkey">
        <Header />
        <div className="dx-passkey__stage">
          <div className="dx-passkey__disc">
            <ErrorGlyph />
          </div>
          <h2 className="dx-passkey__stage-heading">Couldn't load wallet status</h2>
          <p className="dx-passkey__error">
            {toolOutput.error || 'Unexpected error reading vault status.'}
          </p>
          <button
            type="button"
            className="dx-passkey__cta dx-passkey__cta--secondary"
            onClick={() => void callTool('dexter_passkey', {})}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ─── State: ready ──────────────────────────────────────────────────────
  if (status === 'ready') {
    const vault = toolOutput.vault_address || '';
    const swig = toolOutput.swig_address || '';
    return (
      <div className="dx-passkey">
        <Header />
        <div className="dx-passkey__stage dx-passkey__stage--ready">
          <div className="dx-passkey__disc">
            <CheckGlyph />
          </div>
          <h2 className="dx-passkey__stage-heading">Your Dexter wallet is live</h2>
          <p className="dx-passkey__stage-supporting">
            Passkey-secured, on Solana mainnet. One signature controls everything.
          </p>
          <div className="dx-passkey__vault">
            {vault && (
              <div className="dx-passkey__vault-row">
                <span className="dx-passkey__vault-key">Vault</span>
                <span className="dx-passkey__vault-val">
                  <a
                    href={`https://solscan.io/account/${vault}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {abbreviateAddress(vault)}
                  </a>
                </span>
              </div>
            )}
            {swig && (
              <div className="dx-passkey__vault-row">
                <span className="dx-passkey__vault-key">Swig</span>
                <span className="dx-passkey__vault-val">
                  <a
                    href={`https://solscan.io/account/${swig}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {abbreviateAddress(swig)}
                  </a>
                </span>
              </div>
            )}
          </div>
          <div className="dx-passkey__status">
            <span className="dx-passkey__status-dot dx-passkey__status-dot--ready" />
            <span>vault active</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── State: provisioning ───────────────────────────────────────────────
  if (status === 'provisioning') {
    return (
      <div className="dx-passkey">
        <Header />
        <div className="dx-passkey__stage dx-passkey__stage--provisioning">
          <div className="dx-passkey__disc">
            <KeyGlyph />
            <div className="dx-passkey__spinner" aria-hidden>
              <span className="dx-passkey__spinner-dot" />
            </div>
          </div>
          <h2 className="dx-passkey__stage-heading">Finishing your wallet</h2>
          <p className="dx-passkey__stage-supporting">
            Passkey enrolled. Now provisioning the vault on Solana — this takes a few seconds.
          </p>
          <button
            type="button"
            className="dx-passkey__cta dx-passkey__cta--secondary"
            onClick={onTapEnroll}
          >
            Resume on dexter.cash
          </button>
          <PollStatus polling={polling} openedAt={openedAt} />
        </div>
      </div>
    );
  }

  // ─── State: not_enrolled (default) ─────────────────────────────────────
  return (
    <div className="dx-passkey">
      <Header />
      <div className="dx-passkey__stage dx-passkey__stage--not-enrolled">
        <div className="dx-passkey__disc">
          <KeyGlyph />
          <span className="dx-passkey__pulse" aria-hidden />
        </div>
        <h2 className="dx-passkey__stage-heading">Set up your Dexter wallet</h2>
        <p className="dx-passkey__stage-supporting">
          One passkey, one vault on Solana. No seed phrases, no extensions. Tap to start the ceremony at dexter.cash.
        </p>
        <button type="button" className="dx-passkey__cta" onClick={onTapEnroll}>
          Set up wallet on dexter.cash
        </button>
        <PollStatus polling={polling} openedAt={openedAt} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="dx-passkey__header">
      <img src={WORDMARK_URL} alt="Dexter" className="dx-passkey__wordmark" />
      <div className="dx-passkey__eyebrow">passkey wallet</div>
    </div>
  );
}

function PollStatus({ polling, openedAt }: { polling: boolean; openedAt: number | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [polling]);

  if (!polling) return null;
  const elapsed = openedAt ? Math.max(0, Math.floor((Date.now() - openedAt) / 1000)) : 0;
  return (
    <div className="dx-passkey__status">
      <span className="dx-passkey__status-dot dx-passkey__status-dot--polling" />
      <span>watching for completion · {elapsed}s</span>
    </div>
  );
}

function abbreviateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Glyphs — quiet inline SVGs, no external assets
// ─────────────────────────────────────────────────────────────────────────────

function KeyGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="dx-passkey__disc-glyph" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17" cy="24" r="7" />
      <path d="M24 24 L40 24" />
      <path d="M36 24 L36 30" />
      <path d="M40 24 L40 28" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="dx-passkey__disc-glyph" fill="none" stroke="var(--dx-success)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="18" stroke="currentColor" />
      <path d="M16 24 L22 30 L34 18" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="dx-passkey__disc-glyph" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 28 L28 20" />
      <path d="M16 32 a 6 6 0 0 1 0 -8 l 4 -4" />
      <path d="M32 16 a 6 6 0 0 1 0 8 l -4 4" />
    </svg>
  );
}

function ErrorGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="dx-passkey__disc-glyph" fill="none" stroke="var(--dx-danger)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="18" stroke="currentColor" />
      <path d="M24 16 L24 26" />
      <circle cx="24" cy="32" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('passkey-onboard-root');
if (root) {
  createRoot(root).render(<PasskeyOnboard />);
}

export default PasskeyOnboard;
