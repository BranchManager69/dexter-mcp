import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-stats.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FacilitatorStats = {
  name?: string;
  url?: string;
  transactions?: number;
  volume?: number;
  active_agents?: number;
  health?: 'healthy' | 'degraded' | 'down';
};

type AgentStats = {
  id?: string;
  name?: string;
  transactions?: number;
  volume?: number;
};

type X402StatsPayload = {
  network_summary?: {
    total_transactions?: number;
    total_volume?: number;
    active_facilitators?: number;
    active_resource_servers?: number;
    active_agents?: number;
    active_origins?: number;
  };
  facilitators?: FacilitatorStats[];
  top_agents?: AgentStats[];
  top_servers?: Array<{ url?: string; transactions?: number }>;
  fetchedAt?: string;
  fetched_at?: string;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatVolume(value?: number): string {
  if (!value || !Number.isFinite(value)) return '$0';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatNumber(value?: number): string {
  if (!value || !Number.isFinite(value)) return '0';
  return value.toLocaleString();
}

function getHealthClass(health?: string): string {
  switch (health) {
    case 'healthy': return 'x402-health--healthy';
    case 'degraded': return 'x402-health--degraded';
    case 'down': return 'x402-health--down';
    default: return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function X402Stats() {
  const toolOutput = useOpenAIGlobal('toolOutput') as X402StatsPayload | null;

  if (!toolOutput) {
    return (
      <div className="x402-container">
        <div className="x402-loading">
          <div className="x402-loading__spinner" />
          <span>Loading network stats...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="x402-container">
        <div className="x402-error">{toolOutput.error}</div>
      </div>
    );
  }

  const summary = toolOutput.network_summary;
  const facilitators = toolOutput.facilitators || [];
  const topAgents = toolOutput.top_agents || [];
  const fetchedAt = toolOutput.fetchedAt || toolOutput.fetched_at;

  return (
    <div className="x402-container">
      <div className="x402-card">
        {/* Header */}
        <div className="x402-header">
          <div className="x402-header-left">
            <span className="x402-icon">💳</span>
            <span className="x402-title">x402 Network Stats</span>
          </div>
          {fetchedAt && (
            <span className="x402-timestamp">{new Date(fetchedAt).toLocaleTimeString()}</span>
          )}
        </div>

        {/* Network Summary */}
        {summary && (
          <div className="x402-summary">
            <div className="x402-summary__grid">
              <div className="x402-summary__item">
                <span className="x402-summary__value">{formatNumber(summary.total_transactions)}</span>
                <span className="x402-summary__label">Transactions</span>
              </div>
              <div className="x402-summary__item">
                <span className="x402-summary__value">{formatVolume(summary.total_volume)}</span>
                <span className="x402-summary__label">Volume</span>
              </div>
              <div className="x402-summary__item">
                <span className="x402-summary__value">{formatNumber(summary.active_facilitators)}</span>
                <span className="x402-summary__label">Facilitators</span>
              </div>
              <div className="x402-summary__item">
                <span className="x402-summary__value">{formatNumber(summary.active_agents)}</span>
                <span className="x402-summary__label">Active Agents</span>
              </div>
            </div>
          </div>
        )}

        {/* Facilitators */}
        {facilitators.length > 0 && (
          <div className="x402-section">
            <span className="x402-section__title">FACILITATORS</span>
            <div className="x402-facilitators">
              {facilitators.map((f, idx) => (
                <div key={idx} className="x402-facilitator">
                  <div className="x402-facilitator__header">
                    <span className="x402-facilitator__name">{f.name || 'Unknown'}</span>
                    {f.health && (
                      <span className={`x402-facilitator__health ${getHealthClass(f.health)}`}>
                        {f.health}
                      </span>
                    )}
                  </div>
                  <div className="x402-facilitator__stats">
                    <span>{formatNumber(f.transactions)} txns</span>
                    <span>{formatVolume(f.volume)}</span>
                    {f.active_agents && <span>{f.active_agents} agents</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Agents */}
        {topAgents.length > 0 && (
          <div className="x402-section">
            <span className="x402-section__title">TOP AGENTS</span>
            <div className="x402-agents">
              {topAgents.slice(0, 5).map((agent, idx) => (
                <div key={idx} className="x402-agent">
                  <span className="x402-agent__rank">#{idx + 1}</span>
                  <span className="x402-agent__name">{agent.name || agent.id || 'Unknown'}</span>
                  <span className="x402-agent__volume">{formatVolume(agent.volume)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('x402-stats-root');
if (root) {
  createRoot(root).render(<X402Stats />);
}

export default X402Stats;
