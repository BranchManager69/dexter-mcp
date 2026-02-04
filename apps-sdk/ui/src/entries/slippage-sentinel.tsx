import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/slippage-sentinel.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SlippagePayload = {
  mint?: string;
  symbol?: string;
  name?: string;
  recommendedSlippageBps?: number;
  recommended_slippage_bps?: number;
  minSlippageBps?: number;
  min_slippage_bps?: number;
  maxSlippageBps?: number;
  max_slippage_bps?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'extreme';
  risk_level?: string;
  volatility24h?: number;
  volatility_24h?: number;
  liquidityScore?: number;
  liquidity_score?: number;
  avgSpread?: number;
  avg_spread?: number;
  depthUsd?: number;
  depth_usd?: number;
  reasoning?: string;
  warnings?: string[];
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getRiskColor(level?: string): string {
  switch (level?.toLowerCase()) {
    case 'low': return 'sentinel-risk--low';
    case 'medium': return 'sentinel-risk--medium';
    case 'high': return 'sentinel-risk--high';
    case 'extreme': return 'sentinel-risk--extreme';
    default: return '';
  }
}

function formatBps(bps?: number): string {
  if (!bps || !Number.isFinite(bps)) return '—';
  return `${(bps / 100).toFixed(2)}%`;
}

function formatLargeNumber(value?: number): string {
  if (!value || !Number.isFinite(value)) return '—';
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function SlippageSentinel() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SlippagePayload | null;

  if (!toolOutput) {
    return (
      <div className="sentinel-container">
        <div className="sentinel-loading">
          <div className="sentinel-loading__spinner" />
          <span>Analyzing slippage...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="sentinel-container">
        <div className="sentinel-error">{toolOutput.error}</div>
      </div>
    );
  }

  const recommended = toolOutput.recommendedSlippageBps || toolOutput.recommended_slippage_bps;
  const min = toolOutput.minSlippageBps || toolOutput.min_slippage_bps;
  const max = toolOutput.maxSlippageBps || toolOutput.max_slippage_bps;
  const risk = toolOutput.riskLevel || toolOutput.risk_level;
  const volatility = toolOutput.volatility24h || toolOutput.volatility_24h;
  const liquidity = toolOutput.liquidityScore || toolOutput.liquidity_score;
  const spread = toolOutput.avgSpread || toolOutput.avg_spread;
  const depth = toolOutput.depthUsd || toolOutput.depth_usd;

  return (
    <div className="sentinel-container">
      <div className="sentinel-card">
        {/* Header */}
        <div className="sentinel-header">
          <div className="sentinel-header-left">
            <span className="sentinel-icon">🛡️</span>
            <span className="sentinel-title">Slippage Sentinel</span>
          </div>
          {risk && (
            <span className={`sentinel-badge ${getRiskColor(risk)}`}>
              {risk.toUpperCase()} RISK
            </span>
          )}
        </div>

        {/* Token Info */}
        {(toolOutput.symbol || toolOutput.name) && (
          <div className="sentinel-token">
            <span className="sentinel-token__symbol">{toolOutput.symbol}</span>
            {toolOutput.name && <span className="sentinel-token__name">{toolOutput.name}</span>}
          </div>
        )}

        {/* Recommended Slippage */}
        <div className="sentinel-recommendation">
          <span className="sentinel-recommendation__label">RECOMMENDED SLIPPAGE</span>
          <span className="sentinel-recommendation__value">{formatBps(recommended)}</span>
          {(min || max) && (
            <span className="sentinel-recommendation__range">
              Range: {formatBps(min)} – {formatBps(max)}
            </span>
          )}
        </div>

        {/* Metrics */}
        <div className="sentinel-metrics">
          {volatility != null && (
            <div className="sentinel-metric">
              <span className="sentinel-metric__label">24h Volatility</span>
              <span className="sentinel-metric__value">{volatility.toFixed(2)}%</span>
            </div>
          )}
          {liquidity != null && (
            <div className="sentinel-metric">
              <span className="sentinel-metric__label">Liquidity Score</span>
              <span className="sentinel-metric__value">{liquidity.toFixed(1)}/10</span>
            </div>
          )}
          {spread != null && (
            <div className="sentinel-metric">
              <span className="sentinel-metric__label">Avg Spread</span>
              <span className="sentinel-metric__value">{(spread * 100).toFixed(3)}%</span>
            </div>
          )}
          {depth != null && (
            <div className="sentinel-metric">
              <span className="sentinel-metric__label">Depth (±2%)</span>
              <span className="sentinel-metric__value">{formatLargeNumber(depth)}</span>
            </div>
          )}
        </div>

        {/* Reasoning */}
        {toolOutput.reasoning && (
          <div className="sentinel-reasoning">
            <span className="sentinel-reasoning__label">ANALYSIS</span>
            <p className="sentinel-reasoning__text">{toolOutput.reasoning}</p>
          </div>
        )}

        {/* Warnings */}
        {toolOutput.warnings && toolOutput.warnings.length > 0 && (
          <div className="sentinel-warnings">
            {toolOutput.warnings.map((warning, idx) => (
              <div key={idx} className="sentinel-warning">
                <span className="sentinel-warning__icon">⚠️</span>
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('slippage-sentinel-root');
if (root) {
  createRoot(root).render(<SlippageSentinel />);
}

export default SlippageSentinel;
