import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { ChainIcon, JsonViewer, QualityBadge, VerifiedBadge, getChain } from '..';
import type { SearchResource } from './types';

function buildDexterAssessment(resource: SearchResource) {
  if (resource.verified && (resource.qualityScore ?? 0) >= 85) {
    return 'Dexter sees this as a high-confidence candidate with strong trust and quality signals.';
  }
  if (resource.verified) {
    return 'Dexter sees positive trust signals here, but this endpoint still merits a quick inspection before paying.';
  }
  if (resource.authRequired) {
    return 'Dexter can surface it, but this provider requires an additional auth step before it will behave cleanly.';
  }
  return 'Dexter surfaced this as a promising candidate, but the trust picture is still lightweight in this first pass.';
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
  const { name: networkName } = getChain(resource.network);
  const assessment = buildDexterAssessment(resource);

  const detailPayload = {
    provider: resource.seller ?? 'Independent',
    network: networkName || resource.network || 'Unknown',
    method: resource.method,
    category: resource.category,
    authRequired: Boolean(resource.authRequired),
    authType: resource.authType ?? null,
    totalCalls: resource.totalCalls,
    price: resource.price,
    url: resource.url,
  };

  return (
    <aside
      className={`rounded-[22px] border border-[rgba(255,107,0,0.18)] bg-surface p-4 shadow-[0_18px_40px_rgba(255,107,0,0.08)] ${
        inline ? '' : 'sticky top-4'
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-tertiary">Inspection Deck</div>
            <h3 className="mt-1 text-lg font-semibold leading-tight text-primary">{resource.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge color="success" variant="soft" pill>
                <ChainIcon network={resource.network} size={12} />
                {resource.price}
              </Badge>
              {networkName && <Badge variant="outline" size="sm">{networkName}</Badge>}
              <QualityBadge score={resource.qualityScore} />
              <VerifiedBadge verified={resource.verified} />
            </div>
          </div>
          {onClose && (
            <Button variant="soft" color="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-subtle bg-surface-secondary px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Dexter Take</div>
          <p className="mt-2 text-sm leading-6 text-secondary">{assessment}</p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-subtle bg-surface-secondary px-3.5 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Provider</div>
            <div className="mt-1 text-sm font-medium text-primary">{resource.seller ?? 'Independent'}</div>
          </div>
          <div className="rounded-2xl border border-subtle bg-surface-secondary px-3.5 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Usage Signal</div>
            <div className="mt-1 text-sm font-medium text-primary">
              {resource.totalCalls > 0 ? `${resource.totalCalls.toLocaleString()} historical calls` : 'No historical call count'}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-subtle bg-surface-secondary px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Endpoint</div>
              <div className="mt-1 font-mono text-xs leading-5 text-secondary break-all">{resource.url}</div>
            </div>
            <CopyButton copyValue={resource.url} variant="ghost" color="secondary" size="sm">
              Copy
            </CopyButton>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button variant="soft" color="secondary" size="sm" onClick={() => onCheckPrice(resource)}>
            Check Price
          </Button>
          <Button color="primary" size="sm" onClick={() => onFetch(resource)}>
            Fetch {resource.price}
          </Button>
        </div>

        <JsonViewer data={detailPayload} title="Current Inspection Notes" defaultExpanded />

        <div className="rounded-2xl border border-dashed border-subtle px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Next Pass</div>
          <p className="mt-2 text-xs leading-5 text-tertiary">
            Verification history, run selection, and input/output schema inspection land in Group 2 once the stable detail handle is wired.
          </p>
        </div>
      </div>
    </aside>
  );
}
