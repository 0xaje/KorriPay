# KorriPay Settlement Proof Standard (KPS-1)

**Standard:** KPS-1
**Version:** 1.0.0
**Status:** Active
**Owner:** Settlement Systems Engineering

---

## 1. Purpose

This document standardizes how KorriPay exposes settlement proofs. Every completed
settlement is representable as a **Settlement Certificate** — a production-grade,
verifiable document suitable for enterprise reconciliation, audit, and compliance
workflows, rather than a consumer payment receipt.

A certificate is a deterministic assembly of **persisted data** (Settlement,
SettlementProof, ComplianceLog, Attestation records) and **derivable data** (live
GIWA chain state). No field is ever fabricated.

## 2. Core Principles

1. **No fabrication.** A field appears in a certificate only if it exists in
   persistent storage or can be deterministically derived (e.g. confirmation count
   from the current chain head). Anything else is omitted and enumerated in
   `omittedFields` with a machine-readable reason.
2. **Completed settlements only.** Certificates are issued exclusively for
   settlements with status `Completed`. Requests for non-completed settlements
   return HTTP `409`.
3. **Verifiable integrity.** Every certificate carries a SHA-256 digest of its
   canonical JSON body, and the proof itself is re-verified (on-chain when the
   GIWA RPC is reachable) at issuance time.
4. **Format parity.** The JSON and PDF representations are generated from the
   same certificate object and carry the same integrity digest.

## 3. Certificate Fields

| Field | Certificate Path | Source | Omission Behavior |
| --- | --- | --- | --- |
| Settlement ID | `settlement.settlementId` | `Settlement.id` | Never omitted |
| Settlement Status | `settlement.status` | `Settlement.status` | Never omitted (always `Completed`) |
| Settlement Timestamp | `settlement.settlementTimestamp` | `Settlement.confirmedAt` | `null` if not recorded |
| Transaction Hash | `execution.transactionHash` | `SettlementProof.txHash`, falling back to `Settlement.confirmedTxHash` / `Settlement.txHash` | Omitted if no hash recorded |
| Block Number | `execution.blockNumber` | `SettlementProof.blockNumber` | Omitted if proof not generated |
| Gas Used | `execution.gasUsed` | `SettlementProof.gasUsed` | Omitted if proof not generated |
| Confirmation Count | `execution.confirmationCount` | Derived: `currentBlock - receipt.blockNumber + 1` via live GIWA RPC | Omitted if RPC unreachable or receipt unavailable |
| Settlement Duration | `settlement.settlementDurationSeconds` | `SettlementProof.settlementDuration` (seconds) | Omitted if proof not generated |
| Compliance Result | `compliance` | `ComplianceLog` correlated by user, amount, and a ±10 minute window around settlement creation | Omitted if no confident correlation exists |
| Attestation References | `attestationReferences` | `Attestation` records for the settlement initiator wallet | Empty array if none |
| GIWA Network | `network` | Live `GiwaInfrastructure.getChainMetadata()` (name, chain ID, hardfork, EVM version, clients, settlement contract) | Never omitted |
| Explorer Link | `execution.explorerLink` | Derived: `{explorerUrl}/tx/{transactionHash}` | Omitted if no transaction hash |
| Protocol Version | `certificate.standard` + `certificate.version`, `network.hardfork` / `network.evmVersion` | Constant + chain config | Never omitted |
| Proof Integrity Status | `proofIntegrity` | Re-verification at issuance (see §5) | Never omitted |

## 4. Certificate Envelope (JSON)

```json
{
  "certificate": {
    "standard": "KPS-1",
    "version": "1.0.0",
    "issuedAt": "<ISO-8601>",
    "issuer": "KorriPay Settlement Systems"
  },
  "settlement": {
    "settlementId": "settlement-...",
    "status": "Completed",
    "settlementTimestamp": "<ISO-8601 | null>",
    "requestedAt": "<ISO-8601>",
    "initiator": "0x...",
    "amount": "100",
    "fromToken": "0x...",
    "toToken": "0x...",
    "settlementDurationSeconds": 3
  },
  "execution": {
    "transactionHash": "0x...",
    "blockNumber": 23516695,
    "gasUsed": "154320",
    "confirmationCount": 128,
    "explorerLink": "https://explorer.giwa.io/tx/0x..."
  },
  "compliance": {
    "result": "Pass",
    "riskScore": 12,
    "riskLevel": "Low",
    "rulesTriggered": [],
    "screenedAt": "<ISO-8601>",
    "complianceLogId": "uuid"
  },
  "attestationReferences": [
    {
      "attestationId": "uuid",
      "schema": "Identity",
      "issuer": "0x...",
      "status": "Active",
      "verificationState": "Valid",
      "proofReference": "0x...",
      "issuedAt": "<ISO-8601>"
    }
  ],
  "network": {
    "name": "GIWA Testnet (Sepolia)",
    "chainId": 92837,
    "hardfork": "Karst",
    "evmVersion": "Osaka",
    "nodeClient": "op-reth",
    "proofClient": "kona-client",
    "settlementContract": "0x...",
    "explorerUrl": "https://explorer.giwa.io"
  },
  "proofIntegrity": {
    "status": "VERIFIED_ON_CHAIN",
    "verificationMethod": "on-chain-receipt",
    "verifiedAt": "<ISO-8601>",
    "checks": [
      { "check": "proof_record_exists", "passed": true },
      { "check": "tx_hash_format", "passed": true },
      { "check": "proof_matches_settlement_record", "passed": true },
      { "check": "stored_proof_status", "passed": true },
      { "check": "on_chain_receipt_found", "passed": true },
      { "check": "on_chain_block_number_matches", "passed": true },
      { "check": "on_chain_gas_used_matches", "passed": true },
      { "check": "on_chain_tx_succeeded", "passed": true }
    ],
    "storedProofStatus": "Valid",
    "proofGeneratedAt": "<ISO-8601>"
  },
  "omittedFields": [
    { "field": "confirmationCount", "reason": "GIWA RPC node unreachable or receipt unavailable; confirmation count cannot be derived" }
  ],
  "integrityDigest": "sha256:<hex>"
}
```

## 5. Proof Integrity Verification

Integrity is re-evaluated every time a certificate is issued. Checks are executed
in two tiers:

**Tier 1 — Stored record validation (always executed):**

- `proof_record_exists` — a `SettlementProof` row exists for the settlement
- `tx_hash_format` — transaction hash matches `^0x[0-9a-fA-F]{64}$`
- `proof_matches_settlement_record` — proof hash equals the settlement's confirmed hash
- `stored_proof_status` — persisted `proofStatus` is `Valid`

**Tier 2 — On-chain re-verification (when the GIWA RPC node is reachable):**

- `on_chain_receipt_found` — a receipt exists for the proof's transaction hash
- `on_chain_block_number_matches` — receipt block number equals the stored proof block number
- `on_chain_gas_used_matches` — receipt gas used equals the stored proof gas
- `on_chain_tx_succeeded` — receipt status is `1`

**Resulting status values:**

| Status | Meaning |
| --- | --- |
| `VERIFIED_ON_CHAIN` | All Tier 1 and Tier 2 checks passed against live chain state |
| `VERIFIED_STORED_PROOF` | Tier 1 passed; chain unreachable so Tier 2 was skipped |
| `INTEGRITY_MISMATCH` | One or more checks failed (stored proof contradicts settlement record or chain state) |
| `PROOF_NOT_GENERATED` | The settlement completed but no proof record has been persisted |

## 6. Integrity Digest

`integrityDigest` is computed as:

```
sha256( canonicalJSON( certificate body without integrityDigest ) )
```

Canonical JSON serialization sorts all object keys lexicographically at every
depth. Any consumer can independently recompute the digest from the JSON
representation to confirm the document has not been altered. The PDF prints the
same digest, binding both representations to one certificate body.

## 7. API Surface

All endpoints require authentication (cookie/session auth via `/api/v1`).

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/v1/settlements/{id}/certificate` | GET | Returns the certificate JSON. `{id}` may be a settlement ID or transaction hash. |
| `/api/v1/settlements/{id}/certificate?download=true` | GET | Same payload served as a JSON file attachment. |
| `/api/v1/settlements/{id}/certificate.pdf` | GET | Renders and downloads the certificate as an A4 PDF. |

**Error semantics:**

| Code | Condition |
| --- | --- |
| `404` | No settlement matches the given ID or transaction hash |
| `409` | Settlement exists but its status is not `Completed` |
| `500` | Internal assembly or rendering failure |

## 8. PDF Representation

The PDF is a single generated document (via `pdfkit`, streamed — never stored on
disk) with the following sections, in order:

1. Header — issuer, standard, version, issuance timestamp
2. Settlement — ID, status, timestamps, initiator, amount, duration
3. On-Chain Execution — transaction hash, block, gas, confirmations, explorer link
4. Compliance — result, risk level/score, rules triggered, log reference
5. Attestation References — one entry per attestation
6. GIWA Network — chain identity and protocol/client versions
7. Proof Integrity — status, method, and the full check ledger (PASS/FAIL)
8. Certificate Integrity Digest — the SHA-256 digest with verification guidance
9. Omitted Fields — present only when fields were omitted, with reasons

Fields with no value are never printed with placeholder data; they are skipped
in their section and disclosed in "Omitted Fields."

## 9. Implementation References

| Concern | Location |
| --- | --- |
| Certificate assembly, integrity verification, PDF rendering | `backend/src/services/settlementCertificateService.js` |
| HTTP endpoints | `backend/apiV1.js` (`/settlements/:id/certificate`, `/settlements/:id/certificate.pdf`) |
| Proof persistence | `backend/src/services/settlementService.js` (`generateSettlementProof`) |
| Data models | `backend/prisma/schema.prisma` (`Settlement`, `SettlementProof`, `ComplianceLog`, `Attestation`) |
| Chain metadata | `backend/src/infrastructure/giwa/GiwaInfrastructure.js` (`getChainMetadata`) |
| Dashboard download UI | `frontend/dashboard.html` / `frontend/app.js` (Settlement Proof modal) |

## 10. Acceptance Criteria

- [x] Every completed settlement exposes all fourteen standardized fields where data exists
- [x] Fields that cannot be sourced or derived are omitted and disclosed, never fabricated
- [x] Certificates are downloadable as both PDF and JSON with a shared integrity digest
- [x] Proof integrity is re-verified at issuance, on-chain when the network is reachable
- [x] Output resembles an enterprise settlement certificate, not a consumer payment receipt
