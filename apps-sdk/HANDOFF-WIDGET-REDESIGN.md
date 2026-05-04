# Widget redesign handoff — read this first

**Filed:** 2026-05-04 (post-compaction handoff)
**Owner:** Branch
**Author:** Claude Opus 4.7 (1M)
**Scope:** Visual + structural redesign of the 7 Dexter widgets — 4 x402 + 3 Dextercard
**Status:** Foundation/audit done, no code touched. Pass 1 ready to start.

If you're a fresh session reading this cold: this is everything you need to know to pick up the widget redesign work without re-deriving any of it. Read end-to-end before touching files.

---

## Why this work exists

Branch wants the 7 widgets that render in ChatGPT and Claude.ai (via MCP Apps) to look like one polished product instead of seven mismatched ones. They function correctly — today's session fixed the rendering plumbing — but visually they're undercooked, inconsistent, and use two different design vocabularies running in parallel.

His direct words: "they need to be beautiful, tremendous components." Also: "we're not gonna fucking leave any undone. They all have to be updated properly."

So the deliverable is **all 7 widgets brought up to a single high-quality visual standard**, not a triage where some get polished and others stay. Order matters for sequencing the work, but every widget gets done.

---

## The 7 widgets in scope

**x402 protocol surfaces (4):**

| Widget | Entry file | Lines | What it shows |
|---|---|---|---|
| x402_marketplace_search | `apps-sdk/ui/src/entries/x402-marketplace-search.tsx` | 535 | Paid-API search results with quality rings, prices, fetch buttons |
| x402_fetch_result | `apps-sdk/ui/src/entries/x402-fetch-result.tsx` | 343 | API response viewer with payment receipt + the SponsoredCard |
| x402_pricing | `apps-sdk/ui/src/entries/x402-pricing.tsx` | 199 | Endpoint pricing per chain with payment amounts and pay button |
| x402_wallet | `apps-sdk/ui/src/entries/x402-wallet.tsx` | 370 | Session wallet address, USDC/SOL balances, deposit QR code |

**Dextercard (3):**

| Widget | Entry file | Lines | What it shows |
|---|---|---|---|
| card_status | `apps-sdk/ui/src/entries/card-status.tsx` | 179 | Card stage, account, metadata, linked wallets, recent transactions |
| card_issue | `apps-sdk/ui/src/entries/card-issue.tsx` | 259 | Stage-aware issuance wizard: identity → KYC → terms → card creation |
| card_link_wallet | `apps-sdk/ui/src/entries/card-link-wallet.tsx` | 104 | Wallet → card spend authorization with cap and link status |

**Out of scope:** the other 31 widgets in `entries/`. Branch confirmed they're dead. Do not spend time on them.

---

## How widgets actually render (you need to know this)

Critical context. Don't skip.

```
~/websites/dexter-mcp/apps-sdk/
├── ui/                              ← React monorepo for widgets
│   ├── src/
│   │   ├── entries/                 ← One .tsx per widget (the React mount points)
│   │   ├── components/
│   │   │   ├── AppShell.tsx         ← Layout primitives (used by Dextercard, NOT by x402)
│   │   │   ├── x402/                ← Shared x402 building blocks
│   │   │   │   ├── ChainIcon.tsx
│   │   │   │   ├── CopyButton.tsx
│   │   │   │   ├── DebugPanel.tsx
│   │   │   │   ├── JsonViewer.tsx
│   │   │   │   ├── QualityBadge.tsx
│   │   │   │   ├── SponsoredCard.tsx ← committed today, used by x402_fetch_result
│   │   │   │   ├── format.ts
│   │   │   │   ├── useIntrinsicHeight.ts
│   │   │   │   ├── walletPayload.ts
│   │   │   │   └── search/         ← marketplace-search-specific subcomponents
│   │   │   └── dextercard/         ← Card-specific blocks (VirtualCard, cardThemes, wordmark)
│   │   ├── sdk/                    ← Runtime hooks (DO NOT TOUCH unless intentional)
│   │   └── styles/
│   │       ├── base.css            ← 53 lines, foundational resets
│   │       ├── components.css      ← 194 lines, shared component styles
│   │       ├── index.css           ← 7 lines, entry point
│   │       ├── sdk.css             ← 17 lines (almost empty — surprisingly)
│   │       └── widgets/            ← per-widget stylesheets (mostly DEAD widgets, not ours)
│   └── package.json
├── vite.config.ts                   ← Build config (entries → bundles)
├── widget-uris.mjs                  ← `ui://dexter/{name}-{hash}` URI generation
├── bootstrap.js                     ← Inline boot script injected into every widget HTML
└── register.mjs                     ← Maps each entry → MCP resource registration
```

**Build pipeline (`npm run build:apps-sdk`):**

1. Vite bundles each `entries/*.tsx` → `public/apps-sdk/{name}.html` shell + `public/apps-sdk/assets/{name}-{hash}.js` chunked code + CSS bundles + sourcemaps.
2. `register.mjs` reads each HTML at MCP server boot, rewrites asset paths to absolute URLs (`https://dexter.cash/mcp/app-assets/...`), injects `bootstrap.js` into `<head>`, registers as MCP resource at `ui://dexter/{name}-{hash}` with mimeType `text/html;profile=mcp-app`.
3. Both MCP servers (`dexter-open-mcp` at `open.dexter.cash/mcp` and `dexter-mcp` at `mcp.dexter.cash/mcp`) call `registerAppsSdkResources` and expose the widgets.

**Runtime in the host:**

1. Host fetches the resource HTML, mounts in a sandboxed iframe.
2. `bootstrap.js` runs, detects ChatGPT (`window.openai` present) vs MCP-Apps (iframe parent + bridge handshake).
3. SDK hooks (`useToolOutput`, `useToolInput`, `useAdaptiveTheme`, etc.) deliver the tool data into the React tree.
4. Component renders.

**The dual-runtime SDK is solid. Don't touch it.** Today's session fixed six bridge-spec compliance bugs (commit `46bb361`); the plumbing is correct on both ChatGPT and Claude. Visual work happens in components, styles, and entries — not in `sdk/`.

---

## Honest audit findings (real issues, not just opinions)

### What's genuinely solid

- **Dual-runtime SDK hooks** in `sdk/`. Touched and verified today. Leave them alone.
- **`SponsoredCard.tsx`, `ChainIcon.tsx`, `CopyButton.tsx`, `QualityBadge.tsx`, `JsonViewer.tsx`** — clean, small, single-purpose. Good base components.
- **The 3 Dextercard entries (`card-status`, `card-issue`, `card-link-wallet`)** all use `AppShell` / `Card` from `components/AppShell.tsx`. That's the right pattern.

### Structural issues (these drive the work)

1. **The 4 x402 entries don't use AppShell.** Each hand-rolls its own layout with raw Tailwind utility classes. `className=` instances per file: marketplace-search 31, wallet 57, fetch-result 43, pricing 32. Every widget container, header, and section is bespoke. **This is the #1 reason they don't feel like one product.**

2. **Two design vocabularies in parallel.**
   - **Cards** use a CSS-class system (`dexter-card`, `dexter-card__header`, BEM-flavored).
   - **x402** uses raw Tailwind utility soup.
   - Same product, two design systems. Visual coherence is impossible until reconciled.

3. **Entry files are too long, doing too much.** 535/343/199/370/179/259/104 lines. The 535-line `x402-marketplace-search.tsx` does routing + state + layout + visual rendering inline. There's no Card/Header/Body/Footer abstraction so every refactor is JSX surgery.

4. **No widget-specific CSS for our 7 widgets.** `styles/widgets/` has 31 files for DEAD widgets (`async-job.css`, `pumpstream.css`, `pokedexter.css`, etc.) and only `dextercard.css` + `search.css` overlap with our scope, both partial. **The 7 widgets we care about don't have dedicated stylesheets. The 31 we don't care about do. Backwards.**

5. **`styles/sdk.css` is only 17 lines.** Almost empty. The "shared design system" file is essentially nonexistent — design tokens, spacing, type, color all live as fragmented Tailwind class strings (`text-tertiary`, `bg-surface`, `border-subtle`) with no canonical definition.

6. **No documented design tokens.** Spacing, type scale, color roles, radii, motion — none of it is named or codified. This means a "design refresh" has nowhere to start because there's no single file to change.

### What's missing (will need to be built)

- A reusable `<WidgetShell>` for x402. The Dextercard side has it; x402 doesn't.
- A standardized loading-state component. Every widget rolls its own `if (!toolOutput) return <p>Loading...</p>` block; they all look different.
- A standardized empty/error-state component.
- A consistent heading/section pattern.
- Documented spacing tokens and a type scale.
- A per-widget CSS file convention for our 7 (mirroring the way Dextercard already has `dextercard.css`).

---

## The plan — three passes, no widgets skipped

### Pass 1 — design foundation (one focused session, ~half a day)

The substrate. Without it, per-widget work goes in 7 different directions.

**Files affected:**
- `styles/sdk.css` (currently 17 lines — expand to be the real source of truth)
- New file: `styles/tokens.css` (or a section inside sdk.css) with documented design tokens
- `styles/components.css` (audit, dedupe, align with new tokens)

**Deliverables:**
- Spacing scale (e.g. `--space-1` through `--space-8`)
- Type scale (display / title / heading / body / caption / mono — each with size, weight, line-height)
- Color roles for both dark and light themes — surface / surface-elevated / surface-muted / text-primary / text-secondary / text-tertiary / accent / accent-muted / border-subtle / border-strong / status-success / status-warn / status-error
- Border-radius scale
- Motion tokens (durations, easings)
- Document that `data-theme="dark|light"` on the root drives the theme, set by `useAdaptiveTheme()`

This pass produces no visual change in any widget. It's the substrate the other passes build on.

### Pass 2 — shared shell components (~3-4 components, ~half a day)

The visual grammar. Builds the components every widget will compose with.

**New files:**
- `components/shell/WidgetShell.tsx` — outer container with consistent padding, max-width, theme handling. Replaces the inline `<div className="p-4 ...">` openings in every x402 entry.
- `components/shell/WidgetHeader.tsx` — title + optional subtitle + optional badge + optional actions row. One component handles every widget's header.
- `components/shell/WidgetSection.tsx` — card-like grouping for body content. Replaces the bespoke `rounded-2xl border bg-surface` divs scattered across entries.
- `components/shell/WidgetLoadingState.tsx` — replaces the 7 different ad-hoc spinners.
- `components/shell/WidgetEmptyState.tsx` and `components/shell/WidgetErrorState.tsx` — same logic.

**Decision needed during Pass 2:** Either evolve `AppShell.tsx` (which Dextercard uses) into the new `WidgetShell` so cards and x402 share one shell, OR build the new shell alongside and migrate cards to it. Branch's preference will likely be "one shell for both" — get explicit confirmation before committing to either path.

### Pass 3 — per-widget redesign (~7 widgets, varies)

Each widget gets cut down: trim the entry file, move bespoke layout into `<WidgetShell>` / `<WidgetSection>`, kill inline Tailwind soup, add a per-widget CSS file in `styles/widgets/` only for genuinely widget-specific styles.

**Recommended order (do all of them, this is sequencing not prioritization):**

1. **`x402-fetch-result`** — most visible widget. Carries the SponsoredCard. Reskinning this first gives SponsoredCard its proper home.
2. **`x402-wallet`** — second-most-visible. Branch verified this rendering live in Claude tonight. Already mostly intact.
3. **`x402-marketplace-search`** — 535 lines, biggest cleanup opportunity. Has its own `search/` subcomponent dir already.
4. **`x402-pricing`** — small surface, easy quick-win after the bigger ones.
5. **`card-status`** — already on AppShell, mostly polish.
6. **`card-issue`** — wizard flow, more design thinking. Has stage-aware UI that needs its own pattern.
7. **`card-link-wallet`** — smallest, do last to validate the system.

Per-widget work: ~1-3 hours each depending on complexity. Total Pass 3: ~1.5 days of focused work.

---

## Three things to ask Branch BEFORE writing code

These shape everything. Don't skip.

1. **Visual references.** Screenshots of the 7 widgets as they look today, in real Claude/ChatGPT sessions. Reading source forever won't tell you what bothers him visually. Phone screenshots are fine.

2. **Aspirational references.** What other product UIs look the way he wants? Linear / Vercel / Apple / Anthropic / Stripe / something else. Two or three references is plenty.

3. **Tone direction.** Three buckets, get an explicit pick:
   - "Minimal and quiet" — lots of negative space, restrained color
   - "Bold and confident" — big type, hard accents, opinionated layout
   - "Dense and instrumental" — Bloomberg-ish, information-rich
   The codebase currently drifts between all three. The drift is half the visual problem.

Once you have those three, you can propose Pass 1 concretely and start.

---

## Things you must NOT do

- **Do not touch `sdk/` (the SDK hooks).** Today's session fixed six rendering-bridge bugs. The plumbing is correct. If you change `useToolOutput`, `useAdaptiveTheme`, `mcp-apps-bridge.ts`, etc., you risk re-breaking Claude.ai rendering.
- **Do not change MIME types in `register.mjs`.** It's `text/html;profile=mcp-app` (the spec-compliant value). NOT `text/html+skybridge`. Reverting that breaks Claude.
- **Do not change `protocolVersion`, `appCapabilities`, `appInfo`, the `ui/notifications/initialized` send, or the size-changed notifications in `mcp-apps-bridge.ts`.** All six are spec-required, all six were missing, all six were fixed today.
- **Do not work on widgets outside the 7 in scope.** The other 31 are dead per Branch.
- **Do not assume the "11 widgets on authenticated MCP" framing was correct.** Earlier-in-the-day mental model was wrong. Both MCP servers expose all entries declared in `register.mjs` (filtered by allowlist on the open MCP). If you need to know what's exposed where, run `resources/list` against each MCP.
- **Do not start Pass 3 (per-widget) before Pass 1 and 2 are done.** Going widget-by-widget without the shared shell and tokens means you'll redo it all when the system finally lands.
- **Do not ship without rebuilding + restarting.** After ANY change to `apps-sdk/ui/src/`, `apps-sdk/register.mjs`, or `apps-sdk/bootstrap.js`:
  ```
  npm run build:apps-sdk
  pm2 restart dexter-open-mcp dexter-mcp
  ```
  Otherwise the running MCPs serve stale HTML and your changes don't hit the host.

---

## Operational reference

### Build + deploy commands

```bash
cd ~/websites/dexter-mcp

# Build apps-sdk widgets (vite + sourcemap upload)
npm run build:apps-sdk

# Restart both MCPs to pick up new bundles
pm2 restart dexter-open-mcp dexter-mcp

# Or, after any code change in dexter-mcp itself (not just apps-sdk):
npm run deploy:mcp  # builds apps-sdk + restarts dexter-mcp
```

### Verifying a widget actually picked up your change

```bash
# Initialize an MCP session against the open MCP
curl -sS -X POST https://open.dexter.cash/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -D /tmp/h.txt \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"v","version":"0.1"}}}' > /dev/null
SID=$(awk -F': ' '/^mcp-session-id:/ {print $2}' /tmp/h.txt | tr -d '\r')

# Required: send the initialized notification
curl -sS -X POST https://open.dexter.cash/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' > /dev/null

# List widgets — confirms the 7 are exposed and using text/html;profile=mcp-app
curl -sS -X POST https://open.dexter.cash/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}'

# Check a specific widget's served HTML (use the URI from resources/list)
# The HTML's bootstrap and asset hashes will reflect what's currently live.
```

### Real-host visual testing

Branch will do this himself; you can't do it from a CLI. After your build + restart:

- Fresh ChatGPT session with OpenDexter MCP installed → run any tool that uses one of your widgets → screenshot
- Fresh Claude.ai web session with OpenDexter MCP connector enabled → same → screenshot

He confirmed `x402_wallet` rendering tonight in Claude.ai. The other 6 are technically working (same handshake) but unverified visually.

### Brand tokens (current state, by code-grep)

- Brand orange / accent: appears as inline hex in entries. Not tokenized.
- Wordmark: `https://dexter.cash/wordmarks/dexter-wordmark.svg`
- Logo mark: `https://dexter.cash/assets/pokedexter/dexter-logo.svg`
- Existing dark-mode pattern: `data-theme="dark"` on root, CSS classes like `bg-surface`, `text-secondary` cascade.

When Pass 1 happens, ALL of these need to land in `tokens.css` (or equivalent) with explicit names.

---

## Branch's stated preferences (carry these forward)

From his global CLAUDE.md and direct instructions today:

- **No bland, boring, generic designs.** No rounded corners everywhere. No over-containerization. No emojis in user interfaces.
- **YES to amazing, striking UIs.** shadcn/ui is acceptable when appropriate.
- **Visual learner.** Diagrams to show structure. Tables to compare options. Don't write paragraphs when a 3-column table works.
- **Lead with structure, not narrative.** When summarizing or proposing, present as labeled blocks/tables, not flat prose.
- **Brand pattern.** "Instinct by Dexter" formal name, "Instinct" informal. Same as "x402gle by Dexter." Apply this convention if any visible brand strings change.

---

## Today's session context (so you know what just happened)

If a fresh session is reading this, here's the wider context:

- Today's main accomplishment: diagnosed and fixed six layered bugs that prevented Dexter MCP widgets from rendering in Claude.ai. Six fixes, all in one commit (`46bb361` in `Dexter-DAO/dexter-mcp`). Documented in detail in that commit message.
- Branch verified `x402_wallet` rendering live in Claude.ai web at the end of the session. The other 6 widgets are presumed to render too (same handshake) but visually unverified.
- The widgets WORK. They just look undercooked. That's why this redesign workstream exists.
- A pending-list snapshot lives at `~/websites/competitive-intel/strategy/instinct/PENDING-2026-05-04.md` covering the broader Instinct workstream. Read it for context, but the visual redesign is its own focused workstream — don't conflate.
- Branch's other parallel agent has been shipping changes too. If something looks like it moved while you weren't looking, it probably did. Always re-check live state before assuming source matches deployment.

---

## What "done" looks like for this whole workstream

1. All 7 widgets render on a coherent visual system. A user opening any of them can tell they're the same product.
2. Spacing, typography, color, motion are tokenized and documented in one place. Future changes happen at the token layer, not by editing each widget.
3. Inline Tailwind utility soup in entries is largely gone, replaced by composed shell components.
4. Dead widget CSS in `styles/widgets/` is either removed or moved aside (don't bundle this with the redesign — separate cleanup PR).
5. Branch can screenshot any of the 7 widgets in real ChatGPT or Claude.ai and feel they look "tremendous" — his word, not yours.

That's the bar. Anything less and Branch will (correctly) push back.

---

## Open questions to resolve in the next session

- Get the three references from Branch (visual / aspirational / tone) before any code.
- Decide: evolve `AppShell.tsx` or build new alongside?
- Decide: keep dead CSS in `styles/widgets/` for now or sweep it out before Pass 1? (Recommend: leave alone, separate PR after redesign lands.)
- Confirm the brand orange hex value(s) used today and tokenize them properly.
