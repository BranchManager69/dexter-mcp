---
name: x402-protocol
description: "x402 v2 protocol specification reference. Use when you need to understand x402 internals: payment flows, transport layers (HTTP/MCP/A2A), exact scheme mechanics, error codes, CAIP-2 networks, or type definitions. For SDK usage, see x402-client or x402-server skills instead."
---

# x402 Protocol v2 — Specification Reference

Canonical spec: https://github.com/coinbase/x402

## Core Architecture

Three actors:
- **Resource Server** — requires payment, delegates verify/settle to facilitator
- **Client** — signs payment authorizations (wallet-based)
- **Facilitator** — verifies signatures, checks balances, broadcasts settlement tx

## Payment Flow

```
Client ──GET──▶ Resource Server
       ◀── 402 + PaymentRequired (accepts array)

Client picks payment method, signs authorization

Client ──retry + PaymentSignature──▶ Resource Server ──verify──▶ Facilitator
                                                      ◀── valid ──┘
                                     Resource Server ──settle──▶ Facilitator
                                                      ◀── tx hash ──┘
       ◀── 200 + resource + SettlementResponse
```

## Core Types

### PaymentRequired (Server → Client)

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": { "url": "https://api.example.com/data", "description": "Premium data", "mimeType": "application/json" },
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      "amount": "10000",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "payTo": "SellerAddress...",
      "maxTimeoutSeconds": 60,
      "extra": { "feePayer": "FacilitatorAddress...", "decimals": 6 }
    }
  ],
  "extensions": {}
}
```

### PaymentSignature (Client → Server)

```json
{
  "x402Version": 2,
  "resource": { "url": "...", "description": "...", "mimeType": "..." },
  "accepted": { "scheme": "exact", "network": "...", "amount": "...", "...": "..." },
  "payload": { "transaction": "base64-encoded-signed-tx" },
  "extensions": {}
}
```

### SettlementResponse (Facilitator → Server → Client)

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Settlement succeeded |
| `transaction` | string | On-chain tx hash |
| `network` | string | CAIP-2 network |
| `payer` | string | Payer wallet address |
| `errorReason` | string | Error if failed |
| `errorCode` | string | Machine-readable error code if failed |
| `extensions` | object | Protocol extensions (e.g., sponsored-access recommendations) |

### VerifyResponse

| Field | Type | Description |
|-------|------|-------------|
| `isValid` | boolean | Authorization is valid |
| `invalidReason` | string | Reason if invalid |
| `payer` | string | Payer wallet address |

## Payment Schemes

| Scheme | Description | Chains |
|--------|-------------|--------|
| `exact` | Direct transfer via TransferChecked (SVM) or EIP-3009 transferWithAuthorization (EVM) | All chains |
| `exact-approval` | Approval-based ERC-20 transfer (for chains without EIP-3009) | BSC |
| `upto` | Batched/metered payments — pay up to an amount, settle actual usage | Base, Polygon, Arbitrum |
| `bridge` | Cross-chain settlement — pay on one chain, resource on another | Solana ↔ Base |

## HTTP Transport

Headers carry base64-encoded JSON:

| Header | Direction | Content |
|--------|-----------|---------|
| `PAYMENT-REQUIRED` | Server → Client | PaymentRequired |
| `PAYMENT-SIGNATURE` | Client → Server | PaymentSignature |
| `PAYMENT-RESPONSE` | Server → Client | SettlementResponse |

## MCP Transport

Payment data lives in `_meta` fields as native JSON (not base64):

| Key | Direction | Location |
|-----|-----------|----------|
| `x402/payment` | Client → Server | `_meta` in request params |
| `x402/payment-response` | Server → Client | `_meta` in response result |

Server returns JSON-RPC error with code `402` when payment is required.

## A2A Transport (Agent-to-Agent)

Payment uses task metadata with dot-notation keys: `x402.payment.status`, `x402.payment.required`, `x402.payment.payload`, `x402.payment.receipts`.

Status lifecycle: `payment-required` → `payment-submitted` → `payment-verified` → `payment-completed` (or `payment-failed`/`payment-rejected`).

## Exact Scheme — Solana (SVM)

Uses `TransferChecked` instruction for SPL token transfers. Client constructs a partially-signed versioned transaction; facilitator adds fee payer signature and submits.

Transaction must contain 3-4 instructions in order:
1. `ComputeBudget::SetComputeUnitLimit`
2. `ComputeBudget::SetComputeUnitPrice` (max 5 lamports/CU)
3. *(Optional)* `CreateAssociatedTokenAccount`
4. `SPL Token::TransferChecked`

Fee payer must NOT appear in any instruction's accounts.

## Exact Scheme — EVM

Uses EIP-3009 `transferWithAuthorization` for gasless ERC-20 transfers. Payer signs EIP-712 typed data; facilitator submits on-chain.

## Exact-Approval Scheme — BSC

Uses standard ERC-20 `approve` + facilitator-submitted `transferFrom` for chains that don't support EIP-3009 (e.g., BSC's USDC contract).

## CAIP-2 Network Identifiers

| Network | CAIP-2 ID |
|---------|-----------|
| Solana mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Base mainnet | `eip155:8453` |
| Polygon | `eip155:137` |
| Arbitrum | `eip155:42161` |
| Optimism | `eip155:10` |
| Avalanche C-Chain | `eip155:43114` |
| BSC (BNB Chain) | `eip155:56` |
| SKALE Base | `eip155:1187947933` |
| Base Sepolia (testnet) | `eip155:84532` |
| Solana devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |

Note: Sui (`sui:1`) is listed in some specs but not currently supported by the Dexter facilitator.

## Error Codes

| Code | Scope | Meaning |
|------|-------|---------|
| `insufficient_funds` | All | Payer lacks tokens |
| `invalid_network` | All | Unsupported network |
| `invalid_payload` | All | Malformed payload |
| `invalid_scheme` | All | Scheme not supported |
| `invalid_x402_version` | All | Wrong protocol version |
| `invalid_transaction_state` | All | Tx failed on-chain |
| `invalid_exact_evm_payload_signature` | EVM | Bad EIP-712 signature |
| `invalid_exact_evm_payload_authorization_valid_before` | EVM | Auth expired |
| `invalid_exact_evm_payload_authorization_value` | EVM | Amount too low |
| `invalid_exact_evm_payload_recipient_mismatch` | EVM | Wrong recipient |
| `invalid_exact_svm_payload_instruction_layout` | SVM | Wrong instruction order |
| `invalid_exact_svm_payload_fee_payer_exposed` | SVM | Fee payer in accounts |
| `invalid_exact_svm_payload_destination_mismatch` | SVM | ATA mismatch |
| `invalid_exact_svm_payload_amount_mismatch` | SVM | Amount != required |
| `invalid_exact_svm_payload_compute_unit_exceeded` | SVM | CU price too high |

## v1 vs v2

| Feature | v1 (Legacy) | v2 (Current) |
|---------|-------------|--------------|
| Network format | `solana`, `solana-devnet` | CAIP-2 identifiers |
| Payment header | `X-PAYMENT` | `PAYMENT-SIGNATURE` |
| Amount field | `maxAmountRequired` | `amount` |
| Response format | Simple JSON | `accepts` array with options |
| Payment schemes | Exact only | Exact, Exact-Approval, Upto, Bridge |
| Transports | HTTP only | HTTP, MCP, A2A |
| Extensions | None | `extensions` field for protocol plugins |

v2 facilitators are backward-compatible with v1 clients.

## Facilitator REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/verify` | POST | Verify payment without settling |
| `/settle` | POST | Settle payment on-chain |
| `/supported` | GET | Supported schemes, networks, signer addresses |
| `/healthz` | GET | Health check |
