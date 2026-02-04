# ChatGPT Apps SDK Upgrade Plan

> **Goal:** Transform dumb display widgets into interactive components, then submit to ChatGPT App Store  
> **Date:** 2026-02-04  
> **Status:** Ready to execute

---

## Current State

We have 34 widgets that all do the same thing:
```javascript
const toolOutput = useOpenAIGlobal('toolOutput');
return <SomeUI data={toolOutput} />;
```

We're using **~10%** of the SDK's capabilities.

---

## Upgrade Tasks

### Phase 1: SDK Infrastructure (30 min)

#### 1.1 Add Missing Hooks to SDK
Create reusable hooks for all the capabilities we're not using:

```typescript
// New hooks to add to apps-sdk/ui/src/sdk/
- use-call-tool.ts        // window.openai.callTool
- use-send-followup.ts    // window.openai.sendFollowUpMessage  
- use-widget-state.ts     // window.openai.widgetState + setWidgetState
- use-theme.ts            // window.openai.theme (light/dark)
- use-tool-input.ts       // window.openai.toolInput
- use-open-external.ts    // window.openai.openExternal
```

#### 1.2 Add Theme Support to Base CSS
```css
/* apps-sdk/ui/src/styles/base.css */
:root {
  --bg-primary: #0a0a0a;
  --text-primary: #ffffff;
  /* ... dark mode defaults */
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #0a0a0a;
  /* ... light mode overrides */
}
```

---

### Phase 2: High-Impact Widget Upgrades (2 hours)

#### 2.1 Swap Preview → Interactive Swap
**File:** `apps-sdk/ui/src/entries/solana-swap-preview.tsx`

| Feature | Implementation |
|---------|----------------|
| Execute button | `callTool('solana_swap_execute', quote)` |
| Refresh quote | `callTool('solana_swap_preview', { ...originalArgs })` |
| Check slippage | `callTool('slippage_sentinel', { token_out: outputMint })` |
| Token info link | `sendFollowUpMessage({ prompt: 'Tell me about {symbol}' })` |

**New UI:**
```
┌─────────────────────────────────────┐
│  10 SOL → 1,234,567 BONK            │
│  Slippage: 1% | Impact: 0.02%       │
│                                     │
│  [Execute Swap]  [Refresh Quote]    │
│  [Check Slippage] [Learn More]      │
└─────────────────────────────────────┘
```

#### 2.2 Token Lookup → Action Hub
**File:** `apps-sdk/ui/src/entries/solana-token-lookup.tsx`

| Feature | Implementation |
|---------|----------------|
| Get quote | `callTool('solana_swap_preview', { outputMint: token.mint })` |
| Check slippage | `callTool('slippage_sentinel', { token_out: token.mint })` |
| View on Solscan | `openExternal({ href: solscanUrl })` |
| Deep dive | `sendFollowUpMessage({ prompt: 'Analyze {symbol}' })` |

#### 2.3 Portfolio/Balances → Refresh + Quick Actions
**File:** `apps-sdk/ui/src/entries/solana-balances.tsx`

| Feature | Implementation |
|---------|----------------|
| Refresh balances | `callTool('solana_list_balances', {})` |
| Quick swap | `callTool('solana_swap_preview', { inputMint, amount })` |
| Token details | Click row → `sendFollowUpMessage` |

#### 2.4 Trending Tokens → Discovery Hub
**File:** `apps-sdk/ui/src/entries/solscan-trending.tsx`

| Feature | Implementation |
|---------|----------------|
| Get quote | Click token → `callTool('jupiter_quote_preview', { outputMint })` |
| Research | `sendFollowUpMessage({ prompt: 'Research {symbol}' })` |
| View chart | `openExternal({ href: dexscreenerUrl })` |

#### 2.5 Pokedexter → Full Game Control
**File:** `apps-sdk/ui/src/entries/pokedexter.tsx`

| Feature | Implementation |
|---------|----------------|
| Make move | `callTool('pokedexter_make_move', { battleId, choice })` |
| Refresh state | `callTool('pokedexter_get_battle_state', { battleId })` |
| View wager | `callTool('pokedexter_get_wager_status', { wagerId })` |

---

### Phase 3: Theme & Polish (45 min)

#### 3.1 Theme-Aware Components
All widgets should respect `window.openai.theme`:

```tsx
const theme = useOpenAIGlobal('theme') || 'dark';

return (
  <div data-theme={theme} className="widget-container">
    {/* Content adapts to theme */}
  </div>
);
```

#### 3.2 Responsive Design
Use `userAgent.device.type` for mobile optimization:

```tsx
const userAgent = useOpenAIGlobal('userAgent');
const isMobile = userAgent?.device?.type === 'mobile';

return (
  <div className={isMobile ? 'mobile-layout' : 'desktop-layout'}>
    {/* Adaptive UI */}
  </div>
);
```

#### 3.3 Loading & Error States
Standardize across all widgets:
- Skeleton loaders
- Error with retry button using `callTool`
- Empty states with suggestions

---

### Phase 4: Tool Annotations (30 min)

Add proper annotations to all tools for App Store compliance:

```javascript
server.registerTool('solana_list_balances', {
  // ... existing config
  annotations: {
    readOnlyHint: true,      // Doesn't modify anything
    destructiveHint: false,
    openWorldHint: false,
  },
});

server.registerTool('solana_swap_execute', {
  // ... existing config  
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,  // Not destructive, but does spend money
    openWorldHint: true,     // Sends transaction to blockchain
  },
});
```

**Annotation mapping:**
| Tool | readOnly | destructive | openWorld |
|------|----------|-------------|-----------|
| `search` | ✅ | ❌ | ❌ |
| `fetch` | ✅ | ❌ | ❌ |
| `solana_list_balances` | ✅ | ❌ | ❌ |
| `solana_resolve_token` | ✅ | ❌ | ❌ |
| `solana_swap_preview` | ✅ | ❌ | ❌ |
| `solana_swap_execute` | ❌ | ❌ | ✅ |
| `solana_send` | ❌ | ❌ | ✅ |
| `pumpstream_live_summary` | ✅ | ❌ | ❌ |
| `stream_public_shout` | ❌ | ❌ | ✅ |
| All pokedexter GET | ✅ | ❌ | ❌ |
| All pokedexter POST | ❌ | ❌ | ✅ |

---

### Phase 5: App Store Prep (30 min)

#### 5.1 Required Assets
- [ ] App icon (512x512 PNG)
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] App description (compelling, under 500 chars)
- [ ] Category selection

#### 5.2 CSP Audit
Ensure all domains widgets contact are declared:

```javascript
// Current CSP
{
  connect_domains: ['https://api.dexter.cash'],
  resource_domains: ['https://dexter.cash', 'https://*.oaistatic.com'],
}

// May need to add:
// - Image CDNs (token logos)
// - External APIs if any
```

#### 5.3 Test Checklist
- [ ] All widgets load in ChatGPT developer mode
- [ ] Theme switching works (light/dark)
- [ ] All action buttons work (callTool)
- [ ] Follow-up messages work (sendFollowUpMessage)
- [ ] External links work (openExternal)
- [ ] No console errors
- [ ] Mobile layout works

---

## Priority Order for Tonight

1. **SDK Hooks** (30 min) - Foundation for everything else
2. **Swap Preview Interactive** (30 min) - Highest impact demo
3. **Token Lookup Actions** (20 min) - Quick win
4. **Portfolio Refresh** (15 min) - Quick win
5. **Trending Actions** (15 min) - Quick win
6. **Theme Support** (20 min) - Polish
7. **Tool Annotations** (30 min) - Required for submission
8. **App Store Assets** (20 min) - Final prep
9. **Submit** 🚀

**Total estimated time: ~3 hours**

---

## Implementation Notes

### Pattern for Action Buttons

```tsx
// Reusable action button component
function ActionButton({ 
  tool, 
  args, 
  label, 
  loadingLabel,
  onSuccess,
  onError 
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);
  
  const handleClick = async () => {
    if (!window.openai?.callTool) return;
    setLoading(true);
    try {
      const result = await window.openai.callTool(tool, args);
      onSuccess?.(result);
    } catch (err) {
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? loadingLabel : label}
    </button>
  );
}
```

### Pattern for Follow-Up Links

```tsx
function FollowUpLink({ prompt, children }: FollowUpLinkProps) {
  const handleClick = async () => {
    await window.openai?.sendFollowUpMessage?.({ prompt });
  };
  
  return (
    <button className="link-button" onClick={handleClick}>
      {children}
    </button>
  );
}
```

---

## After Submission

- Monitor for approval
- Respond to any review feedback
- Plan v2 features:
  - Widget state for favorites/preferences
  - Fullscreen mode for charts
  - File upload for meme generator
  - PIP mode for active trades

---

*Let's ship this tonight.* 🚀
