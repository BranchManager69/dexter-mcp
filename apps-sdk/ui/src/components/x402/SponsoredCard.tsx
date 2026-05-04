/**
 * SponsoredCard — visible-on-screen render of an Instinct sponsored
 * recommendation, surfaced after a successful x402_fetch call.
 *
 * The recommendation arrives in toolOutput.recommendations[0] (promoted by
 * open-mcp's x402_fetch handler from either the body-injected
 * `_x402_sponsored` field or the facilitator's
 * extensions["sponsored-access"] block — see the secret sauce doc).
 *
 * Visual design notes:
 * - Distinct from SearchResultCard so demo audiences can tell sponsored
 *   placements apart from editorial search hits at a glance.
 * - Compact single-row layout — sits BELOW the API response data,
 *   inside the same execution-ledger frame, so the user reads the
 *   primary result first and the recommendation second.
 * - "Sponsored" tag in the corner with the Dexter orange accent;
 *   sponsor name prominent; description in two lines max with a
 *   tasteful clamp; one primary CTA.
 * - Animated entry (slide-up + fade) so the eye notices when it
 *   appears — important for stage demos where the audience needs
 *   to register that something showed up.
 */

import { useEffect, useState } from 'react';
import { Button } from '@openai/apps-sdk-ui/components/Button';

export interface Recommendation {
  resourceUrl: string;
  method?: string;
  description: string;
  sponsor: string;
  bazaarId?: string;
}

function shortenUrl(url: string, max = 56): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname === '/' ? '' : u.pathname;
    const combined = host + path;
    if (combined.length <= max) return combined;
    return combined.slice(0, max - 1) + '…';
  } catch {
    return url.length > max ? url.slice(0, max - 1) + '…' : url;
  }
}

export function SponsoredCard({
  recommendation,
  onAct,
}: {
  recommendation: Recommendation;
  onAct?: (url: string, method: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slight delay so the card doesn't pop in before the parent has
    // finished its own entry animation. 220ms feels deliberate, not laggy.
    const t = setTimeout(() => setVisible(true), 220);
    return () => clearTimeout(t);
  }, []);

  const method = (recommendation.method || 'GET').toUpperCase();
  const display = shortenUrl(recommendation.resourceUrl);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[rgba(255,107,0,0.28)] p-4 transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
      style={{
        background:
          'linear-gradient(135deg, rgba(255,107,0,0.10) 0%, rgba(255,107,0,0.04) 48%, rgba(255,107,0,0.02) 100%)',
        boxShadow: '0 12px 28px rgba(255,107,0,0.08), 0 0 0 1px rgba(255,107,0,0.06) inset',
      }}
    >
      {/* Top accent rail — subtle Dexter orange, ties this card visually
          to the parent execution-ledger frame which uses the same accent. */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, #ff6b00 28%, #ff6b00 72%, transparent 100%)',
          opacity: 0.5,
        }}
      />

      <div className="flex items-start gap-3">
        {/* Sponsored tag — vertical, narrow, on the left so it reads as a
            label/lane marker, not as a chip badge competing with content. */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <span
            className="inline-flex items-center rounded-full bg-[rgba(255,107,0,0.18)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#ffb787] ring-1 ring-[rgba(255,107,0,0.35)]"
            title="Sponsored placement matched by Dexter Instinct"
          >
            Sponsored
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-primary leading-tight">
              {recommendation.sponsor}
            </h3>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#ff9a52]/80">
              You might want this next
            </span>
          </div>

          <p className="mt-1.5 text-sm leading-5 text-secondary line-clamp-2">
            {recommendation.description}
          </p>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-tertiary min-w-0">
            <span className="inline-flex items-center rounded bg-surface-secondary/70 px-1.5 py-0.5 font-mono text-[10px] text-secondary ring-1 ring-white/5">
              {method}
            </span>
            <span className="truncate font-mono text-[11px]" title={recommendation.resourceUrl}>
              {display}
            </span>
          </div>
        </div>

        {/* CTA */}
        {onAct && (
          <div className="shrink-0 self-center">
            <Button
              variant="solid"
              color="primary"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onAct(recommendation.resourceUrl, method);
              }}
            >
              Try this →
            </Button>
          </div>
        )}
      </div>

      {/* Footer attribution — quiet, but clearly says where this came from. */}
      <div className="mt-3 pt-2 border-t border-[rgba(255,107,0,0.12)] flex items-center justify-between text-[10px] text-tertiary">
        <span>via Dexter Instinct</span>
        <span className="opacity-60">Recommendations are matched by capability, not by bid.</span>
      </div>
    </div>
  );
}
