# Hyperliquid Perps: What You Can Do Today

The Hyperliquid integration gives Dexter concierge and pro users a fast way to trade perpetuals without leaving chat. This page highlights exactly what you get, what you need, and how to use it.

---

## Why You’ll Care

- **Instant market context** – Ask the agent for the current tradable Hyperliquid symbols and filter down to what matters.
- **One-click opt‑in** – Provision a dedicated Hyperliquid agent wallet that’s bound to your Dexter managed wallet. No manual key wrangling.
- **Guided trading** – Submit buy or sell orders (including limit, market-with-slippage, stop loss, and take profit) directly from the conversation.
- **Withdrawal transparency** – Track balances, reserved notional, and payout requests inside the same interface (admins can approve/settle payouts from their dashboard).

---

## What You Need

1. **Pro access** to Dexter’s concierge or an enabled bot that surfaces Hyperliquid tools.  
2. **A managed wallet** already linked to your Supabase user (the concierge can help you bind one if you don’t have it yet).  
3. **Authentication** – use your usual Dexter login so requests carry the `Authorization: Bearer <token>` header.  
4. **Production API endpoint** – tools point at `https://api.dexter.run` (or your environment’s override). Nothing new to install.

---

## Key Features & Flows

| Action | How to trigger it | What happens |
| --- | --- | --- |
| Browse symbols | “List Hyperliquid markets” | Agent calls `/hyperliquid/markets`, caches symbols, returns tradable perps (e.g., `BTC-PERP`). |
| Opt into Hyperliquid | “Opt my wallet into Hyperliquid” (optional: pass wallet + agent name) | API provisions an agent wallet, approves it on Hyperliquid, and returns status + expiry. |
| Place a trade | “Buy 0.5 BTC-PERP at 62,400” or “Sell ETH-PERP market with stop 2%.“ | Concierge validates size/price, reserves notional, submits the order, and confirms execution (or releases funds on failure). |
| Request withdrawal | “Withdraw $250 from perps.” | API creates a withdrawal ticket, subtracts available USD, and queues it for ops review. |
| Check status (admin) | Admin dashboard → Perp overview | Shows global balances, wallet health, pending withdrawals, plus optional live equity polling. |

---

## Quick Start Script

1. **Ask the agent:** “What Hyperliquid markets can I trade?”  
2. **If you’ve never traded:** “Opt in my main wallet as ‘alpha-scout’.”  
3. **Place a trade:** “Buy 1 SOL-PERP at 140, stop 135, take profit 150.”  
4. **Confirm:** Agent replies with order status and reserved notional.  
5. **Exit or adjust:** “Close SOL-PERP” or “Sell 1 SOL-PERP market.”  
6. **Withdraw proceeds:** “Withdraw $100 from perps.” (Ops will approve/settle.)

---

## FAQ

**Do I need Hyperliquid credentials?**  
No. Dexter stores your managed wallet secret and spins up an exchange agent for you.

**What about fees?**  
Each executed trade records a $1 service fee in the ledger. Funding and PnL are reconciled automatically.

**Can I trade anything outside the listed markets?**  
No—Hyperliquid symbols are validated against the exchange’s `metaAndAssetCtxs` list to prevent typos or delisted contracts.

**How fast can I rotate agents?**  
Agents renew automatically before expiry. If you need a fresh key immediately, ask the concierge to “reprovision Hyperliquid agent.”

**How do withdrawals get paid?**  
Ops (or the automated worker) pays from the configured treasury managed wallet to your managed wallet once the request reaches `ready`.

---

Ready to explore? Just open a concierge chat and say “Hyperliquid” to see the available tools.***
