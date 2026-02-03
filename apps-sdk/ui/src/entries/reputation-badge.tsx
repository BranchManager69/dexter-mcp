import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState, Field, Grid, Status } from '../components/AppShell';
import { abbreviateAddress, formatTimestamp, formatValue } from '../components/utils';
import type { ReputationPayload, ReputationFeedback } from '../types';
import { useDisplayMode, useMaxHeight, useOpenAIGlobal, useRequestDisplayMode } from '../sdk';

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    stars.push(
      <span key={i} style={{ color: i <= rating ? '#f59e0b' : '#d1d5db' }}>
        ★
      </span>
    );
  }
  return <span style={{ fontSize: '16px' }}>{stars}</span>;
}

function FeedbackItem({ feedback }: { feedback: ReputationFeedback }) {
  return (
    <div style={{ 
      padding: '8px 12px', 
      background: 'var(--dexter-bg-secondary, #f5f5f5)', 
      borderRadius: '6px',
      marginBottom: '8px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <StarRating rating={feedback.rating ?? 0} />
        <span style={{ fontSize: '11px', color: 'var(--dexter-text-muted, #888)' }}>
          {feedback.createdAt ? formatTimestamp(feedback.createdAt) : ''}
        </span>
      </div>
      {feedback.comment && (
        <p style={{ fontSize: '13px', margin: '4px 0 0', color: 'var(--dexter-text-secondary, #444)' }}>
          {feedback.comment}
        </p>
      )}
      {feedback.fromAgentId && (
        <span style={{ fontSize: '11px', color: 'var(--dexter-text-muted, #888)' }}>
          From: {abbreviateAddress(feedback.fromAgentId)}
        </span>
      )}
    </div>
  );
}

function ReputationBadge() {
  const props = useOpenAIGlobal('toolOutput') as ReputationPayload | null;
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  if (!props) {
    return (
      <AppShell style={style}>
        <Card title="Reputation" badge={{ label: 'Loading' }}>
          <EmptyState message="Loading reputation..." />
        </Card>
      </AppShell>
    );
  }

  const { agentId, chain, score, totalRatings, averageRating, recentFeedback } = props;
  const displayRating = averageRating ?? score ?? 0;
  const ratingLabel = displayRating > 0 ? `${displayRating.toFixed(1)} / 5` : 'No ratings';

  return (
    <AppShell style={style}>
      <Card
        title="Agent Reputation"
        badge={{ label: ratingLabel }}
        actions={
          canExpand ? (
            <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
              Expand
            </button>
          ) : null
        }
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>
            <StarRating rating={Math.round(displayRating)} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--dexter-text-primary, #111)' }}>
            {displayRating > 0 ? displayRating.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--dexter-text-muted, #666)' }}>
            {totalRatings ?? 0} ratings
          </div>
        </div>

        <Grid columns={2}>
          {agentId && <Field label="Agent ID" value={abbreviateAddress(agentId)} code />}
          {chain && <Field label="Chain" value={formatValue(chain)} />}
        </Grid>

        {recentFeedback && recentFeedback.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--dexter-text-secondary, #333)' }}>
              Recent Feedback
            </h3>
            {recentFeedback.slice(0, 5).map((fb, idx) => (
              <FeedbackItem key={fb.id || idx} feedback={fb} />
            ))}
          </div>
        )}

        <Status>
          <span>ERC-8004 Reputation System</span>
        </Status>
      </Card>
    </AppShell>
  );
}

const root = document.getElementById('reputation-badge-root');
if (root) {
  createRoot(root).render(<ReputationBadge />);
}

export default ReputationBadge;
