import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-pricing.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal, useCallTool, useToolInput } from '../sdk';

type PaymentOption = {
  price: number;
  priceFormatted: string;
  network: string;
  scheme: string;
  asset: string;
  payTo: string;
};

type PricingPayload = {
  requiresPayment?: boolean;
  statusCode: number;
  x402Version?: number;
  paymentOptions?: PaymentOption[];
  resource?: unknown;
  free?: boolean;
  error?: boolean | string;
  message?: string;
};

const CHAIN_MAP: Record<string, { name: string; icon: string }> = {
  'solana': { name: 'Solana', icon: '◎' },
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': { name: 'Solana', icon: '◎' },
  'eip155:8453': { name: 'Base', icon: '🔵' },
  'base': { name: 'Base', icon: '🔵' },
  'eip155:137': { name: 'Polygon', icon: '🟣' },
  'polygon': { name: 'Polygon', icon: '🟣' },
  'eip155:42161': { name: 'Arbitrum', icon: '🔷' },
  'eip155:10': { name: 'Optimism', icon: '🔴' },
  'eip155:43114': { name: 'Avalanche', icon: '🔺' },
  'eip155:2046399126': { name: 'SKALE', icon: '⬡' },
};

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function PricingCheck() {
  const toolOutput = useOpenAIGlobal('toolOutput') as PricingPayload | null;
  const toolInput = useToolInput() as { url?: string } | null;
  const { callTool, isLoading } = useCallTool();

  if (!toolOutput) {
    return <div className="pricing"><div className="pricing-card"><span>Checking endpoint...</span></div></div>;
  }

  if (toolOutput.error) {
    return (
      <div className="pricing">
        <div className="pricing-card">
          <div className="pricing-header">
            <span className="pricing-header__title">Endpoint Check</span>
            <span className="pricing-badge pricing-badge--error">Error {toolOutput.statusCode}</span>
          </div>
          <div className="pricing-error">{toolOutput.message || 'Failed to check endpoint'}</div>
        </div>
      </div>
    );
  }

  if (toolOutput.free || (!toolOutput.requiresPayment && toolOutput.statusCode >= 200 && toolOutput.statusCode < 300)) {
    return (
      <div className="pricing">
        <div className="pricing-card">
          <div className="pricing-header">
            <span className="pricing-header__title">Endpoint Check</span>
            <span className="pricing-badge pricing-badge--free">✓ Free</span>
          </div>
          <div className="pricing-free">
            <span className="pricing-free__icon">✅</span>
            <span className="pricing-free__text">No payment required — this endpoint is free to use.</span>
          </div>
        </div>
      </div>
    );
  }

  const options = toolOutput.paymentOptions || [];

  const handleFetch = () => {
    if (!toolInput?.url) return;
    callTool('x402_fetch', { url: toolInput.url, method: 'POST' });
  };

  return (
    <div className="pricing">
      <div className="pricing-card">
        <div className="pricing-header">
          <span className="pricing-header__title">Payment Required</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {toolOutput.x402Version && (
              <span className="pricing-badge pricing-badge--version">x402 v{toolOutput.x402Version}</span>
            )}
            <span className="pricing-badge pricing-badge--paid">402</span>
          </div>
        </div>

        {toolInput?.url && <div className="pricing-resource">{toolInput.url}</div>}

        <div className="pricing-options">
          {options.map((opt, i) => {
            const chain = CHAIN_MAP[opt.network] || { name: opt.network, icon: '⬡' };
            return (
              <div key={i} className="pricing-option">
                <div className="pricing-option__chain">{chain.icon}</div>
                <div className="pricing-option__info">
                  <span className="pricing-option__network">{chain.name}</span>
                  <span className="pricing-option__asset">USDC</span>
                  <span className="pricing-option__payto">{shortenAddress(opt.payTo)}</span>
                </div>
                <span className="pricing-option__price">{opt.priceFormatted}</span>
              </div>
            );
          })}
        </div>

        {toolInput?.url && (
          <button className="pricing-fetch-btn" onClick={handleFetch} disabled={isLoading}>
            {isLoading ? 'Paying...' : `Fetch & Pay${options[0] ? ` ${options[0].priceFormatted}` : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}

const root = document.getElementById('x402-pricing-root');
if (root) createRoot(root).render(<PricingCheck />);

export default PricingCheck;
