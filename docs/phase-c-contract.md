# Phase C Contract — MCP Widget for Passkey Wallet Onboarding

This is the live contract between Phase C (the OpenDexter MCP widget) and Phase A (the dexter-fe + dexter-api passkey vault flow). Phase A shipped first; this doc reflects what actually exists, not what we sketched up front.

**Companion docs:**
- Architecture spec: `~/websites/dexter-api/docs/superpowers/specs/2026-05-04-passkey-swig-architecture.md`
- Phase A implementation plan: `~/websites/dexter-api/docs/superpowers/plans/2026-05-04-passkey-swig-implementation.md`

**Empirical reality:** MCP widget iframes cannot run WebAuthn directly (probed 2026-05-04 on Claude.ai mobile + iOS app — `navigator.credentials.create` blocked, `window.open` blocked, `<a target="_blank">` blocked). The only host-honored escape hatch is JSON-RPC `ui/open-link`. Phase C therefore opens dexter.cash in a new tab and the user runs the ceremony at top-level there. Custody story unchanged — passkey never leaves the user's device.

---

## What Phase A actually shipped

- **Page:** `https://dexter.cash/wallet/setup-passkey` — Next.js page, ~250 lines, idempotent + resumable. Five-step ceremony: passkey enrollment → vault PDA init → Swig wallet creation → Dexter session-role grant → vault → Swig binding. Biometric prompts fire exactly twice per onboarding (enrollment + final binding). Source: `~/websites/dexter-fe/app/wallet/setup-passkey/page.tsx`. Hook: `app/hooks/usePasskeyWallet.ts`. Helpers: `app/lib/passkey.ts`.
- **dexter-api routes:**
  - `GET /api/passkey-vault/status` — read current user's vault state (Bearer-only, Supabase access token)
  - `POST /api/passkey/enroll/challenge|complete`
  - `POST /api/passkey/sign/challenge|verify`
  - `POST /api/passkey-vault/build/initialize|create-swig|grant-session-role|set-swig|request-withdrawal|finalize-withdrawal` — transaction builders (Bearer-only)
- **`user_vaults` table** — keyed on `supabase_user_id`, one vault per user.
- **No intent indirection.** Status is keyed on the authenticated user, not on a per-request token. The widget polls vault status; when `hasVault` flips true, the user is done.
- **`.well-known/webauthn` related-origins manifest** — Phase B / not yet live as of this doc. Independent of Phase C; Phase C only needs to open dexter.cash, which has its own RP.

---

## Auth bridge (the OpenDexter side)

**This is the load-bearing piece for C.** The MCP server needs to call `/api/passkey-vault/status` on behalf of a paired user. Bearer-only means we need the user's Supabase access token — not just a user ID.

The bridge ships with these commits:
- `Dexter-DAO/dexter-api@3962ba9` — `pollPairingResult` returns `supabaseAccessToken` + `supabaseRefreshToken`
- `Dexter-DAO/dexter-mcp@3e6ac0b` — `userBindings` stores both tokens; new helper `lib/user-scoped-fetch.mjs`

### How a Phase C tool handler authenticates

```js
import { userScopedDexterFetch } from './lib/user-scoped-fetch.mjs';
import { getUserBinding } from './open-mcp-server.mjs';

// In a tool handler that has sessionId from the AsyncLocalStorage context:
const binding = getUserBinding(sessionId);
if (!binding) {
  // user not paired — throw the existing pairing-required error path
  // so the agent surfaces a connector OAuth URL to the user
}

const res = await userScopedDexterFetch({
  binding,
  path: '/api/passkey-vault/status',
  onRefreshed: (newAccess, newRefresh) => {
    binding.supabaseAccessToken = newAccess;
    if (newRefresh) binding.supabaseRefreshToken = newRefresh;
  },
});

if (!res.ok) {
  // Treat 401 as "user must re-pair." Other errors bubble up as tool errors.
}

const status = await res.json();
// → { enrolled, hasVault, vault: {...} | null, credentialId }
```

**Token refresh is handled transparently inside `userScopedDexterFetch`.** Phase C tools do not write refresh logic.

---

## What `/api/passkey-vault/status` returns

```jsonc
{
  "enrolled": true,                   // user has a passkey credential on file
  "hasVault": true,                   // user_vaults row exists
  "vault": {
    "vaultPda": "VaULT...",
    "swigAddress": "Sw1G...",
    // Additional fields per Phase A schema. Widget should treat the
    // object as opaque except for vaultPda + swigAddress, which are
    // load-bearing for the success-state UI.
  } | null,
  "credentialId": "<base64url>" | null
}
```

State table for the widget:

| `enrolled` | `hasVault` | Widget state | What it shows |
|---|---|---|---|
| `false` | `false` | `not_enrolled` | "Set up your Dexter wallet" CTA → `app.openLink('https://dexter.cash/wallet/setup-passkey')` |
| `true` | `false` | `provisioning` | "Resume setup" CTA → same URL (page is resumable). Polling on. |
| `true` | `true` | `ready` | Vault address + Solscan link |
| `false` | `true` | (impossible) | Defensive: render `ready` and log a warning |

Plus a session-bound state: if `getUserBinding(sessionId)` returns null, the user has not completed OpenDexter pairing. Surface as `user_bound: false` in `structuredContent` so the widget renders "Link your Dexter account first" pointing at the existing connector OAuth flow.

---

## Phase C deliverables

### C2 — `passkey-onboard` widget

- Three states: `not_enrolled` / `provisioning` / `ready`
- On mount: read `structuredContent` for the initial snapshot the tool returned
- If not `ready`: render the CTA, call `app.openLink({ url: enroll_url })` on tap
- After tap: poll the tool every 3s by calling `dexter_passkey` again (re-render on each result)
- When status flips `ready`: render vault address + Solscan link

### C3 — `dexter_passkey` MCP tool

- Same registration pattern as `x402_wallet`
- Returns `structuredContent`:
  ```jsonc
  {
    "vault_status": "not_enrolled" | "provisioning" | "ready" | "user_not_paired" | "error",
    "vault_address": "VaULT..." | null,
    "swig_address": "Sw1G..." | null,
    "enroll_url": "https://dexter.cash/wallet/setup-passkey",
    "user_bound": true | false,
    "error": null | "<message>"
  }
  ```
- `enroll_url` is hardcoded — no query params, no intent token
- Auth path: `userScopedDexterFetch` with the contract above

### C4 — End-to-end mainnet test

- Fresh Supabase user → install OpenDexter MCP in ChatGPT/Claude → invoke `dexter_passkey`
- Widget renders not-enrolled → tap CTA → dexter.cash tab opens → 5-step ceremony → vault provisioned
- Return to chat → widget polled status during user's absence → now renders `ready` with vault address

---

## What Phase C explicitly does NOT do

- Run any WebAuthn ceremony. Iframe sandbox blocks it.
- Hold any signing material — challenges, signatures, public keys all stay top-level on dexter.cash.
- Build the popout target page (`/wallet/setup-passkey`). Phase A owns it.
- Write token refresh logic. The auth bridge handles it transparently.
- Mint or persist intent IDs. There is no intent table — vault status is keyed on `supabase_user_id`.
- Mutate vault state. The user mutates state at dexter.cash with their own Bearer; the MCP only reads.
- Touch related-origins manifest. Phase B owns it.

---

## Probe widget

The `dexter_passkey_probe` widget (live at `ui://dexter/passkey-probe`) is **kept**, not retired by Phase C. It carries empirical evidence about the iframe sandbox state and is the canonical re-test if any host changes its policy. Phase C's `dexter_passkey` ships separately; both coexist.
