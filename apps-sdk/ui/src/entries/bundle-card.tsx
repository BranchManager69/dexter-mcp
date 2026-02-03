import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { AppShell, Card, EmptyState, Field, Grid, Status, Warning } from '../components/AppShell';
import { formatValue } from '../components/utils';
import type { Bundle, BundlePayload } from '../types';
import { useDisplayMode, useMaxHeight, useOpenAIGlobal, useRequestDisplayMode } from '../sdk';

function formatPrice(priceUsdc: number | null | undefined): string {
  if (priceUsdc == null) return '—';
  return `$${priceUsdc.toFixed(2)} USDC`;
}

function BundleItem({ bundle, showDetails = false }: { bundle: Bundle; showDetails?: boolean }) {
  const tags = bundle.tags ?? [];
  
  return (
    <div style={{ 
      padding: '12px', 
      background: 'var(--dexter-bg-secondary, #f5f5f5)', 
      borderRadius: '8px',
      marginBottom: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {bundle.iconUrl && (
          <img 
            src={bundle.iconUrl} 
            alt={bundle.name || 'Bundle'} 
            style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
          />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: 'var(--dexter-text-primary, #111)' }}>
              {bundle.name || 'Unnamed Bundle'}
            </h3>
            {bundle.isVerified && (
              <span style={{ fontSize: '12px', color: '#10b981' }}>✓ Verified</span>
            )}
            {bundle.isFeatured && (
              <span style={{ 
                fontSize: '10px', 
                background: '#8b5cf6', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: '4px' 
              }}>
                Featured
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--dexter-text-secondary, #666)', margin: '4px 0' }}>
            {bundle.shortDescription || bundle.description || 'No description'}
          </p>
        </div>
      </div>

      <Grid columns={3}>
        <Field label="Price" value={formatPrice(bundle.priceUsdc)} />
        <Field label="Tools" value={bundle.toolCount ?? bundle.tools?.length ?? '—'} />
        <Field label="Uses" value={bundle.usesPerPurchase ?? '—'} />
      </Grid>

      {bundle.avgRating != null && (
        <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--dexter-text-muted, #888)' }}>
          ★ {bundle.avgRating.toFixed(1)} ({bundle.ratingCount ?? 0} ratings) • {bundle.totalPurchases ?? 0} purchases
        </div>
      )}

      {tags.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {tags.slice(0, 5).map((tag, idx) => (
            <span 
              key={idx} 
              style={{ 
                fontSize: '11px', 
                background: 'var(--dexter-bg-tertiary, #e5e5e5)', 
                padding: '2px 8px', 
                borderRadius: '4px',
                color: 'var(--dexter-text-muted, #666)'
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {showDetails && bundle.tools && bundle.tools.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--dexter-border, #e5e5e5)', paddingTop: '12px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--dexter-text-secondary, #333)' }}>
            Included Tools
          </h4>
          {bundle.tools.map((tool, idx) => (
            <div key={idx} style={{ fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ fontWeight: '500' }}>{tool.name}</span>
              {tool.description && (
                <span style={{ color: 'var(--dexter-text-muted, #888)' }}> — {tool.description}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BundleCard() {
  const props = useOpenAIGlobal('toolOutput') as BundlePayload | null;
  const maxHeight = useMaxHeight() ?? null;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const style = maxHeight ? { maxHeight, overflow: 'auto' } : undefined;
  const canExpand = displayMode !== 'fullscreen' && typeof requestDisplayMode === 'function';

  if (!props) {
    return (
      <AppShell style={style}>
        <Card title="Tool Bundle" badge={{ label: 'Loading' }}>
          <EmptyState message="Loading bundle..." />
        </Card>
      </AppShell>
    );
  }

  const { bundle, bundles, hasAccess, remainingUses, total, categories } = props;

  // Single bundle detail view
  if (bundle) {
    const accessLabel = hasAccess ? `${remainingUses ?? '∞'} uses left` : 'No Access';
    
    return (
      <AppShell style={style}>
        <Card
          title={bundle.name || 'Tool Bundle'}
          badge={{ label: hasAccess ? 'Owned' : formatPrice(bundle.priceUsdc) }}
          actions={
            canExpand ? (
              <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
                Expand
              </button>
            ) : null
          }
        >
          <BundleItem bundle={bundle} showDetails />
          {hasAccess && (
            <Status>
              <span>{accessLabel}</span>
            </Status>
          )}
          {!hasAccess && bundle.priceUsdc != null && bundle.priceUsdc > 0 && (
            <Warning>Purchase this bundle to access the tools.</Warning>
          )}
        </Card>
      </AppShell>
    );
  }

  // Bundle list view
  if (bundles && bundles.length > 0) {
    return (
      <AppShell style={style}>
        <Card
          title="Tool Bundles"
          badge={{ label: `${total ?? bundles.length} found` }}
          actions={
            canExpand ? (
              <button className="dexter-link" onClick={() => requestDisplayMode?.({ mode: 'fullscreen' })}>
                Expand
              </button>
            ) : null
          }
        >
          {bundles.slice(0, 10).map((b, idx) => (
            <BundleItem key={b.id || idx} bundle={b} />
          ))}
          {bundles.length > 10 && (
            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--dexter-text-muted, #888)', padding: '8px' }}>
              +{bundles.length - 10} more bundles
            </div>
          )}
          {categories && categories.length > 0 && (
            <Status>
              <span>Categories: {categories.join(', ')}</span>
            </Status>
          )}
        </Card>
      </AppShell>
    );
  }

  // Empty state
  return (
    <AppShell style={style}>
      <Card title="Tool Bundles" badge={{ label: 'Empty' }}>
        <EmptyState message="No bundles found" />
      </Card>
    </AppShell>
  );
}

const root = document.getElementById('bundle-card-root');
if (root) {
  createRoot(root).render(<BundleCard />);
}

export default BundleCard;
