# Widget asset brief

Living doc, maintained while the five-widget redesign sweep is in flight
(fetch_result → wallet → card_status → card_issue → card_link_wallet).

This brief lists the **new** assets each redesign needs that don't already
exist in the codebase. It is the input to Branch's image-gen expert agent,
which already has Dexter's branding loaded — so don't re-explain palette,
typography, or voice. Just describe the asset, the slot, and the constraints.

When an entry is delivered, drop the file at the listed path and check the
"Integration" box.

---

## Assets that already exist — do NOT request

| Asset | URL / Source | Use it as-is |
|---|---|---|
| Dexter wordmark | `https://dexter.cash/wordmarks/dexter-wordmark.svg` | Canonical |
| Dexter wordmark (white-on-dark) | `https://dexter.cash/assets/logos/dexter-wordmark-white.svg` | For dark surfaces |
| Dexter wordmark (orange) | `https://dexter.cash/wordmarks/dexter-wordmark-orange.svg` | For light surfaces |
| Dexter glyph | `https://dexter.cash/assets/pokedexter/dexter-logo.svg` | Canonical mark |
| x402gle multi-color text | `<X402gleLockup>` component (`components/brand/X402gleLockup.tsx`) | Render in code |
| x402gle X-with-Dexter-face mark | `https://x402gle.com/x-final-transparent.png` (+ dark/light/orange/square/1024 variants) | Use directly |
| Mastercard mark | inlined data URL in `dextercard/wordmark.ts` | Already loaded by VirtualCard |
| ChainIcon (per chain) | `components/x402/ChainIcon.tsx` | Already used by search/wallet |
| UsdcIcon | `components/x402/ChainIcon.tsx` | Same module |
| VirtualCard + cardThemes | `components/dextercard/` (orange / obsidian / moonagents) | MCP-ready, no asset work needed |
| Professor Dexter avatar | already shipped (pricing widget) | Endpoint widgets only |
| Doctor Dexter avatar | already shipped (pricing widget) | Endpoint widgets only |
| Stamp (A/B/C/D/F) | `components/pricing` | Already used by search drawer |
| Thermometer score gauge | `components/pricing` | Already used by pricing widget |

If a redesign needs one of the above, **use it**. Don't add an entry here.

---

## New assets requested

(populated as redesigns land)

<!--
Entry template:

### Asset N: <name>

- **Used in:** `<widget>` — `<file>:<line>` — short context for the slot
- **Current placeholder:** what's there right now
- **What it should be:** plain-language description of the real asset
- **Format:** SVG | PNG (and why)
- **Dimensions:** rendered px × density factor
- **Color:** monochrome (currentColor) | full-color brand palette
- **Background:** transparent
- **Variants:** light + dark | single
- **Brand notes:** project-specific constraints
- **Drop location:** `dexter-mcp/public/assets/widgets/<file>`
- **Integration:** `[ ]` swap one line at the call site once delivered
-->

---

## Delivery checklist (filled out at end of sweep)

- [ ] All entries have `Drop location` and `Integration` instructions
- [ ] Image-gen agent has access to the URLs / brand reference it needs
- [ ] Final integration commit lands after all assets are dropped
