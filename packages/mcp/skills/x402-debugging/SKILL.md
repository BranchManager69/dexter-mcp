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

## Common Issues and Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| 402 but no payment prompt | Client not handling 402 responses | Use `wrapFetch()` or `createX402Client()` from `@dexterai/x402/client` |
| Payment verification fails | Wrong network format | Use CAIP-2 for v2: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| "Insufficient balance" | Wallet lacks USDC | Fund wallet, check with `x402_wallet` |
| Settlement timeout | Solana RPC congestion | Increase `maxTimeoutSeconds`, check RPC health |
| "Missing fee payer" | Solana accept missing `extra.feePayer` | Facilitator must provide `feePayer` in the accept |
| "No matching payment option" | No wallet for available chains | Add wallet for the required chain (Solana or EVM) |
| Backpressure rejection | Too many concurrent settlements | Wait and retry, or reduce concurrent requests |
| "Amount exceeds max" | `maxAmountAtomic` safety limit hit | Increase the limit or use a cheaper endpoint |
| Payment rejected after signing | Server rejected the signed tx | Check `errorReason` in the 402 response body |
| Access pass expired | JWT token past `exp` claim | Client should auto-renew with `autoRenew: true` |

## Facilitator Endpoints

```bash
# Health check
curl https://x402.dexter.cash/healthz

# Supported networks and schemes
curl https://x402.dexter.cash/supported
# Returns: { kinds: [...], extensions: [...], signers: { ... } }

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

### General Errors

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

| Code | Context | Meaning |
|------|---------|---------|
| `missing_payment_required_header` | Client | Server sent 402 without PAYMENT-REQUIRED header |
| `invalid_payment_required` | Client | Could not decode PAYMENT-REQUIRED header |
| `no_matching_payment_option` | Client | No connected wallet for available networks |
| `missing_fee_payer` | Client | Solana option missing feePayer in extra |
| `missing_amount` | Client | Payment option has no amount field |
| `amount_exceeds_max` | Client | Payment exceeds maxAmountAtomic |
| `insufficient_balance` | Client | Wallet USDC balance too low |
| `payment_rejected` | Client | Server rejected the signed payment |
| `facilitator_verify_failed` | Server | Facilitator returned invalid for verify |
| `facilitator_settle_failed` | Server | Settlement failed on-chain |

## Debugging wrapFetch

Enable verbose logging to see the full payment flow:

```typescript
const x402Fetch = wrapFetch(fetch, {
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
  verbose: true, // Logs: request → 402 → balance check → sign → retry → result
});
```

## Fee Payer Safety (Solana)

The facilitator's fee payer must NOT:
- Appear in any instruction's `accounts` array
- Be the transfer `authority` or `source`
- Be used for anything except paying transaction fees

If you see `invalid_exact_svm_payload_fee_payer_exposed`, the transaction incorrectly includes the fee payer in an instruction.
