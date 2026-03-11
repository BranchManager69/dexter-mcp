import { useEffect, useMemo, useState } from 'react';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { ChainIcon, JsonViewer, UsdcIcon } from '..';
import type { SearchResource } from './types';
import { SearchIdentityIcon } from './SearchIdentityIcon';
import { SearchScoreBadge } from './SearchScoreBadge';
import { formatCompactNumber, providerDisplayName, shortenUrl } from './utils';
import { addWidgetBreadcrumb, captureWidgetException } from '../../../sdk/init-sentry';

const API_ORIGIN = 'https://api.dexter.cash';

type VerificationHistoryEntry = {
  id: string;
  attempted_at: string;
  duration_ms: number | null;
  paid: boolean;
  probe_status: number | null;
  response_status: number | null;
  response_size_bytes: number | null;
  ai_score: number | null;
  ai_status: 'pass' | 'fail' | 'inconclusive' | null;
  ai_notes: string | null;
  ai_fix_instructions: string | null;
  final_status: string;
  test_input_generated: Record<string, unknown> | null;
  test_input_reasoning: string | null;
};

type VerificationStatusPayload = {
  ok?: boolean;
  pending?: boolean;
  status?: string | null;
  score?: number | null;
  notes?: string | null;
  fixInstructions?: string | null;
  lastVerifiedAt?: string | null;
  verificationCount?: number | null;
};

type SchemaPayload = {
  ok?: boolean;
  schema?: {
    input?: unknown;
    output?: unknown;
    price?: unknown;
    method?: string | null;
  } | null;
};

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'No verification timestamp';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown verification time';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildDexterAssessment(resource: SearchResource, statusPayload: VerificationStatusPayload | null) {
  if (statusPayload?.notes) return statusPayload.notes;
  if (resource.verificationNotes) return resource.verificationNotes;
  if (resource.verified && (resource.qualityScore ?? 0) >= 85) {
    return 'Dexter sees this as a high-confidence candidate with strong trust and quality signals.';
  }
  if (resource.verified) {
    return 'Dexter sees positive trust signals here, but this endpoint still merits a quick inspection before paying.';
  }
  if (resource.authRequired) {
    return 'Dexter can surface it, but this provider requires an additional auth step before it will behave cleanly.';
  }
  return 'Dexter surfaced this as a promising candidate, but the trust picture is still lightweight until more verification data is reviewed.';
}

export function SearchResourceDetail({
  resource,
  inline = false,
  onClose,
  onCheckPrice,
  onFetch,
}: {
  resource: SearchResource;
  inline?: boolean;
  onClose?: () => void;
  onCheckPrice: (resource: SearchResource) => Promise<void>;
  onFetch: (resource: SearchResource) => Promise<void>;
}) {
  const providerName = providerDisplayName(resource);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [history, setHistory] = useState<VerificationHistoryEntry[]>([]);
  const [statusPayload, setStatusPayload] = useState<VerificationStatusPayload | null>(null);
  const [schemaPayload, setSchemaPayload] = useState<SchemaPayload | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setSchemaLoading(true);
    setDetailError(null);
    setSelectedHistoryId(null);

    async function loadDetail() {
      try {
        addWidgetBreadcrumb('detail_fetch_start', {
          resourceId: resource.resourceId,
          url: resource.url,
        });
        const [historyRes, statusRes, schemaRes] = await Promise.all([
          fetch(`${API_ORIGIN}/api/facilitator/marketplace/resources/${encodeURIComponent(resource.resourceId)}/history?limit=10`, { cache: 'no-store' }),
          fetch(`${API_ORIGIN}/api/facilitator/marketplace/resources/${encodeURIComponent(resource.resourceId)}/verification-status`, { cache: 'no-store' }),
          fetch(`${API_ORIGIN}/api/facilitator/resource/schema?url=${encodeURIComponent(resource.url)}`, { cache: 'no-store' }),
        ]);

        const historyJson = await historyRes.json().catch(() => null);
        const statusJson = await statusRes.json().catch(() => null);
        const schemaJson = await schemaRes.json().catch(() => null);

        if (cancelled) return;

        setHistory(Array.isArray(historyJson?.history) ? historyJson.history : []);
        setStatusPayload(statusJson);
        setSchemaPayload(schemaJson);
        addWidgetBreadcrumb('detail_fetch_success', {
          resourceId: resource.resourceId,
          historyCount: Array.isArray(historyJson?.history) ? historyJson.history.length : 0,
          hasSchema: Boolean(schemaJson?.schema),
        });
      } catch (error) {
        if (cancelled) return;
        setDetailError(error instanceof Error ? error.message : 'Failed to load endpoint detail');
        captureWidgetException(error, {
          phase: 'detail_fetch',
          resourceId: resource.resourceId,
          url: resource.url,
        });
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
          setSchemaLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [resource.resourceId, resource.url]);

  useEffect(() => {
    if (!history.length) return;
    const preferred = history.find((entry) => entry.ai_status === 'pass') ?? history[0];
    setSelectedHistoryId(preferred.id);
  }, [history]);

  const selectedHistory = useMemo(
    () => history.find((entry) => entry.id === selectedHistoryId) ?? history[0] ?? null,
    [history, selectedHistoryId],
  );
  const assessment = buildDexterAssessment(resource, statusPayload);
  const chainOptions = resource.chains?.length ? resource.chains : [{ network: resource.network ?? null }];
  const fetchLabel = resource.price === 'free' ? 'free' : resource.price.replace(/^\$/, '');

  return (
    <aside
      className={`rounded-[24px] border border-[rgba(255,107,0,0.18)] bg-surface p-4 shadow-[0_22px_48px_rgba(255,107,0,0.08)] ${
        inline ? '' : 'sticky top-4'
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,107,0,0.10),rgba(255,107,0,0.03)_42%,rgba(255,255,255,0.02)_100%)] p-4">
          <div className="flex items-start gap-3">
          <SearchIdentityIcon resource={resource} size={52} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.22em] text-tertiary">Inspection Deck</div>
            <h3 className="mt-1 text-lg font-semibold leading-tight text-primary [overflow-wrap:anywhere]">{resource.name}</h3>
            <div className="mt-1 text-xs text-tertiary">{shortenUrl(resource.url)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
              <span className="font-medium">{providerName}</span>
              {resource.verified && (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <span aria-hidden="true">✓</span>
                  <span>Verified</span>
                </span>
              )}
              {statusPayload?.lastVerifiedAt && (
                <span className="text-tertiary">Last checked {formatWhen(statusPayload.lastVerifiedAt)}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <SearchScoreBadge score={statusPayload?.score ?? resource.qualityScore} variant="detail" />
            {onClose && (
              <Button variant="soft" color="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-subtle bg-surface-secondary/80 px-3.5 py-3">
          <div className="flex items-center gap-2">
            {chainOptions.map((chain, index) => (
              <span key={`${chain.network ?? 'unknown'}-${index}`} className="inline-flex items-center justify-center rounded-full bg-surface px-1.5 py-1">
                <ChainIcon network={chain.network} size={16} />
              </span>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="soft" color="secondary" size="sm" onClick={() => onCheckPrice(resource)}>
              Check Price
            </Button>
            <Button color="primary" size="sm" onClick={() => onFetch(resource)}>
              <span className="inline-flex items-center gap-1.5">
                <span>Fetch</span>
                {resource.price !== 'free' && <UsdcIcon size={14} />}
                <span>{fetchLabel}</span>
              </span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="rounded-[22px] border border-subtle bg-surface-secondary/80 px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Dexter Take</div>
            <p className="mt-3 text-sm leading-6 text-secondary">{assessment}</p>
            {(statusPayload?.fixInstructions || resource.verificationFixInstructions) && (
              <p className="mt-3 text-xs leading-5 text-amber-300">
                {statusPayload?.fixInstructions || resource.verificationFixInstructions}
              </p>
            )}
          </section>

          <section className="rounded-[22px] border border-subtle bg-surface-secondary/80 px-4 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Provider</div>
                <div className="mt-2 text-sm font-medium text-primary">{providerName}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Usage Signal</div>
                <div className="mt-2 text-sm font-medium text-primary">
                  {resource.totalCalls > 0 ? `${formatCompactNumber(resource.totalCalls)} historical calls` : 'No historical call count'}
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-white/6 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Endpoint</div>
                  <div className="mt-2 font-mono text-xs leading-5 text-secondary break-all">{resource.url}</div>
                </div>
                <CopyButton copyValue={resource.url} variant="ghost" color="secondary" size="sm">
                  Copy
                </CopyButton>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[22px] border border-subtle bg-surface-secondary/80 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Verification History</div>
            <div className="text-xs text-tertiary">
              {historyLoading ? 'Loading…' : `${history.length} checks`}
            </div>
          </div>
          {detailError ? (
            <p className="mt-3 text-sm text-danger">{detailError}</p>
          ) : historyLoading ? (
            <div className="mt-3 space-y-2">
              <div className="h-11 animate-pulse rounded-2xl bg-surface" />
              <div className="h-11 animate-pulse rounded-2xl bg-surface" />
              <div className="h-11 animate-pulse rounded-2xl bg-surface" />
            </div>
          ) : history.length === 0 ? (
            <p className="mt-3 text-sm text-tertiary">No verification history yet.</p>
          ) : (
            <div className="mt-4 space-y-2 border-l border-white/8 pl-4">
              {history.map((entry) => {
                const active = selectedHistory?.id === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedHistoryId(entry.id)}
                    className={`relative w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                      active ? 'border-[#ff6b00]/35 bg-surface shadow-[0_10px_22px_rgba(255,107,0,0.05)]' : 'border-subtle bg-transparent hover:border-[#ff6b00]/20'
                    }`}
                  >
                    <span className={`absolute -left-[21px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${
                      entry.ai_status === 'pass'
                        ? 'bg-emerald-400'
                        : entry.ai_status === 'fail'
                          ? 'bg-rose-400'
                          : 'bg-amber-300'
                    }`} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-secondary">{formatWhen(entry.attempted_at)}</span>
                        <span className="text-xs text-tertiary">{entry.ai_status ?? 'unknown'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-primary">{entry.ai_score ?? '—'}</span>
                        <span className="text-tertiary">{formatDuration(entry.duration_ms)}</span>
                        <span className="text-tertiary">{entry.response_status ?? '—'}</span>
                        {entry.paid && <span className="text-emerald-400">Paid</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedHistory && (
            <div className="mt-4 rounded-2xl border border-subtle bg-surface px-3.5 py-3">
              {selectedHistory.ai_notes && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">AI Assessment</div>
                  <p className="mt-2 text-sm leading-6 text-secondary">{selectedHistory.ai_notes}</p>
                </div>
              )}
              {selectedHistory.ai_fix_instructions && (
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">How To Fix</div>
                  <p className="mt-2 text-sm leading-6 text-amber-300">{selectedHistory.ai_fix_instructions}</p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-tertiary">
                <span>Probe {selectedHistory.probe_status ?? '—'}</span>
                <span>HTTP {selectedHistory.response_status ?? '—'}</span>
                <span>Duration {formatDuration(selectedHistory.duration_ms)}</span>
                <span>Size {formatBytes(selectedHistory.response_size_bytes)}</span>
              </div>
              {(selectedHistory.test_input_generated || selectedHistory.test_input_reasoning) && (
                <div className="mt-3 space-y-3">
                  {selectedHistory.test_input_reasoning && (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Why This Input</div>
                      <p className="mt-2 text-sm leading-6 text-secondary">{selectedHistory.test_input_reasoning}</p>
                    </div>
                  )}
                  {selectedHistory.test_input_generated && (
                    <JsonViewer data={selectedHistory.test_input_generated} title="Generated Test Input" defaultExpanded={false} />
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-[22px] border border-subtle bg-surface-secondary/80 px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Schemas</div>
          {schemaLoading ? (
            <div className="mt-3 h-20 animate-pulse rounded-2xl bg-surface" />
          ) : schemaPayload?.schema ? (
            <div className="mt-3 space-y-3">
              {schemaPayload.schema.input && (
                <JsonViewer data={schemaPayload.schema.input} title="Input Schema" defaultExpanded={false} />
              )}
              {schemaPayload.schema.output && (
                <JsonViewer data={schemaPayload.schema.output} title="Output Schema" defaultExpanded={false} />
              )}
              {!schemaPayload.schema.input && !schemaPayload.schema.output && (
                <p className="text-sm text-tertiary">Schema data exists, but no structured input/output contract was found.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-tertiary">No saved schema is available for this endpoint yet.</p>
          )}
        </section>
      </div>
    </aside>
  );
}
