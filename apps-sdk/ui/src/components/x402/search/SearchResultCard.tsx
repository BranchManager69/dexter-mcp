import { useEffect, useState } from 'react';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { ChainIcon, UsdcIcon } from '..';
import type { SearchResource } from './types';
import { SearchIdentityIcon } from './SearchIdentityIcon';
import { SearchScoreBadge } from './SearchScoreBadge';
import { formatCompactNumber, providerDisplayName, shortenUrl } from './utils';

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

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50 + index * 35);
    return () => clearTimeout(t);
  }, [index]);

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

  const providerName = providerDisplayName(resource);
  const compactUrl = shortenUrl(resource.url);
  const chainOptions = resource.chains?.length ? resource.chains : [{ network: resource.network ?? null }];
  const visibleChainOptions = chainOptions.filter((chain, chainIndex, list) => {
    const key = chain.network ?? 'unknown';
    return list.findIndex((item) => (item.network ?? 'unknown') === key) === chainIndex;
  });
  const fetchLabel = resource.price === 'free' ? 'Fetch free' : resource.price.replace(/^\$/, '');

  return (
    <div
      className={`group relative rounded-[24px] border p-4 transition-all duration-300 ${
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
      <div className="absolute right-4 top-4 z-10">
        <SearchScoreBadge score={resource.qualityScore} variant="card" />
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 pr-14 sm:pr-16">
          <SearchIdentityIcon resource={resource} />
          <div className="min-w-0 flex-1">
            <div className="min-w-0">
              <h3 className="pr-1 text-lg font-semibold leading-snug text-primary [overflow-wrap:anywhere]">
                {resource.name}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
                <span className="font-medium text-primary/90">{providerName}</span>
                {resource.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                    <span aria-hidden="true">✓</span>
                    <span>Verified</span>
                  </span>
                )}
                {resource.totalCalls > 0 && (
                  <span className="text-xs text-tertiary">{formatCompactNumber(resource.totalCalls)} calls</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-tertiary">
                <span className="truncate max-w-full">{compactUrl}</span>
                <CopyButton
                  copyValue={resource.url}
                  variant="ghost"
                  color="secondary"
                  size="sm"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  Copy
                </CopyButton>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-secondary sm:pr-4">
              {resource.description || 'No description yet. Inspect the endpoint before paying.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {visibleChainOptions.map((chain, chainIndex) => (
              <span key={`${chain.network ?? 'unknown'}-${chainIndex}`} className="inline-flex items-center justify-center rounded-full bg-surface-secondary/90 p-1.5 ring-1 ring-white/5">
                <ChainIcon network={chain.network} size={16} />
              </span>
            ))}
            {resource.authRequired && (
              <span className="text-xs text-amber-300" title={resource.authHint || 'Provider authentication required.'}>
                Auth required
              </span>
            )}
          </div>

          {featured && (
            <span className="text-[11px] uppercase tracking-[0.16em] text-[#ff9a52]">
              Lead result
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="soft" color="secondary" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onInspect(resource); }}>
            Inspect
          </Button>
          <Button variant="soft" color="secondary" size="sm" onClick={handleCheckPrice} disabled={checking}>
            {checking ? 'Checking…' : 'Check Price'}
          </Button>
          <Button className="sm:ml-auto" color="primary" size="sm" onClick={handleFetch} disabled={fetching}>
            <span className="inline-flex items-center gap-1.5">
              <span>{fetching ? 'Fetching…' : 'Fetch'}</span>
              {!fetching && resource.price !== 'free' && (
                <>
                  <UsdcIcon size={14} />
                  <span>{fetchLabel}</span>
                </>
              )}
              {!fetching && resource.price === 'free' && <span>{fetchLabel.replace(/^Fetch /, '')}</span>}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
