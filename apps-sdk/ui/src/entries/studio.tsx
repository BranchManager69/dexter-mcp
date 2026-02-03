import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'pending' | 'queued';

type StudioJob = {
  id?: string;
  job_id?: string;
  status?: JobStatus;
  task?: string;
  current_step?: string;
  turns?: number;
  started_at?: string;
  ended_at?: string;
  elapsed_seconds?: number;
  result?: unknown;
  error?: string;
  model?: string;
};

type MediaJob = {
  type: 'video' | 'infographic';
  job_id?: string;
  status?: string;
};

type StudioPayload = {
  ok?: boolean;
  success?: boolean;
  error?: string;
  message?: string;
  job_id?: string;
  job?: StudioJob;
  jobs?: StudioJob[];
  count?: number;
  headline?: string;
  media?: MediaJob[];
  view_at?: string;
  status?: JobStatus;
  created_at?: string;
  completed_at?: string;
  artifacts?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

function formatTime(timestamp?: string): string {
  if (!timestamp) return '—';
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

function detectViewType(payload: StudioPayload): string {
  if (payload.jobs) return 'list';
  if (payload.job) return 'inspect';
  if (payload.media || payload.headline) return 'breaking_news';
  if (payload.artifacts !== undefined || payload.completed_at) return 'news_status';
  if (payload.success === false && payload.message?.includes('cancel')) return 'cancel';
  if (payload.job_id && !payload.status) return 'create';
  return 'status';
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function StudioStatusBadge({ status }: { status: JobStatus }) {
  const configs: Record<JobStatus, { icon: string; className: string }> = {
    running: { icon: '↻', className: 'studio-badge--running' },
    completed: { icon: '✓', className: 'studio-badge--success' },
    failed: { icon: '✕', className: 'studio-badge--error' },
    cancelled: { icon: '◼', className: 'studio-badge--neutral' },
    pending: { icon: '◷', className: 'studio-badge--warning' },
    queued: { icon: '◷', className: 'studio-badge--info' },
  };
  const config = configs[status] || configs.pending;

  return (
    <span className={`studio-badge ${config.className}`}>
      <span className={status === 'running' ? 'studio-badge__spin' : ''}>{config.icon}</span>
      {status}
    </span>
  );
}

function CreateView({ payload }: { payload: StudioPayload }) {
  return (
    <div className="studio-view">
      <div className="studio-success-banner">
        <span className="studio-success-icon">🚀</span>
        <div className="studio-success-text">
          <span className="studio-success-title">Agent Started!</span>
        </div>
      </div>
      {payload.job_id && (
        <div className="studio-info-box">
          <span className="studio-info-label">JOB ID</span>
          <code className="studio-info-value">{payload.job_id}</code>
        </div>
      )}
      {payload.message && <p className="studio-message">{payload.message}</p>}
    </div>
  );
}

function StatusView({ payload }: { payload: StudioPayload }) {
  const status = (payload.status || 'pending') as JobStatus;
  const jobId = payload.job_id;

  return (
    <div className="studio-view">
      <div className="studio-info-box">
        <div className="studio-info-row">
          <span className="studio-info-label">JOB ID</span>
          <code className="studio-info-value">{jobId || '—'}</code>
        </div>
      </div>

      {status === 'running' && payload.current_step && (
        <div className="studio-progress">
          <div className="studio-progress-icon">🚀</div>
          <div className="studio-progress-info">
            <span className="studio-progress-step">{payload.current_step}</span>
            {payload.turns !== undefined && (
              <span className="studio-progress-turns">Turn {payload.turns}</span>
            )}
          </div>
        </div>
      )}

      <div className="studio-metrics">
        <div className="studio-metric">
          <span className="studio-metric__label">STATUS</span>
          <span className="studio-metric__value">{status.toUpperCase()}</span>
        </div>
        <div className="studio-metric">
          <span className="studio-metric__label">TURNS</span>
          <span className="studio-metric__value">{payload.turns ?? 0}</span>
        </div>
        <div className="studio-metric">
          <span className="studio-metric__label">ELAPSED</span>
          <span className="studio-metric__value">{formatDuration(payload.elapsed_seconds)}</span>
        </div>
        <div className="studio-metric">
          <span className="studio-metric__label">STARTED</span>
          <span className="studio-metric__value">{formatTime(payload.started_at)}</span>
        </div>
      </div>

      {payload.error && (
        <div className="studio-error-box">
          <span className="studio-error-icon">✕</span>
          <p>{payload.error}</p>
        </div>
      )}
    </div>
  );
}

function ListView({ jobs }: { jobs: StudioJob[] }) {
  return (
    <div className="studio-view">
      {jobs.length === 0 ? (
        <div className="studio-empty">
          <span className="studio-empty-icon">🚀</span>
          <p>No jobs found</p>
        </div>
      ) : (
        <div className="studio-jobs-list">
          {jobs.map((job, idx) => (
            <div key={job.id || idx} className="studio-job-row">
              <div className="studio-job-left">
                <code className="studio-job-id">{job.id || job.job_id}</code>
                <StudioStatusBadge status={(job.status || 'pending') as JobStatus} />
              </div>
              <div className="studio-job-right">
                <span className="studio-job-turns">{job.turns || 0} turns</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BreakingNewsView({ payload }: { payload: StudioPayload }) {
  return (
    <div className="studio-view">
      {payload.headline && (
        <div className="studio-headline-box">
          <span className="studio-headline-label">HEADLINE</span>
          <p className="studio-headline-text">{payload.headline}</p>
        </div>
      )}

      {payload.media && payload.media.length > 0 && (
        <div className="studio-media-list">
          <span className="studio-media-label">MEDIA JOBS</span>
          {payload.media.map((m, idx) => (
            <div key={m.job_id || idx} className={`studio-media-item ${m.type === 'video' ? 'studio-media-item--video' : 'studio-media-item--image'}`}>
              <span className="studio-media-icon">{m.type === 'video' ? '🎬' : '🖼️'}</span>
              <div className="studio-media-info">
                <span className="studio-media-type">{m.type === 'video' ? 'Sora Video' : 'Infographic'}</span>
                {m.job_id && <code className="studio-media-id">{m.job_id}</code>}
              </div>
            </div>
          ))}
        </div>
      )}

      {payload.view_at && (
        <a href={payload.view_at} target="_blank" rel="noreferrer" className="studio-view-link">
          View Jobs ↗
        </a>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function Studio() {
  const toolOutput = useOpenAIGlobal('toolOutput') as StudioPayload | null;

  if (!toolOutput) {
    return (
      <div className="studio-container">
        <div className="studio-loading">
          <div className="studio-loading__spinner" />
          <span>Loading Studio...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error && toolOutput.success === false) {
    return (
      <div className="studio-container">
        <div className="studio-error">{toolOutput.error || 'Operation failed'}</div>
      </div>
    );
  }

  const viewType = detectViewType(toolOutput);
  const status = (toolOutput.status || toolOutput.job?.status || 'pending') as JobStatus;

  const titles: Record<string, string> = {
    create: 'Studio Job Created',
    status: 'Job Status',
    list: 'Studio Jobs',
    inspect: 'Job Inspection',
    cancel: 'Job Cancellation',
    breaking_news: 'Breaking News Media',
    news_status: 'News Media Status',
  };

  return (
    <div className="studio-container">
      <div className="studio-card">
        <div className="studio-header">
          <div className="studio-header-left">
            <span className="studio-icon">🎬</span>
            <span className="studio-title">{titles[viewType]}</span>
          </div>
          {viewType !== 'list' && viewType !== 'create' && (
            <StudioStatusBadge status={status} />
          )}
          {viewType === 'list' && (
            <span className="studio-count">{toolOutput.count || toolOutput.jobs?.length || 0} jobs</span>
          )}
        </div>

        {viewType === 'create' && <CreateView payload={toolOutput} />}
        {viewType === 'status' && <StatusView payload={toolOutput} />}
        {viewType === 'list' && <ListView jobs={toolOutput.jobs || []} />}
        {viewType === 'inspect' && toolOutput.job && <StatusView payload={{ ...toolOutput.job, job_id: toolOutput.job.id }} />}
        {(viewType === 'breaking_news' || viewType === 'news_status') && <BreakingNewsView payload={toolOutput} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('studio-root');
if (root) {
  createRoot(root).render(<Studio />);
}

export default Studio;
