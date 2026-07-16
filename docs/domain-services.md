# Domain Services — M3 Architecture

This document describes the responsibilities, boundaries, and dependency graph of each core domain engine in KorriPay.

## Architecture Overview

```
Presentation Layer   (apps/api, packages/sdk)
        ↓
Application Layer    (orchestration — M4)
        ↓
Domain Services      (services/* — THIS LAYER)
        ↓
Repositories         (packages/database)
        ↓
Database             (PostgreSQL via Prisma)
```

**Rule:** Only Domain Services contain business logic. Repositories contain only persistence.

---

## Domain Engines

### SettlementEngine (`services/settlement-engine`)

**Owns the protocol state machine.** No other service may change settlement status directly.

| Method                 | Description                                                                      |
| ---------------------- | -------------------------------------------------------------------------------- |
| `createSettlement()`   | Validates input, persists new settlement, dispatches `SettlementRequested` event |
| `progressSettlement()` | Enforces state machine transition, updates status, creates audit log             |
| `validateSettlement()` | Returns current state and allowed next states                                    |
| `cancelSettlement()`   | Transitions to `CANCELLED` via state machine                                     |
| `failSettlement()`     | Transitions to `FAILED` via state machine                                        |
| `completeSettlement()` | Transitions to `COMPLETED` via state machine                                     |

---

### TreasuryEngine (`services/treasury`)

**Owns double-entry ledger operations.** Never modifies settlement state.

| Method                  | Description                                                               |
| ----------------------- | ------------------------------------------------------------------------- |
| `reserveFunds()`        | Executes atomic Debit→Credit ledger transaction for liquidity reservation |
| `releaseFunds()`        | Reverses reservation via corrective ledger transaction                    |
| `getAvailableBalance()` | Computes real-time balance from ledger entries (no stored balance field)  |
| `calculateFee()`        | Calculates settlement fee as a percentage of amount                       |

---

### ComplianceEngine (`services/compliance`)

**Owns risk evaluation and AML policy decisions.**

| Method              | Description                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `evaluate()`        | Runs country screening, amount velocity, active rule matching; returns `ComplianceDecision` |
| `calculateRisk()`   | Scores a specific target entity                                                             |
| `validateCountry()` | Checks country policy for blocked status                                                    |

**Output:** A decision object — never an HTTP response.

---

### IdentityEngine (`services/identity`)

**Owns KYC verification and trust scoring.**

| Method                  | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| `verifyIdentity()`      | Creates/updates identity profile, computes trust score, records verification |
| `calculateTrustScore()` | Returns numeric trust score (0–100) based on KYC level                       |
| `validateCredential()`  | Checks if a user holds a specific credential type                            |
| `verifyAttestation()`   | Delegates to `IAttestationProvider` if configured                            |

---

### ProofEngine (`services/proof`)

**Owns settlement proof metadata and certificate issuance.**

| Method                  | Description                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `generateProof()`       | Creates proof metadata, computes integrity hash, dispatches `ProofGenerated` event |
| `generateCertificate()` | Issues a signed certificate binding all proofs for a settlement                    |
| `verifyProof()`         | Checks stored proof records for a given proofId                                    |

> ZK proof generation is reserved for a later milestone. `ProofEngine` provides an extensible interface.

---

### OrganizationEngine (`services/organization`)

**Owns organization lifecycle and multi-tenant member management.**

| Method                 | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `createOrganization()` | Creates org record with audit log                            |
| `inviteMember()`       | Adds user to org with a specific role                        |
| `assignRole()`         | Re-assigns a member's role                                   |
| `validateTenant()`     | Checks if an organization exists (used by all other engines) |

---

### NotificationEngine (`services/notification`)

**Prepares notification payloads only — no SMTP, no webhooks.**

| Method             | Description                                                    |
| ------------------ | -------------------------------------------------------------- |
| `preparePayload()` | Builds a `NotificationPayload` struct with channel metadata    |
| `selectChannel()`  | Chooses delivery channel based on urgency level                |
| `send()`           | Delegates to `INotificationProvider` (no-op if not configured) |

---

### AuditEngine (`services/audit`)

**Append-only event recording. Never updates or deletes.**

| Method               | Description                                         |
| -------------------- | --------------------------------------------------- |
| `recordEvent()`      | Writes a typed audit record with before/after state |
| `recordFailure()`    | Records error details for system failures           |
| `recordApproval()`   | Records manual approval actions                     |
| `recordCompliance()` | Records compliance evaluation decisions             |

---

## Dependency Graph

```
SettlementEngine
  ├── SettlementRepository
  ├── AuditRepository
  ├── IEventDispatcher
  ├── DomainMetrics
  └── SettlementStateMachine (from @korripay/domain)

TreasuryEngine
  ├── TreasuryRepository
  ├── AuditRepository
  └── DomainMetrics

ComplianceEngine
  ├── ComplianceRepository
  ├── AuditRepository
  ├── IComplianceProvider (optional, pluggable)
  └── DomainMetrics

IdentityEngine
  ├── IdentityRepository
  ├── AuditRepository
  ├── IAttestationProvider (optional, pluggable)
  └── DomainMetrics

ProofEngine
  ├── ProofRepository
  ├── AuditRepository
  ├── IEventDispatcher
  └── DomainMetrics

OrganizationEngine
  ├── OrganizationRepository
  ├── AuditRepository
  └── DomainMetrics

NotificationEngine
  ├── INotificationProvider (optional, pluggable)
  └── DomainMetrics

AuditEngine
  ├── AuditRepository
  └── DomainMetrics
```

## CTO Enhancements

| Feature                 | Implementation                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pluggable Providers** | `IAttestationProvider`, `IFXRateProvider`, `IComplianceProvider`, `INotificationProvider`, `ISettlementNetworkAdapter` — in `packages/domain/src/providers` |
| **Policy Engine**       | `SettlementPolicy` configures per-institution limits, corridors, and approval thresholds                                                                    |
| **Domain Metrics**      | `DomainMetrics` lightweight collector in `packages/domain/src/metrics` — no Prometheus coupling                                                             |
