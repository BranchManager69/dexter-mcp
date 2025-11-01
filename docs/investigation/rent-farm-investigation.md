# Solana x402 Rent-Farm Investigation  
  
## Executive Summary  
  
A coordinated series of 0.0001 USDC settlements is targeting open x402 facilitators on Solana. Each settlement forces the payer to create a brand-new USDC associated token account (ATA) for the attacker’s wallet, consuming roughly 2 049 281 lamports (~0.002049 SOL) in rent. Minutes later the attacker burns the dust and closes the ATA, reclaiming the rent.  
  
Using Helius’ `getTransactionsForAddress` endpoint we quantified the damage across three facilitators: Dexter, Daydreams, and PayAI. Across the most recent pages of their settlement history we identified **16 674** rent-farm hits burning a combined **34.17 SOL** between 2025‑10‑27 and 2025‑11‑01.  
  
## Impact by Facilitator (Solana Mainnet)  
  
| Facilitator | Payer wallet(s) analysed | Time span (UTC) | Rent-farm settles | Lamports burned | SOL burned (≈) | Unique recipient wallets |  
|-------------|--------------------------|-----------------|-------------------|-----------------|---------------|--------------------------|  
| **Dexter** | `DEXVS3su4dZQWTvvPnLDJLRK1CeeKG6K3QqdzthgAkNV` | 2025‑10‑27 05:32:57 → 2025‑11‑01 11:51:06 | **824** | **1 688 607 544** | **1.6886** | 417 |  
| **Daydreams** | `DuQ4jFMmVABWGxabYHFkGzdyeJgS1hp4wrRuCtsJgT9a`<br>`Ds1QXjX3J7XYtu6SWfgjEWhqEWKyLNXGEqUXNhJRNgoP` | 2025‑10‑27 09:09:12 → 2025‑11‑01 05:34:59 | **4 927** | **10 096 808 487** | **10.0968** | 3 194 |  
| **PayAI** | `2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4`<br>`FYB56sVBW2r4Ka7W9kdJWTPY9FKQLxbT6h4Ysr6aLPZD` | 2025‑10‑27 01:02:20 → 2025‑10‑29 19:41:04 | **10 923** | **22 382 257 083** | **22.3823** | 8 996 |  
  
**Aggregate:** 16 674 rent-farm settlements burning **34 167 672 114** lamports (~**34.17 SOL**) across the three facilitators.  
  
## Attack Pattern  
  
1. The attacker issues a 402 challenge for 0.0001 USDC with `pay_to` set to a fresh wallet (e.g., `6wbeeivx4F5htuWF8vNeG5BYiRQQNEa2EUS7dgDLKucP`).  
2. The facilitator payer settles the invoice, creating the recipient’s USDC ATA and burning ~0.002049 SOL in rent.  
3. Minutes later the controller wallet `4dnAMm7uNQLJiKVbAtJ82tdhKUCBMUKxjA8fnyLoTa1J` submits `BurnChecked` + `CloseAccount`, reclaiming the rent.  
4. Steps 1–3 are repeated with thousands of one-off wallets, rapidly draining the payers.  
  
### Example Settles (Dexter payer → attacker-controlled wallet)  
  
- `2zvHC7h7DtaQxaPZTLLXg6r2BAn4hwUjk4VoYo59KpEUmFJ22hovkRgbCD7NhFBj4zLcNGFpx7c1F9LPcQMSjMFq` (2025‑11‑01 07:12 UTC) — ATA creation for 0.0001 USDC, lamport delta **+2 049 281**.  
- `Z1atUX2PFGFqpSQfYe3TuedE4sjZDUaoeMKKqoZMnMZKKXhpxsMkZY1jmdeJVBxpUtZkk1u2WhJKqoQi1Zf3GHU` (2025‑11‑01 10:57 UTC) — same pattern, lamport delta **+2 049 281**.  
  
### Matching Rent Refunds (attacker reclaiming the rent)  
  
- `3jPHfkM6TmHzMxmCV734PcBTyBEPY4xDUHVVMzShjsibRETr6i1XR7sudJncqJG9hUn9fzY6sfvXV2YP8L62cJbG` (2025‑10‑27 16:51 UTC) — signed by `4dnAM…`, lamport delta **−2 029 280**.  
- `bdXF5fFv3XN6fw7KKhY8AU2RbUhQeCtfohfuvSdiGQ1q1J43h2wR6paAT6dCW5U1ij3iUuWmWZRHpbPcjguHzXS` (2025‑11‑01 10:55 UTC) — same controller wallet, same refund.  
  
## Mitigation Recommendations  
  
1. **Payee allowlists:** Only settle invoices whose `pay_to` address is pre-authorised (e.g., a known treasury or partner wallet). This single control blocks the rent-farm entirely.  
2. **Temporary guardrail:** Reject or flag sub-cent invoices that would create a new ATA (≤ 0.001 USDC). Legitimate flows rarely open fresh wallets for that amount.  
3. **Monitoring:** Alert whenever the payer funds an ATA for ≤ 0.0001 USDC, so new rent-farm wallets are caught immediately.  
4. **Peer coordination:** Share these findings with other facilitator operators (Daydreams, PayAI, etc.) so they can validate their own losses and deploy similar protections.  
  
## Methodology Notes  
  
- Data source: Helius `getTransactionsForAddress` with `transactionDetails: "full"`, `status: "succeeded"`, paginated until no further results.  
- Pattern filter: token post-balance amount ≤ 100 (0.0001 USDC) to an address other than the payer, with lamport delta ≈ 2 049 281.  
- Time span: 2025‑10‑27 through 2025‑11‑01 (the window covered by available history for each payer).  
