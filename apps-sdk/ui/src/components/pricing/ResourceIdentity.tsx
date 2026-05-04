import type { EnrichedResource } from './types';
import { formatHitCount } from './types';

interface Props {
  resource: EnrichedResource | null;
  fallbackUrl: string | null;
}

/**
 * The "what is this thing" header.
 *
 * Composes: favicon (from icon_url) + display_name + meta line
 * (category · host · hit count). When enrichment is missing, falls back
 * gracefully to just the URL — the widget never breaks for unknown endpoints.
 */
export function ResourceIdentity({ resource, fallbackUrl }: Props) {
  const name = resource?.display_name || prettyHost(resource?.host || hostFromUrl(fallbackUrl));
  const meta = buildMetaLine(resource, fallbackUrl);
  const icon = resource?.icon_url || null;

  return (
    <div className="dx-pricing__identity">
      <div className="dx-pricing__identity-icon">
        {icon ? (
          <img
            src={icon}
            alt=""
            width={32}
            height={32}
            className="dx-pricing__identity-icon-img"
            aria-hidden
            loading="lazy"
          />
        ) : (
          <div className="dx-pricing__identity-icon-placeholder" aria-hidden />
        )}
      </div>
      <div className="dx-pricing__identity-text">
        <h1 className="dx-pricing__identity-name">{name}</h1>
        {meta ? <p className="dx-pricing__identity-meta">{meta}</p> : null}
      </div>
    </div>
  );
}

function buildMetaLine(resource: EnrichedResource | null, fallbackUrl: string | null): string {
  const parts: string[] = [];
  if (resource?.category) parts.push(resource.category);
  const host = resource?.host || hostFromUrl(fallbackUrl);
  if (host) parts.push(host);
  if (typeof resource?.hit_count === 'number' && resource.hit_count > 0) {
    parts.push(`${formatHitCount(resource.hit_count)} calls`);
  }
  return parts.join(' · ');
}

function hostFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function prettyHost(host: string | null): string {
  if (!host) return 'Unknown endpoint';
  // Strip www. for display only.
  return host.replace(/^www\./i, '');
}
