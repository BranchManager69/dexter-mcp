/**
 * VirtualCard — themeable card mockup, MCP widget edition.
 *
 * Faithful port of dexter-fe/app/components/wallet/VirtualCard.tsx.
 * The card's visual identity is driven entirely by the theme passed
 * in. Layout is shared across themes; themes change colors,
 * gradients, and engraving treatment.
 *
 * MCP-specific adaptations:
 *   - Wordmark + Mastercard mark inlined as data URLs (the widget
 *     ships into a sandboxed iframe with no asset path control).
 *   - The dexter-fe "join the waitlist" CTA is replaced by a
 *     stage-aware status pill in the same top-right corner. The pill
 *     reads as part of the card, not under it.
 *   - No `meta` block here; widget entries compose their own meta
 *     content underneath the card based on tool output.
 */

import type { CSSProperties } from 'react';
import { getCardTheme, type CardThemeId } from './cardThemes';
import {
  MASTERCARD_DATA_URL,
  WORDMARK_MASK_URL,
  WORDMARK_WHITE_DATA_URL,
} from './wordmark';

export type CardStage =
  | 'no_session'
  | 'onboarding_required'
  | 'pending_kyc'
  | 'pending_finalize'
  | 'not_issued'
  | 'active'
  | 'frozen';

const STAGE_LABEL: Record<CardStage, string> = {
  no_session: 'Sign In',
  onboarding_required: 'Onboarding',
  pending_kyc: 'KYC',
  pending_finalize: 'Verify',
  not_issued: 'Issuing',
  active: 'Active',
  frozen: 'Frozen',
};

export interface VirtualCardProps {
  cardholderName?: string;
  /** Real last4 from carrier, or a placeholder ('x402'). */
  lastFour?: string;
  /** Real MM/YY from carrier, or a placeholder ('••/••'). */
  expiry?: string;
  theme?: CardThemeId;
  /** Drives the stage pill in the top-right of the card. */
  stage?: CardStage;
}

export function VirtualCard({
  cardholderName,
  lastFour = 'x402',
  expiry = '••/••',
  theme: themeId = 'orange',
  stage,
}: VirtualCardProps) {
  const theme = getCardTheme(themeId);
  const name = (cardholderName || 'Dexter Holder').toUpperCase();

  const cardStyle: CSSProperties = {
    background: theme.background,
    boxShadow: `
      0 1px 0 0 ${theme.edgeHighlight} inset,
      0 -1px 0 0 ${theme.edgeShadow} inset,
      0 18px 36px -16px ${theme.outerShadow},
      0 6px 12px -4px rgba(0, 0, 0, 0.25)
    `,
    color: theme.textPrimary,
    ['--card-accent' as string]: theme.accent,
    ['--card-accent-light' as string]: theme.accentLight,
    ['--card-text-primary' as string]: theme.textPrimary,
    ['--card-text-secondary' as string]: theme.textSecondary,
    ['--card-texture' as string]: theme.textureColor,
    ['--card-glare-strength' as string]: String(theme.glareStrength),
    ['--card-wordmark-mask' as string]: `url("${WORDMARK_MASK_URL}")`,
  };

  const isEngraved = theme.brandTreatment === 'engraved';

  return (
    <div className="dxc-wrap">
      <div
        className={`dxc-card ${isEngraved ? 'dxc-card-engraved' : ''}`}
        style={cardStyle}
        data-theme={theme.id}
      >
        <div className="dxc-glare" aria-hidden="true" />
        <div className="dxc-grid" aria-hidden="true" />

        <div className="dxc-top-row">
          {isEngraved ? (
            <span
              className="dxc-brand-mark-engraved"
              role="img"
              aria-label="Dexter"
            />
          ) : (
            <img
              src={WORDMARK_WHITE_DATA_URL}
              alt="Dexter"
              className="dxc-brand-mark"
            />
          )}
          {stage ? (
            <span className="dxc-stage-pill" data-stage={stage}>
              {STAGE_LABEL[stage]}
            </span>
          ) : null}
        </div>

        <div className="dxc-chip" aria-hidden="true">
          <div className="dxc-chip-inner" />
        </div>

        <div className="dxc-pan">
          <span className="dxc-pan-group">••••</span>
          <span className="dxc-pan-group">••••</span>
          <span className="dxc-pan-group">••••</span>
          <span className="dxc-pan-group-last">{lastFour}</span>
        </div>

        <div className="dxc-bottom-row">
          <div className="dxc-cardholder-block">
            <span className="dxc-field-label">Cardholder</span>
            <span className="dxc-cardholder-name">{name}</span>
          </div>
          <div className="dxc-expiry-block">
            <span className="dxc-field-label">Expires</span>
            <span className="dxc-expiry-value">{expiry}</span>
          </div>
          {theme.network === 'mastercard' ? (
            <img
              src={MASTERCARD_DATA_URL}
              alt="Mastercard"
              className="dxc-network-mark"
              style={{ opacity: theme.visaOpacity }}
            />
          ) : (
            <svg
              className="dxc-visa-wordmark"
              viewBox="0 0 60 20"
              aria-label="Visa"
              style={{ opacity: theme.visaOpacity }}
            >
              <text
                x="0"
                y="16"
                fontFamily="Inter, system-ui, -apple-system, sans-serif"
                fontWeight="900"
                fontStyle="italic"
                fontSize="20"
                letterSpacing="-0.02em"
                fill={theme.visaColor}
              >
                VISA
              </text>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
