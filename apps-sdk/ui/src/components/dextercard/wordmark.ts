/**
 * Inlined Dexter wordmark SVGs.
 *
 * The widget bundle ships into a sandboxed iframe whose asset paths
 * we don't control. Inlining the wordmark as data URLs makes the
 * card 100% self-contained — no fetches, no broken images, no CSP
 * surprises. Two variants:
 *
 *  - WORDMARK_WHITE_DATA_URL: solid white fill, used by themes whose
 *    brandTreatment is 'plain'.
 *  - WORDMARK_MASK_URL: same path geometry, used as a CSS mask on
 *    the engraved variant so the champagne gradient pours through.
 */

const WORDMARK_SVG_WHITE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 250">
  <g fill="#fff">
    <path d="M11.79,181.18v-112.36h89.11c4.26,0,8.14,1.04,11.62,3.12s6.29,4.87,8.43,8.35c2.13,3.49,3.2,7.36,3.2,11.63v66.16c0,4.17-1.07,8.01-3.2,11.55-2.13,3.54-4.94,6.34-8.43,8.43s-7.36,3.12-11.62,3.12H11.79ZM99.65,156.83v-63.67h-63.83v63.67h63.83Z"/>
    <path d="M141.94,181.18v-112.36h103.78v24.34h-79.27v19.66h63.83v24.34h-63.83v19.66h79.27v24.34h-103.78Z"/>
    <path d="M259.6,181.18v-8.27l40.1-47.91-40.1-47.91v-8.27h25.12l31.21,36.99,30.9-36.99h25.12v8.27l-40.26,47.91,40.26,47.75v8.43h-25.12l-31.21-36.83-30.9,36.83h-25.12Z"/>
    <path d="M426.27,181.18v-88.01h-44.01v-24.34h112.36v24.34h-44.01v88.01h-24.34Z"/>
    <path d="M506.63,181.18v-112.36h103.77v24.34h-79.27v19.66h63.83v24.34h-63.83v19.66h79.27v24.34h-103.77Z"/>
    <path d="M625.85,181.18v-112.2h89.11c4.26,0,8.14,1.04,11.63,3.12,3.48,2.08,6.29,4.89,8.43,8.43,2.13,3.54,3.2,7.39,3.2,11.55v29.02c0,4.16-1.07,8.01-3.2,11.55-2.13,3.54-4.94,6.35-8.43,8.43-3.49,2.08-7.36,3.12-11.63,3.12l-64.92.16v36.83h-24.19ZM713.71,119.85v-26.69h-63.67v26.69h63.67ZM713.09,181.18l-32.61-38.86h31.68l25.9,30.59v8.27h-24.97Z"/>
  </g>
</svg>`;

export const WORDMARK_WHITE_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(WORDMARK_SVG_WHITE)}`;

/** Same SVG, used as a CSS mask source for the engraved variant. */
export const WORDMARK_MASK_URL = WORDMARK_WHITE_DATA_URL;

/**
 * Inlined Mastercard interlocking-circles mark. Faithful to brand
 * (red #eb001b, yellow #f79e1b, blended overlap #ff5f00). No
 * trademarks asserted; mark is used to indicate payment network.
 */
const MASTERCARD_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 56">
  <circle cx="32" cy="28" r="24" fill="#eb001b"/>
  <circle cx="56" cy="28" r="24" fill="#f79e1b"/>
  <path d="M44 11.6a23.94 23.94 0 0 1 0 32.8 23.94 23.94 0 0 1 0-32.8z" fill="#ff5f00"/>
</svg>`;

export const MASTERCARD_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(MASTERCARD_SVG)}`;
