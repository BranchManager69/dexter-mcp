# OpenDexter Boundary Review and Migration Plan

## Why This Document Exists

OpenDexter currently lives inside `dexter-mcp`, but it is only one product surface in a much broader repository. That has created a packaging and visibility problem:

- the local OpenDexter npm package is a reasonable public client surface
- the hosted OpenDexter connector is server-side product infrastructure
- the authenticated Dexter MCP server and broader toolsets are platform code, not OpenDexter core

The repo boundary does not reflect those distinctions cleanly enough. This document records the diagnosis, the recommended boundary, and a practical migration plan.

## Current Diagnosis

The repository currently mixes three different concerns:

1. Local self-custody OpenDexter client
2. Hosted OpenDexter connector and session infrastructure
3. Broader authenticated Dexter MCP platform

That means the public-facing OpenDexter story is not separated cleanly from the hosted and authenticated platform logic that powers it.

### Why This Is a Problem

- A public local client is acceptable and useful for adoption.
- Hosted session management, managed settlement, auth, and platform composition are not the same thing as the local client.
- The current repo layout makes it too easy to treat all of that as one product boundary when it is not.
- The same x402 product family is implemented multiple times, which increases duplication and makes future splitting harder.

## What Exists Today

### 1. Hosted OpenDexter

Primary files:

- `open-mcp-server.mjs`
- `lib/open-session-resolution.mjs`

What this surface does:

- exposes the public `open.dexter.cash/mcp` connector
- manages anonymous session wallets
- creates and resumes sessions
- handles hosted `x402_search`, `x402_check`, `x402_fetch`, `x402_pay`, `x402_access`, and `x402_wallet`

Why this matters:

- this is not just a client package
- it depends on backend session lifecycle and hosted API behavior

### 2. Local OpenDexter npm package

Primary files:

- `packages/mcp/package.json`
- `packages/mcp/src/index.ts`
- `packages/mcp/src/server/index.ts`
- `packages/mcp/src/tools/*`
- `packages/mcp/src/wallet/*`
- `packages/x402-discovery/*`

What this surface does:

- ships `@dexterai/opendexter`
- ships the thin alias package `@dexterai/x402-discovery`
- provides local stdio MCP server behavior
- provides local wallet creation, funding rails, setup UX, spend controls, and local x402 flows

Why this matters:

- this is the most natural public package boundary
- it is self-custody oriented and can remain open without exposing the full hosted platform

### 3. Shared x402 widget/UI surface

Primary files:

- `apps-sdk/ui/src/entries/x402-wallet.tsx`
- `apps-sdk/ui/src/entries/x402-pricing.tsx`
- `apps-sdk/ui/src/entries/x402-fetch-result.tsx`
- `apps-sdk/ui/src/entries/x402-marketplace-search.tsx`
- `apps-sdk/ui/src/components/x402/*`

What this surface does:

- renders wallet, pricing, fetch-result, and marketplace UIs
- normalizes wallet payloads across multiple producers
- presents search, pricing, payment, and access results

Why this matters:

- most of this is display-layer code
- it is relatively safe to keep public if desired
- widget registration for the broader platform is a separate concern from the x402 widgets themselves

### 4. Broader authenticated Dexter MCP platform

Primary files:

- `http-server-oauth.mjs`
- `clients/x402Client.mjs`
- `registry/x402/index.mjs`
- `toolsets/index.mjs`
- most of `toolsets/*`
- `apps-sdk/register.mjs`

What this surface does:

- hosts the authenticated Dexter MCP server
- resolves managed wallets and auth context
- handles settlement brokering against hosted APIs
- dynamically registers wider Dexter platform tools
- includes non-OpenDexter product areas like wallet, Solana, Hyperliquid, Codex, Studio, identity, and other platform toolsets

Why this matters:

- this is clearly broader than OpenDexter
- this is where the platform moat and operational complexity live

## Boundary Smells

The current structure has several strong indicators that the boundary is wrong:

### The same x402 tool family exists in three places

- `open-mcp-server.mjs`
- `packages/mcp/src/tools/*`
- `toolsets/x402-client/index.mjs`

This creates duplicated logic and makes it easy to confuse product boundaries.

### Widget metadata is repeated

- `open-mcp-server.mjs`
- `packages/mcp/src/widget-meta.ts`
- `toolsets/widgetMeta.mjs`

This is another sign that the same product surface is stretched across unrelated layers.

### The local package is cleanly bounded, but the repo is not

`packages/mcp` already looks like a coherent public client package. The rest of the repo does not line up behind that boundary.

### The authenticated `opendexter` profile is only a filtered view

`toolsets/index.mjs` uses an `opendexter` profile, but that is still a configuration mode inside the broader hosted platform, not a true package boundary.

## Recommended Boundary

### Keep Public

These are good candidates to remain public:

- `packages/mcp`
- `packages/x402-discovery`
- local wallet creation, storage, vanity generation, and funding rails
- local `x402_search`, `x402_check`, `x402_fetch`, `x402_pay`, `x402_access`, and `x402_settings`
- local install/setup UX
- x402 widget rendering components and x402 widget entry files

Reasoning:

- this is self-custody client behavior
- this is product adoption surface
- this is not the strongest source of moat
- a public client package is compatible with the ecosystem goals of MCP and agent support

### Move Private or Behind Hosted Boundaries

These should be treated as private platform code or moved to a private repo/service boundary:

- `open-mcp-server.mjs`
- `lib/open-session-resolution.mjs`
- `http-server-oauth.mjs`
- `clients/x402Client.mjs`
- `registry/x402/index.mjs`
- most of `toolsets/*`
- wider widget registration for the full platform in `apps-sdk/register.mjs`

Reasoning:

- session wallet lifecycle is a hosted backend concern
- managed settlement and payment-header brokering are platform concerns
- auth, OAuth, identity, and entitlements are private platform concerns
- dynamic tool registration from the catalog is closer to platform intelligence than local client code
- non-x402 Dexter toolsets are not part of the OpenDexter product boundary

## Practical Recommendation

The cleanest target state is:

### Public repo/package

A public OpenDexter client repository that contains:

- `@dexterai/opendexter`
- `@dexterai/x402-discovery`
- optional shared x402 widget/types package if needed

This repo should own:

- self-custody local wallet logic
- local x402 client flows
- setup/install UX
- public package docs
- x402 widget rendering code if it is useful to keep open

### Private repo/platform

A private Dexter platform repository that contains:

- hosted OpenDexter connector
- authenticated Dexter MCP server
- hosted session resolution
- managed settlement plumbing
- dynamic platform tool registration
- all broader Dexter toolsets and auth logic

This repo should own:

- private operational logic
- differentiated catalog plumbing
- managed user/session wallet flows
- broader platform composition

## What We Already Did

As immediate npm-package hardening, we already improved the public local package:

- removed published source maps from `@dexterai/opendexter`
- added a pack verification guard so `.map` files fail publish
- enabled minification for the published bundle
- preserved `skills/SKILL.md` for skill-aware agent ecosystems

This was worth doing, but it is not a substitute for fixing the repo boundary.

## Migration Plan

### Phase 0: Stop the Bleeding

Immediate rule:

- do not add new hosted, managed-settlement, auth, or platform-only logic to the public OpenDexter client package

Goal:

- prevent the public surface from growing in the wrong direction while the boundary is still blurry

### Phase 1: Declare the Public OpenDexter Surface

Treat `packages/mcp` as the official public product boundary.

Do:

- keep package docs centered on the local self-custody client
- keep local wallet and x402 client flows there
- avoid reaching further into authenticated platform internals from the local package

Goal:

- establish a stable public product boundary without a full repo split yet

### Phase 2: Extract Shared Pure Helpers

Before moving hosted/platform code, reduce duplication by extracting helpers that are genuinely safe to share:

- wallet payload types/schema
- shared x402 widget payload types
- marketplace result normalization helpers
- widget metadata helpers if they are truly generic

Goal:

- reduce copy-paste before the repo split
- separate pure data-shape code from hosted/platform logic

### Phase 3: Move Hosted OpenDexter and Platform Logic

Move or recreate these in a private repo/platform boundary:

- `open-mcp-server.mjs`
- `lib/open-session-resolution.mjs`
- `http-server-oauth.mjs`
- `clients/x402Client.mjs`
- `registry/x402/index.mjs`
- broader `toolsets/*`

Goal:

- make hosted OpenDexter and authenticated Dexter MCP platform concerns private

### Phase 4: Leave a Thin Public Client

After the move, the public repo should read clearly as:

- install OpenDexter
- create or load a local wallet
- search x402 endpoints
- inspect pricing
- pay locally with self-custody
- access wallet-auth endpoints locally when appropriate

Goal:

- the public repo becomes easy to explain, easy to maintain, and aligned with what users actually install

## Decision Framework

If a feature depends on any of the following, it probably belongs behind the hosted/private boundary:

- managed wallets
- session tokens
- auth/OAuth identity
- dynamic registration from private catalog state
- settlement brokering through hosted platform endpoints
- broader Dexter product entitlements

If a feature is mostly any of the following, it is usually safe to leave public:

- local self-custody wallet logic
- user-run CLI and setup flows
- local request shaping
- display-layer widgets
- purely client-side policy checks
- local x402 signing behavior using the user’s own keys

## Recommended First Moves

If only a few things happen next, do these:

1. Treat `packages/mcp` as the public OpenDexter product boundary.
2. Stop adding new hosted/platform logic to the public client.
3. Extract shared pure helper/types to reduce duplication.
4. Plan a private home for hosted OpenDexter and authenticated Dexter MCP.
5. Move the managed/session/auth/registry layers out of the public repo.

## Bottom Line

The main issue is not minification or sourcemaps. The main issue is that the repo boundary does not match the product boundary.

OpenDexter should be a thin public self-custody client surface.

Hosted OpenDexter session logic, authenticated Dexter MCP platform logic, settlement brokering, auth, and platform composition should live behind private or hosted boundaries.
