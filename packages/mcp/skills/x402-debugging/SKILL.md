---
name: x402-debugging
description: "Diagnose x402 payment failures — facilitator health, error codes, balance issues, settlement timeouts, and protocol mismatches. Trigger when a payment fails, a 402 response is unexpected, settlement times out, or the user reports an x402 error."
---

# x402 Debugging Guide

## Quick Diagnosis Checklist

1. **Is the facilitator healthy?** `curl https://x402.dexter.cash/healthz`
2. **Does it support the network?** `curl https://x402.dexter.cash/supported`
3. **Does the wallet have funds?** Check USDC balance (and SOL for tx fees on Solana)
4. **Is the network format correct?** v2 uses CAIP-2 (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`), not `"solana"`
5. **Is the client handling 402?** Must use `wrapFetch`, `createX402Client`, or manual PAYMENT-SIGNATURE flow
6. **Is the right scheme used?** Most chains use `exact`, BSC uses `exact-approval`

## Common Issues and Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| 402 but no payment prompt | Client not handling 402 responses | Use `wrapFetch()` or `createX402Client()` from `@dexterai/x402/client` |
| Payment verification fails | Wrong network format | Use CAIP-2 for v2: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| "Insufficient balance" | Wallet lacks USDC | Fund wallet, check with `x402_wallet` |
| Settlement timeout | Solana RPC congestion | Increase `maxTimeoutSeconds`, check RPC health, or use `maxRetries` |
| "Missing fee payer" | Solana accept missing `extra.feePayer` | Facilitator must provide `feePayer` in the accept |
| "No matching payment option" | No wallet for available chains | Add wallet for the required chain (Solana or EVM) |
| Backpressure rejection | Too many concurrent settlements | Wait and retry, or reduce concurrent requests |
| "Amount exceeds max" | `maxAmountAtomic` safety limit hit | Increase the limit or use a cheaper endpoint |
| Payment rejected after signing | Server rejected the signed tx | Check `errorReason` in the 402 response body |
| Access pass expired | JWT token past `exp` claim | Client auto-renews with `autoRenew: true` |
| "Unsupported network" | SDK doesn't have an adapter for this chain | Add the appropriate wallet (Solana or EVM) |
| "User rejected signature" | User declined wallet signing prompt | Prompt user to try again, don't auto-retry |
| "Transaction build failed" | Failed to construct the payment tx | Check wallet connection, RPC health, token accounts |
| BSC payment fails | Wrong scheme — BSC needs `exact-approval`, not `exact` | Ensure facilitator returns `exact-approval` for `eip155:56` |

## Facilitator Endpoints

```bash
# Health check
curl https://x402.dexter.cash/healthz

# Supported networks and schemes
curl https://x402.dexter.cash/supported
# Returns: { kinds: [...], extensions: [...], signers: { ... } }
# kinds include: exact (all chains), exact-approval (BSC), upto (Base/Polygon/Arbitrum), bridge (Solana/Base)

# Manual verification
curl -X POST https://x402.dexter.cash/verify \
  -H "Content-Type: application/json" \
  -d '{"paymentPayload": {...}, "paymentRequirements": {...}}'

# Manual settlement
curl -X POST https://x402.dexter.cash/settle \
  -H "Content-Type: application/json" \
  -d '{"paymentPayload": {...}, "paymentRequirements": {...}}'
```

## Error Code Reference

### Facilitator Errors (returned by /verify and /settle)

| Code | Meaning |
|------|---------|
| `insufficient_funds` | Payer wallet lacks tokens |
| `invalid_network` | Network not supported by facilitator |
| `invalid_payload` | Malformed payment payload |
| `invalid_scheme` | Scheme not supported |
| `invalid_x402_version` | Wrong protocol version (expected 2) |
| `invalid_transaction_state` | On-chain tx reverted |
| `unexpected_verify_error` | Internal facilitator error during verify |
| `unexpected_settle_error` | Internal facilitator error during settle |

### EVM-Specific Errors

| Code | Meaning |
|------|---------|
| `invalid_exact_evm_payload_signature` | Bad EIP-712 signature |
| `invalid_exact_evm_payload_authorization_valid_after` | Auth not yet valid |
| `invalid_exact_evm_payload_authorization_valid_before` | Auth expired |
| `invalid_exact_evm_payload_authorization_value` | Amount too low |
| `invalid_exact_evm_payload_recipient_mismatch` | `to` != `payTo` |

### Solana-Specific Errors

| Code | Meaning |
|------|---------|
| `invalid_exact_svm_payload_instruction_layout` | Wrong instruction order/count |
| `invalid_exact_svm_payload_fee_payer_exposed` | Fee payer in instruction accounts |
| `invalid_exact_svm_payload_destination_mismatch` | ATA doesn't match payTo/asset |
| `invalid_exact_svm_payload_amount_mismatch` | Transfer amount != required |
| `invalid_exact_svm_payload_compute_unit_exceeded` | CU price > 5 lamports |

### SDK Error Codes (X402Error)

These are thrown by the client SDK (`@dexterai/x402/client`):

| Code | Context | Meaning |
|------|---------|---------|
| `missing_payment_required_header` | Client | Server sent 402 without PAYMENT-REQUIRED header |
| `invalid_payment_required` | Client | Could not decode PAYMENT-REQUIRED header |
| `unsupported_network` | Client | No adapter for the required chain |
| `no_matching_payment_option` | Client | No connected wallet for available networks |
| `missing_fee_payer` | Client | Solana option missing feePayer in extra |
| `missing_decimals` | Client | Payment option missing decimals in extra |
| `missing_amount` | Client | Payment option has no amount field |
| `amount_exceeds_max` | Client | Payment exceeds maxAmountAtomic |
| `insufficient_balance` | Client | Wallet USDC balance too low |
| `wallet_missing_sign_transaction` | Client | Wallet doesn't implement signTransaction |
| `wallet_not_connected` | Client | Wallet not connected |
| `wallet_disconnected` | Client | Wallet disconnected during payment |
| `user_rejected_signature` | Client | User declined the signing prompt |
| `transaction_build_failed` | Client | Failed to construct the payment transaction |
| `payment_rejected` | Client | Server rejected the signed payment |
| `rpc_timeout` | Client | RPC call timed out |
| `facilitator_timeout` | Client | Facilitator didn't respond in time |
| `invalid_payment_signature` | Server | Could not decode client's payment signature |
| `facilitator_verify_failed` | Server | Facilitator returned invalid for verify |
| `facilitator_settle_failed` | Server | Settlement failed on-chain |
| `facilitator_request_failed` | Server | HTTP request to facilitator failed |
| `no_matching_requirement` | Server | Client's accepted option doesn't match any server requirement |
| `access_pass_expired` | Access | Pass JWT has expired |
| `access_pass_invalid` | Access | Pass JWT signature or claims invalid |
| `access_pass_tier_not_found` | Access | Requested tier doesn't exist on the server |
| `access_pass_exceeds_max_spend` | Access | Tier price exceeds client's maxSpend |

## Debugging wrapFetch

Enable verbose logging to see the full payment flow:

```typescript
const x402Fetch = wrapFetch(fetch, {
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
  verbose: true, // Logs: request → 402 → balance check → sign → retry → result
});
```

### Pre-payment callback

Use `onPaymentRequired` to inspect or reject payments before signing:

```typescript
const x402Fetch = wrapFetch(fetch, {
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
  onPaymentRequired: (requirements) => {
    const amount = Number(requirements.amount) / 1e6;
    console.log(`About to pay $${amount} on ${requirements.network}`);
    return amount <= 1.0; // Reject payments over $1
  },
});
```

### Retry support

For transient failures (network errors, 502/503), use retry:

```typescript
const client = createX402Client({
  wallets,
  maxRetries: 2,      // 2 retries after initial attempt
  retryDelayMs: 500,  // 500ms, 1000ms between retries
  verbose: true,
});
```

Retries are safe — EIP-3009 nonces and Solana blockhash expiry prevent double payments.

## Fee Payer Safety (Solana)

The facilitator's fee payer must NOT:
- Appear in any instruction's `accounts` array
- Be the transfer `authority` or `source`
- Be used for anything except paying transaction fees

If you see `invalid_exact_svm_payload_fee_payer_exposed`, the transaction incorrectly includes the fee payer in an instruction.
