import { useEffect, useState } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { ChainIcon, QualityBadge, VerifiedBadge, formatCalls, getChain } from '..';
import type { SearchResource } from './types';

function getDexterRead(resource: SearchResource) {
  if (resource.verified && (resource.qualityScore ?? 0) >= 85) {
    return 'Strong verified signal';
  }
  if (resource.authRequired) {
    return 'Needs provider auth';
  }
  if ((resource.totalCalls ?? 0) > 1000) {
    return 'Active market usage';
  }
  return 'Worth inspecting';
}

export function SearchResultCard({
  resource,
  index,
  featured = false,
  selected = false,
  onInspect,
  onCheckPrice,
  onFetch,
}: {
  resource: SearchResource;
  index: number;
  featured?: boolean;
  selected?: boolean;
  onInspect: (resource: SearchResource) => void;
  onCheckPrice: (resource: SearchResource) => Promise<void>;
  onFetch: (resource: SearchResource) => Promise<void>;
}) {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { name: networkName } = getChain(resource.network);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50 + index * 35);
    return () => clearTimeout(t);
  }, [index]);

  const dexterRead = getDexterRead(resource);

  async function handleCheckPrice(e: React.MouseEvent) {
    e.stopPropagation();
    setChecking(true);
    try {
      await onCheckPrice(resource);
    } finally {
      setChecking(false);
    }
  }

  async function handleFetch(e: React.MouseEvent) {
    e.stopPropagation();
    setFetching(true);
    try {
      await onFetch(resource);
    } finally {
      setFetching(false);
    }
  }

  return (
    <div
      className={`group rounded-[22px] border p-4 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${
        selected
          ? 'border-[#ff6b00]/45 bg-[rgba(255,107,0,0.06)] shadow-[0_0_0_1px_rgba(255,107,0,0.12),0_18px_40px_rgba(255,107,0,0.10)]'
          : featured
            ? 'border-[#ff6b00]/20 bg-surface shadow-[0_14px_32px_rgba(255,107,0,0.06)]'
            : 'border-default bg-surface'
      } hover:border-[#ff6b00]/38`}
      onClick={() => onInspect(resource)}
      role="button"
      tabIndex={0}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="heading-sm leading-tight text-primary">{resource.name}</span>
                  {featured && <Badge color="warning" variant="soft" size="sm">Lead signal</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
                  <span>{resource.seller ? `Provider: ${resource.seller}` : 'Provider: Independent'}</span>
                  <span>Method: {resource.method}</span>
                  {resource.totalCalls > 0 && <span>{formatCalls(resource.totalCalls)} calls</span>}
                </div>
              </div>

              <div className="hidden xl:flex xl:items-center xl:gap-2 xl:flex-shrink-0">
                <Badge color="success" variant="soft" pill>
                  <ChainIcon network={resource.network} size={12} />
                  {resource.price}
                </Badge>
                {networkName && <Badge variant="outline" size="sm">{networkName}</Badge>}
                <QualityBadge score={resource.qualityScore} />
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-secondary">
              {resource.description || 'No description yet. Inspect the endpoint before paying.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:hidden">
            <Badge color="success" variant="soft" pill>
              <ChainIcon network={resource.network} size={12} />
              {resource.price}
            </Badge>
            {networkName && <Badge variant="outline" size="sm">{networkName}</Badge>}
            <QualityBadge score={resource.qualityScore} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" size="sm">{resource.category}</Badge>
          <VerifiedBadge verified={resource.verified} />
          <Badge variant="outline" size="sm">{dexterRead}</Badge>
          {resource.authRequired && (
            <Badge color="warning" size="sm" title={resource.authHint || 'Provider authentication required.'}>
              Auth{resource.authType ? ` (${resource.authType.toUpperCase()})` : ''}
            </Badge>
          )}
        </div>

        <div className="rounded-2xl border border-subtle bg-surface-secondary px-3.5 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-tertiary">Endpoint</div>
              <div className="mt-1 font-mono text-xs leading-5 text-secondary break-all">{resource.url}</div>
            </div>
            <CopyButton
              copyValue={resource.url}
              variant="ghost"
              color="secondary"
              size="sm"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              Copy URL
            </CopyButton>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="soft" color="secondary" size="sm" onClick={() => onInspect(resource)}>
            Inspect
          </Button>
          <Button variant="soft" color="secondary" size="sm" onClick={handleCheckPrice} disabled={checking}>
            {checking ? 'Checking…' : 'Check Price'}
          </Button>
          <Button color="primary" size="sm" onClick={handleFetch} disabled={fetching}>
            {fetching ? 'Fetching…' : `Fetch ${resource.price}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
