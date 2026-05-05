# Phase C Contract — MCP Widget Surface for Passkey Enrollment

This document defines what Phase C (the ChatGPT/Claude MCP widget for passkey enrollment) needs from Phase A so the two phases compose without ad-hoc coupling. Phase A is the source of truth for actual implementation; Phase C consumes the interfaces below.

**Companion docs:**
- Architecture: `~/websites/dexter-api/docs/superpowers/specs/2026-05-04-passkey-swig-architecture.md`
- Implementation plan: `~/websites/dexter-api/docs/superpowers/plans/2026-05-04-passkey-swig-implementation.md`

This contract reflects the empirical reality that **MCP widget iframes cannot run WebAuthn directly** (probed 2026-05-04 on Claude.ai mobile Safari + Claude iOS app: `navigator.credentials.create` blocked by ancestor-origin isolation, `window.open` returns null, `<a target="_blank">` taps are silently swallowed). The only spec-blessed escape hatch is JSON-RPC `ui/open-link`, confirmed honored by Claude. Phase C therefore takes the popout fallback branch from Phase C / Task C1.

---

## Sequencing

Phase C is **gated on Phase A landing**. Specifically Phase C cannot start until:

1. `/wallet/setup` on dexter.cash runs the native passkey enrollment flow (Phase A, Task A17).
2. `/api/vault/initialize` accepts a passkey-authenticated user and returns a provisioned vault address (Task A14).
3. The `user_vaults` table is the source of truth for "this user has a vault" (Task A9).
4. `.well-known/webauthn` lists `https://open.dexter.cash` so the MCP widget origin is authorized for the dexter.cash passkey (Phase B, Task B1).

Until those land, Phase C is a paper interface.

---

## Inputs Phase C provides

When the MCP `dexter_passkey` tool is invoked by an agent, it calls into dexter-api to mint an enrollment intent and returns to the widget the URL the user should open.

### Required server-side endpoint Phase A must provide

```
POST /api/passkey/intent
```

**Authentication:** authenticated user (Supabase JWT or MCP-bound bearer; same auth surface as the rest of dexter-api's `/api/*` routes).

**Request body:**

```jsonc
{
  "purpose": "mcp_enroll",       // see "Intent purposes" below
  "client_origin": "open.dexter.cash",
  "agent_label": "Claude",        // free-form, used in the popout copy
  "metadata": { ... }             // optional, passed through to the popout
}
```

**Response body:**

```jsonc
{
  "intent_id": "1f6e0d38-...",    // opaque, server-issued UUID
  "enroll_url": "https://dexter.cash/wallet/setup?intent=1f6e0d38-...&purpose=mcp_enroll&return=mcp",
  "expires_at": "2026-05-05T01:30:00Z",
  "vault_status": "none"          // "none" | "provisioning" | "ready"; if "ready", widget can short-circuit
}
```

`enroll_url` is opaque to the widget — Phase A constructs it. The widget MUST NOT parse, edit, or reconstruct it; it just hands the string to `app.openLink()`.

### Required server-side endpoint Phase A must provide

```
GET /api/passkey/intent/:intent_id/status
```

**Authentication:** same authenticated user that created the intent. The intent is bound to a user_id; status reads MUST verify the requester matches.

**Response body:**

```jsonc
{
  "intent_id": "1f6e0d38-...",
  "status": "pending",            // see "Intent status values" below
  "vault": null,                  // populated when status === "completed"
  "expires_at": "2026-05-05T01:30:00Z",
  "completed_at": null,           // ISO timestamp when status flips to "completed"
  "failure_reason": null          // populated when status === "failed"
}
```

When `status === "completed"`, `vault` is populated:

```jsonc
{
  "vault_pda": "VaULTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "swig_address": "Sw1Gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "passkey_credential_id": "<base64url>",
  "chains": [
    { "chain": "solana", "address": "..." }
  ]
}
```

Widget is responsible for polling this endpoint. **Polling cadence is deferred — widget UI decisions hold until Phase A's surface is concrete and we can measure typical end-to-end latency.**

---

## Inputs Phase A provides back

When the user lands on `/wallet/setup?intent=<id>&purpose=<purpose>&return=mcp` and completes the ceremony, Phase A's frontend MUST mark the intent completed server-side before showing the success state. Concretely:

1. User completes the WebAuthn ceremony at `/wallet/setup`.
2. dexter-api provisions the vault (existing Phase A path).
3. dexter-api MUST then mark the intent as completed:
   - Set `status = "completed"`, `completed_at = NOW()`, `vault = { vault_pda, swig_address, ... }`.
   - Persist the binding so subsequent polls return the data.
4. dexter-fe shows the success state; copy MUST acknowledge the agent context when `return === "mcp"` (e.g., "All set — return to Claude" instead of the generic completion message).

The widget polling endpoint reads from this persisted state. There is no postMessage path back to the widget — popouts that span chat-client iframes can't rely on it. Server-side state is the only universal path.

---

## Intent purposes

Phase C only uses one purpose initially. Listed for clarity so other surfaces can extend without renegotiating shape.

| Purpose | Triggers | Widget behavior on completion |
|---|---|---|
| `mcp_enroll` | First-time passkey enrollment + vault provisioning from inside an MCP widget. | Widget transitions to "ready" state showing the vault address. |
| `mcp_authorize` *(future)* | Agent wants user approval for a specific bounded action (e.g., session-role refresh, single-tx authorization). | Widget transitions to "approved" state with the action receipt. Out of scope for Wednesday. |

Phase A's `/wallet/setup` only needs to handle `mcp_enroll` for the Wednesday slice. `mcp_authorize` reserves the shape for later.

---

## Intent status values

| Value | Meaning |
|---|---|
| `pending` | Created. User has not opened the URL yet, OR has opened it but not yet completed the ceremony. |
| `provisioning` | User completed the WebAuthn ceremony; on-chain transactions are landing. Distinguishes "user is engaged" from "no user activity yet". Optional — Phase A may skip this state if the provisioning window is short enough that a `pending → completed` flip is acceptable. |
| `completed` | Vault provisioned, `vault` field is populated. Terminal. |
| `failed` | User canceled, signature rejected, on-chain failure with no retry. `failure_reason` populated. Terminal. |
| `expired` | TTL elapsed. Terminal. Widget should offer to mint a fresh intent. |

Terminal states are immutable — once completed, status does not flip back to pending even on re-entry.

---

## TTL and reuse

Phase A decides the TTL. Suggested floor: 10 minutes. Suggested ceiling: 30 minutes. The widget assumes the intent is reusable within the TTL — i.e., if the user closes the popout and re-opens within TTL, the same intent_id + URL still works.

If a user already has a vault (`vault_status === "ready"` on intent creation), Phase A SHOULD return a still-valid intent that the widget can use to surface the existing vault rather than minting a new ceremony. Concretely: `enroll_url` may point at `/wallet` (read-only display) instead of `/wallet/setup`. The widget should not need to special-case this — it just opens whatever URL Phase A returns.

---

## Cross-surface identity

Phase B publishes `https://dexter.cash/.well-known/webauthn` with origins:

```json
{
  "origins": [
    "https://dexter.cash",
    "https://www.dexter.cash",
    "https://x402gle.com",
    "https://www.x402gle.com",
    "https://open.dexter.cash"
  ]
}
```

Phase C does not touch this file. The widget only invokes `app.openLink` to dexter.cash; the WebAuthn ceremony itself runs at top-level on dexter.cash where the manifest is already authoritative. The `open.dexter.cash` entry exists for any future case where the widget runs the ceremony itself (e.g., if Anthropic relaxes the iframe sandbox). For Wednesday, `open.dexter.cash` does not run a ceremony — but listing it now means we don't republish later.

---

## Failure modes Phase C must handle

The widget's job is to surface, not to fix. For each failure mode below, the widget renders a clear message and offers a single concrete action.

| Failure | Widget surface |
|---|---|
| `app.openLink` rejected by host | "This MCP host doesn't support opening external tabs. Visit dexter.cash/wallet/setup directly to set up your passkey." Copyable URL. |
| Status poll returns `failed` | Show `failure_reason` verbatim plus a "Try again" button that mints a fresh intent. |
| Status poll returns `expired` | "Took too long — let's try again." Single button mints a fresh intent. |
| Status poll 5xx for >30s | "Couldn't reach Dexter. Try again in a moment." No silent retry storm. |
| `intent_id` 404s on poll | The intent was deleted server-side (manual cleanup, DB reset). Widget mints a fresh intent and starts over. |

---

## What Phase C explicitly does NOT do

- **Run any WebAuthn ceremony.** The probe (`dexter_passkey_probe`) confirmed it's blocked. The ceremony runs at top-level on dexter.cash via `/wallet/setup`.
- **Hold any signing material.** No challenges, no signatures, no public keys. The widget is a thin shell over `intent_id` and `enroll_url`.
- **Render or build the dexter.cash popout target.** Phase A owns `/wallet/setup`. Phase C owns the widget that points to it.
- **Handle related-origins manifest changes.** Phase B owns it.
- **Decide UI cadence (polling interval, jitter, exponential backoff).** Held until Phase A's API is observable in production so we measure first.

---

## Open questions deferred until Phase A lands

These are not blockers for the contract — they're things that are easier to settle once Phase A's endpoints are live and we can measure.

1. **Polling cadence + backoff curve.** Depends on typical end-to-end latency from popout open → vault provisioned. Measure first.
2. **Whether `provisioning` is a meaningful distinct state** or whether `pending → completed` is enough. Depends on how long the on-chain transactions take in practice.
3. **Whether the widget should preflight `vault_status === "ready"`** (skip the ceremony, just show the existing vault) or always show the "set up your wallet" CTA and let Phase A's URL choice route correctly. Both are workable.
4. **Whether `intent_id` should be exposed in the URL or cookie-bound.** Exposed-in-URL is simpler; cookie-bound is harder to share-link. Default to exposed-in-URL unless a security review pushes otherwise.

---

## Probe artifact

The diagnostic widget `dexter_passkey_probe` (live at `ui://dexter/passkey-probe`) is **kept**, not retired by Phase C. It carries empirical evidence about the iframe sandbox state across Claude / ChatGPT / future hosts and is the canonical re-test if any host changes its sandbox policy. Phase C's `dexter_passkey` tool ships separately from the probe; both coexist.
