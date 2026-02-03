import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/codex.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CodexPayload = {
  conversationId?: string;
  response?: {
    text?: string;
    reasoning?: string;
  };
  session?: {
    model?: string;
    reasoningEffort?: string;
  };
  durationMs?: number;
  tokenUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  ok?: boolean;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function Codex() {
  const toolOutput = useOpenAIGlobal('toolOutput') as CodexPayload | null;

  if (!toolOutput) {
    return (
      <div className="codex-container">
        <div className="codex-loading">
          <div className="codex-loading__spinner" />
          <span>Processing...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error || toolOutput.ok === false) {
    return (
      <div className="codex-container">
        <div className="codex-error">{toolOutput.error || 'Session failed'}</div>
      </div>
    );
  }

  const message = toolOutput.response?.text?.trim();
  const reasoning = toolOutput.response?.reasoning?.trim();
  const model = toolOutput.session?.model;
  const effort = toolOutput.session?.reasoningEffort;
  const durationMs = toolOutput.durationMs;
  const tokens = toolOutput.tokenUsage;

  return (
    <div className="codex-container">
      <div className="codex-card">
        {/* Scanline effect */}
        <div className="codex-scanlines" />

        {/* Header */}
        <div className="codex-header">
          <div className="codex-header-left">
            <span className="codex-icon">⚡</span>
            <span className="codex-title">Codex Session</span>
          </div>
          <span className="codex-badge">Session Active</span>
        </div>

        {/* Metrics */}
        {(model || effort || durationMs) && (
          <div className="codex-metrics">
            {model && (
              <div className="codex-metric">
                <span className="codex-metric__label">MODEL</span>
                <span className="codex-metric__value">{model}</span>
              </div>
            )}
            {effort && (
              <div className="codex-metric">
                <span className="codex-metric__label">EFFORT</span>
                <span className="codex-metric__value">{effort}</span>
              </div>
            )}
            {durationMs !== undefined && (
              <div className="codex-metric">
                <span className="codex-metric__label">DURATION</span>
                <span className="codex-metric__value">{(durationMs / 1000).toFixed(2)}s</span>
              </div>
            )}
          </div>
        )}

        {/* Reasoning */}
        {reasoning && (
          <div className="codex-section codex-section--reasoning">
            <div className="codex-section-header">
              <span className="codex-section-title">Reasoning Trail</span>
              <span className="codex-pulse" />
            </div>
            <p className="codex-reasoning-text">
              {reasoning}
              <span className="codex-cursor" />
            </p>
          </div>
        )}

        {/* Output */}
        {message && (
          <div className="codex-section codex-section--output">
            <span className="codex-section-title">Output</span>
            <pre className="codex-output-text">
              {message}
              <span className="codex-cursor codex-cursor--dim" />
            </pre>
          </div>
        )}

        {/* Token Usage */}
        {tokens && (
          <div className="codex-tokens">
            <div className="codex-token">
              <span className="codex-token__label">PROMPT</span>
              <span className="codex-token__value">{tokens.prompt_tokens ?? 0}</span>
            </div>
            <div className="codex-token">
              <span className="codex-token__label">COMPLETION</span>
              <span className="codex-token__value">{tokens.completion_tokens ?? 0}</span>
            </div>
            <div className="codex-token">
              <span className="codex-token__label">TOTAL</span>
              <span className="codex-token__value">{tokens.total_tokens ?? 0}</span>
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

const root = document.getElementById('codex-root');
if (root) {
  createRoot(root).render(<Codex />);
}

export default Codex;
