import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/async-job.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types (generic async job - spaces, code-interpreter, deep-research)
// ─────────────────────────────────────────────────────────────────────────────

type JobPayload = {
  jobId?: string;
  job_id?: string;
  id?: string;
  type?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  result?: string | object;
  output?: string | object;
  error?: string;
  createdAt?: string;
  created_at?: string;
  completedAt?: string;
  completed_at?: string;
  durationMs?: number;
  duration_ms?: number;
  // Spaces specific
  spaceId?: string;
  space_id?: string;
  spaceName?: string;
  space_name?: string;
  // Code interpreter specific
  code?: string;
  language?: string;
  // Deep research specific
  query?: string;
  sources?: Array<{ title?: string; url?: string }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function detectJobType(payload: JobPayload): string {
  if (payload.type) return payload.type;
  if (payload.spaceId || payload.space_id || payload.spaceName) return 'spaces';
  if (payload.code || payload.language) return 'code-interpreter';
  if (payload.query || payload.sources) return 'deep-research';
  return 'async-job';
}

function getJobIcon(type: string): string {
  switch (type) {
    case 'spaces': return '🎙️';
    case 'code-interpreter': return '💻';
    case 'deep-research': return '🔬';
    default: return '⚙️';
  }
}

function getJobTitle(type: string): string {
  switch (type) {
    case 'spaces': return 'Twitter Spaces Job';
    case 'code-interpreter': return 'Code Execution';
    case 'deep-research': return 'Deep Research';
    default: return 'Async Job';
  }
}

function getStatusClass(status?: string): string {
  switch (status) {
    case 'completed': return 'job-status--completed';
    case 'running': return 'job-status--running';
    case 'queued': return 'job-status--queued';
    case 'failed': return 'job-status--failed';
    case 'cancelled': return 'job-status--cancelled';
    default: return '';
  }
}

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.floor(secs % 60);
  return `${mins}m ${remainingSecs}s`;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function AsyncJob() {
  const toolOutput = useOpenAIGlobal('toolOutput') as JobPayload | null;

  if (!toolOutput) {
    return (
      <div className="job-container">
        <div className="job-loading">
          <div className="job-loading__spinner" />
          <span>Loading job...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="job-container">
        <div className="job-error">{toolOutput.error}</div>
      </div>
    );
  }

  const jobType = detectJobType(toolOutput);
  const jobId = toolOutput.jobId || toolOutput.job_id || toolOutput.id;
  const created = toolOutput.createdAt || toolOutput.created_at;
  const completed = toolOutput.completedAt || toolOutput.completed_at;
  const duration = toolOutput.durationMs || toolOutput.duration_ms;
  const spaceName = toolOutput.spaceName || toolOutput.space_name;
  const result = toolOutput.result || toolOutput.output;

  return (
    <div className="job-container">
      <div className="job-card">
        {/* Header */}
        <div className="job-header">
          <div className="job-header-left">
            <span className="job-icon">{getJobIcon(jobType)}</span>
            <span className="job-title">{getJobTitle(jobType)}</span>
          </div>
          {toolOutput.status && (
            <span className={`job-badge ${getStatusClass(toolOutput.status)}`}>
              {toolOutput.status.toUpperCase()}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {toolOutput.status === 'running' && toolOutput.progress != null && (
          <div className="job-progress">
            <div className="job-progress__bar">
              <div 
                className="job-progress__fill"
                style={{ width: `${Math.min(toolOutput.progress, 100)}%` }}
              />
            </div>
            <span className="job-progress__text">{toolOutput.progress}%</span>
          </div>
        )}

        {/* Type-specific content */}
        {jobType === 'spaces' && spaceName && (
          <div className="job-detail-block">
            <span className="job-detail-block__label">Space</span>
            <span className="job-detail-block__value">{spaceName}</span>
          </div>
        )}

        {jobType === 'code-interpreter' && toolOutput.code && (
          <div className="job-code">
            <span className="job-code__label">{toolOutput.language || 'Code'}</span>
            <pre className="job-code__content">{toolOutput.code}</pre>
          </div>
        )}

        {jobType === 'deep-research' && toolOutput.query && (
          <div className="job-detail-block">
            <span className="job-detail-block__label">Query</span>
            <span className="job-detail-block__value">{toolOutput.query}</span>
          </div>
        )}

        {/* Result */}
        {result && toolOutput.status === 'completed' && (
          <div className="job-result">
            <span className="job-result__label">RESULT</span>
            <div className="job-result__content">
              {typeof result === 'string' 
                ? result 
                : JSON.stringify(result, null, 2).slice(0, 500)}
            </div>
          </div>
        )}

        {/* Sources (deep-research) */}
        {toolOutput.sources && toolOutput.sources.length > 0 && (
          <div className="job-sources">
            <span className="job-sources__label">SOURCES</span>
            <div className="job-sources__list">
              {toolOutput.sources.slice(0, 5).map((src, idx) => (
                <a 
                  key={idx} 
                  href={src.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="job-sources__item"
                >
                  {src.title || src.url}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="job-meta">
          {jobId && (
            <div className="job-meta__item">
              <span className="job-meta__label">Job ID</span>
              <span className="job-meta__value">{jobId.length > 16 ? `${jobId.slice(0, 8)}...` : jobId}</span>
            </div>
          )}
          {created && (
            <div className="job-meta__item">
              <span className="job-meta__label">Started</span>
              <span className="job-meta__value">{formatTimestamp(created)}</span>
            </div>
          )}
          {duration && (
            <div className="job-meta__item">
              <span className="job-meta__label">Duration</span>
              <span className="job-meta__value">{formatDuration(duration)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('async-job-root');
if (root) {
  createRoot(root).render(<AsyncJob />);
}

export default AsyncJob;
