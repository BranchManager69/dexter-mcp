import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/media-jobs.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

type MediaJob = {
  id: string;
  jobType?: string;
  status?: string;
  costCents?: number;
  createdAt?: string;
  requestPayload?: {
    prompt?: string;
    seconds?: number;
    resolution?: string;
    model?: string;
    tokens?: Array<{ symbol?: string; mint?: string }>;
  };
  resultPayload?: {
    artifacts?: Array<{
      url?: string;
      mimeType?: string;
    }>;
  } | null;
  errorMessage?: string | null;
  statusUrl?: string | null;
};

type MediaJobPayload = {
  ok?: boolean;
  error?: string;
  job?: MediaJob;
  pricing?: {
    chargeCents?: number;
    chargeUsd?: number;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(timestamp?: string | null): string {
  if (!timestamp) return '—';
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

function truncatePrompt(prompt?: string, maxLen = 150): string {
  if (!prompt) return '—';
  if (prompt.length <= maxLen) return prompt;
  return prompt.slice(0, maxLen) + '...';
}

function detectJobType(job: MediaJob): 'video' | 'image' {
  if (job.jobType?.toLowerCase().includes('sora') || job.jobType?.toLowerCase().includes('video')) {
    return 'video';
  }
  return 'image';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function MediaJobs() {
  const toolOutput = useOpenAIGlobal('toolOutput') as MediaJobPayload | null;

  if (!toolOutput) {
    return (
      <div className="media-container">
        <div className="media-loading">
          <div className="media-loading__spinner" />
          <span>Loading job...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error || toolOutput.ok === false) {
    return (
      <div className="media-container">
        <div className="media-error">{toolOutput.error || 'Job creation failed'}</div>
      </div>
    );
  }

  const job = toolOutput.job;
  if (!job) {
    return (
      <div className="media-container">
        <div className="media-error">No job data returned</div>
      </div>
    );
  }

  const status = (job.status || 'pending') as JobStatus;
  const jobType = detectJobType(job);
  const artifacts = job.resultPayload?.artifacts || [];
  const hasArtifacts = artifacts.length > 0;
  const pricing = toolOutput.pricing;
  const costUsd = pricing?.chargeUsd || (job.costCents ? job.costCents / 100 : null);

  return (
    <div className="media-container">
      <div className="media-card">
        {/* Header */}
        <div className="media-header">
          <div className="media-header-left">
            <span className="media-icon">{jobType === 'video' ? '🎬' : '🖼️'}</span>
            <span className="media-title">
              {jobType === 'video' ? 'Sora Video Job' : 'Meme Generator Job'}
            </span>
          </div>
          <span className={`media-badge media-badge--${status}`}>
            {status === 'running' && <span className="media-badge__spin">↻</span>}
            {status === 'completed' && '✓'}
            {status === 'failed' && '✕'}
            {status === 'pending' && '◷'}
            {status}
          </span>
        </div>

        {/* Preview */}
        {hasArtifacts ? (
          <div className="media-preview">
            {jobType === 'video' ? (
              <video
                src={artifacts[0].url}
                controls
                className="media-preview__video"
              >
                Your browser does not support video playback.
              </video>
            ) : (
              <img
                src={artifacts[0].url}
                alt="Generated media"
                className="media-preview__image"
              />
            )}
            {artifacts.length > 1 && (
              <span className="media-preview__count">{artifacts.length} files</span>
            )}
          </div>
        ) : (
          <div className={`media-placeholder media-placeholder--${jobType}`}>
            <span className="media-placeholder__icon">
              {jobType === 'video' ? '🎬' : '🖼️'}
            </span>
            <span className="media-placeholder__text">
              {status === 'completed' ? 'Generation complete' : 'Processing...'}
            </span>
            {status === 'running' && <div className="media-placeholder__progress" />}
          </div>
        )}

        {/* Prompt */}
        {job.requestPayload?.prompt && (
          <div className="media-prompt">
            <span className="media-prompt__label">PROMPT</span>
            <p className="media-prompt__text">{truncatePrompt(job.requestPayload.prompt, 300)}</p>
          </div>
        )}

        {/* Metrics */}
        <div className="media-metrics">
          <div className="media-metric">
            <span className="media-metric__label">STATUS</span>
            <span className="media-metric__value">{status.toUpperCase()}</span>
          </div>
          {jobType === 'video' && job.requestPayload?.seconds && (
            <div className="media-metric">
              <span className="media-metric__label">DURATION</span>
              <span className="media-metric__value">{job.requestPayload.seconds}s</span>
            </div>
          )}
          {job.requestPayload?.resolution && (
            <div className="media-metric">
              <span className="media-metric__label">RESOLUTION</span>
              <span className="media-metric__value">{job.requestPayload.resolution}</span>
            </div>
          )}
          <div className="media-metric">
            <span className="media-metric__label">CREATED</span>
            <span className="media-metric__value">{formatTime(job.createdAt)}</span>
          </div>
        </div>

        {/* Tokens for meme jobs */}
        {jobType === 'image' && job.requestPayload?.tokens && job.requestPayload.tokens.length > 0 && (
          <div className="media-tokens">
            <span className="media-tokens__label">TOKENS</span>
            <div className="media-tokens__list">
              {job.requestPayload.tokens.map((token, idx) => (
                <span key={idx} className="media-tokens__item">
                  {token.symbol || token.mint?.slice(0, 8) || 'Unknown'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pricing */}
        {costUsd && (
          <div className="media-pricing">
            <span className="media-pricing__label">Cost</span>
            <span className="media-pricing__value">${costUsd.toFixed(2)}</span>
          </div>
        )}

        {/* Error */}
        {job.errorMessage && (
          <div className="media-error-box">
            <span className="media-error-box__icon">✕</span>
            <p>{job.errorMessage}</p>
          </div>
        )}

        {/* Footer */}
        <div className="media-footer">
          <code className="media-footer__id">{job.id}</code>
          {job.statusUrl && (
            <a href={job.statusUrl} target="_blank" rel="noreferrer" className="media-footer__link">
              View Job ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('media-jobs-root');
if (root) {
  createRoot(root).render(<MediaJobs />);
}

export default MediaJobs;
