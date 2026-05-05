import { useEffect, useState } from 'react';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { ChainIcon, UsdcIcon } from '..';
import type { SearchResource } from './types';
import { SearchIdentityIcon } from './SearchIdentityIcon';
import { ProfessorDexterCard } from '../../pricing/ProfessorDexterCard';
import { DoctorDexterCard } from '../../pricing/DoctorDexterCard';
import type { HistoryRow } from '../../pricing/types';
import { formatCompactNumber, providerDisplayName, hostLabel } from './utils';

/**
 * Bridge: synthesize a HistoryRow from the search row's per-resource verifier
 * fields, so the same Professor + Doctor components the pricing widget uses
 * can render here without modification. Returns null when there's nothing
 * meaningful to grade — Professor stays hidden in that case rather than
 * rendering an empty bubble.
 */
function synthesizeRunFromResource(resource: SearchResource): HistoryRow | null {
  const score = resource.qualityScore;
  const notes = resource.verificationNotes ?? null;
  const status = resource.verificationStatus ?? null;
  const verifiedAt = resource.lastVerifiedAt ?? null;
  // The notes ARE the verdict. A score with no prose is just a number on a
  // pole — we'd render an empty speech bubble next to a thermometer, which
  // is the "No notes returned" empty-state Branch flagged. Hard-gate on
  // notes existing. Score-without-notes is silent until the verifier writes
  // prose during its next run.
  const hasNotes = typeof notes === 'string' && notes.trim().length > 0;
  if (!hasNotes) return null;
  return {
    attempted_at: verifiedAt ?? new Date().toISOString(),
    completed_at: verifiedAt,
    duration_ms: null,
    paid: false,
    payment_network: null,
    payment_tx_signature: null,
    probe_status: null,
    probe_error: null,
    response_status: null,
    response_size_bytes: null,
    response_content_type: null,
    response_preview: null,
    response_kind: 'unknown',
    response_image_format: null,
    response_image_bytes_persisted: false,
    ai_model: null,
    ai_score: typeof score === 'number' ? score : null,
    ai_status: status,
    ai_notes: notes,
    ai_fix_instructions: resource.verificationFixInstructions ?? null,
    final_status: status ?? 'unknown',
    skip_reason: null,
    initiator: 'search',
  };
}

interface Props {
  resource: SearchResource;
  index: number;
  featured?: boolean;
  selected?: boolean;
  onInspect: (resource: SearchResource) => void;
  onCheckPrice: (resource: SearchResource) => Promise<void>;
  onFetch: (resource: SearchResource) => Promise<void>;
}

export function SearchVerdictRow({
  resource,
  index,
  featured = false,
  selected = false,
  onInspect,
  onCheckPrice,
  onFetch,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50 + index * 35);
    return () => clearTimeout(t);
  }, [index]);

  async function handleCheckPrice(e: React.MouseEvent) {
    e.stopPropagation();
    setChecking(true);
    try { await onCheckPrice(resource); } finally { setChecking(false); }
  }
  async function handleFetch(e: React.MouseEvent) {
    e.stopPropagation();
    setFetching(true);
    try { await onFetch(resource); } finally { setFetching(false); }
  }

  const providerName = providerDisplayName(resource);
  const host = hostLabel(resource.url);
  const chainOptions = resource.chains?.length
    ? resource.chains
    : [{ network: resource.network ?? null }];
  const visibleChainOptions = chainOptions.filter((chain, chainIndex, list) => {
    const key = chain.network ?? 'unknown';
    return list.findIndex((item) => (item.network ?? 'unknown') === key) === chainIndex;
  });
  const fetchPriceLabel = resource.price === 'free'
    ? 'Free'
    : resource.price.replace(/^\$/, '');

  const tier = resource.tier;
  const gamingSuspicious = resource.gamingSuspicious === true;
  const synthRun = synthesizeRunFromResource(resource);
  const hasFix = synthRun?.ai_fix_instructions
    && synthRun.ai_status !== 'pass'
    && (synthRun.ai_score == null || synthRun.ai_score < 75);

  return (
    <div
      className={`dx-search-cell ${visible ? 'dx-search-cell--visible' : ''} ${selected ? 'dx-search-cell--selected' : ''} ${featured ? 'dx-search-cell--featured' : ''}`}
      onClick={() => onInspect(resource)}
      role="button"
      tabIndex={0}
    >
      {/* Identity row — favicon + name + meta inline. No URL strip, no
          separate provider line. Tap card anywhere to open the drawer. */}
      <div className="dx-search-cell__identity">
        <SearchIdentityIcon resource={resource} size={44} />
        <div className="dx-search-cell__identity-text">
          <h3 className="dx-search-cell__name">{resource.name}</h3>
          <div className="dx-search-cell__meta">
            <span className="dx-search-cell__host">{host}</span>
            {resource.verified && (
              <span className="dx-search-cell__badge dx-search-cell__badge--verified">
                <CheckIcon /> verified
              </span>
            )}
            {gamingSuspicious && (
              <span className="dx-search-cell__badge dx-search-cell__badge--warn">
                ⚠ flagged
              </span>
            )}
            {tier === 'strong' && (
              <span className="dx-search-cell__tier">strong</span>
            )}
            {resource.totalCalls > 0 && (
              <span className="dx-search-cell__usage">{formatCompactNumber(resource.totalCalls)} calls</span>
            )}
          </div>
        </div>
      </div>

      {/* Description — single line, truncated. Full copy in the drawer. */}
      {resource.description && (
        <p className="dx-search-cell__description">{resource.description}</p>
      )}

      {/* Professor — full strength, only when there's something to grade.
          DoctorDexterCard rendered immediately after when there's a fix. */}
      {synthRun && (
        <ProfessorDexterCard
          run={synthRun}
          passesOfRecent={null}
          animate={false}
        />
      )}
      {hasFix && synthRun?.ai_fix_instructions && (
        <DoctorDexterCard
          fixText={synthRun.ai_fix_instructions}
          animate={false}
        />
      )}

      {/* Footer — chain icons + two-button action row. Inspect is the
          card-tap; Check Price (secondary) + Fetch (primary). */}
      <div className="dx-search-cell__footer">
        <div className="dx-search-cell__chains">
          {visibleChainOptions.map((chain, i) => (
            <span key={`${chain.network ?? 'x'}-${i}`} className="dx-search-cell__chain">
              <ChainIcon network={chain.network} size={16} />
            </span>
          ))}
          {resource.authRequired && (
            <span
              className="dx-search-cell__auth"
              title={resource.authHint || 'Provider authentication required.'}
            >
              auth
            </span>
          )}
        </div>
        <div className="dx-search-cell__actions">
          <Button
            variant="soft"
            color="secondary"
            size="sm"
            onClick={handleCheckPrice}
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Check price'}
          </Button>
          <Button
            color="primary"
            size="sm"
            onClick={handleFetch}
            disabled={fetching}
            className="dx-search-cell__fetch"
          >
            <span className="dx-search-cell__fetch-content">
              <span>{fetching ? 'Fetching…' : 'Fetch'}</span>
              {!fetching && resource.price !== 'free' && (
                <>
                  <UsdcIcon size={14} />
                  <span className="dx-search-cell__fetch-price">{fetchPriceLabel}</span>
                </>
              )}
              {!fetching && resource.price === 'free' && (
                <span className="dx-search-cell__fetch-price">{fetchPriceLabel}</span>
              )}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" width={10} height={10} aria-hidden="true">
      <path
        d="M2 6.5 L5 9 L10 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
