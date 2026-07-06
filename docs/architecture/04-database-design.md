# Database Design

> **Engine:** PostgreSQL 16 · **ORM:** Prisma 6 · **Schema:** `backend/prisma/schema.prisma`

---

## Overview

KorriPay uses **22 Prisma models** representing the full application domain: users, multi-currency wallets, settlement pipelines, compliance, attestations, merchants, organisations, webhooks, and network telemetry.

---

## Entity Relationship Diagram

```mermaid
erDiagram
    User {
        String id PK
        String name
        String email UK
        String walletAddress UK
        String role
        Boolean suspended
        DateTime createdAt
    }
    Wallet {
        String id PK
        String userId UK FK
        Float usdAvailable
        Float usdLocked
        Float usdPending
        Float krwAvailable
        Float krwLocked
        Float ngnAvailable
        Float ngnLocked
        Float mockkrwAvailable
        Float btcBalance
        Float ethBalance
        Float usdcBalance
        DateTime updatedAt
    }
    WalletLedger {
        String id PK
        String walletId FK
        String currency
        String balanceType
        Float amount
        Float runningBalance
        String entryType
        String description
        String txHash
        DateTime createdAt
    }
    Transaction {
        String id PK
        String userId FK
        String title
        String type
        Float amount
        String status
        String txHash
        Float timestamp
    }
    Settlement {
        String id PK
        String initiator
        String fromToken
        String toToken
        String amount
        String recipientDetails
        String status
        String txHash
        String confirmedTxHash
        String pipelineStage
        String pipelineHistory
        DateTime createdAt
        DateTime confirmedAt
    }
    SettlementProof {
        String id PK
        String settlementId UK
        String txHash
        Int blockNumber
        String gasUsed
        Int settlementDuration
        String proofStatus
        DateTime timestamp
    }
    ComplianceProfile {
        String id PK
        String userId UK FK
        String riskLevel
        Float dailyLimitUSD
        Float singleTxLimitUSD
        Float suspiciousThresholdUSD
        Boolean kycEnforced
    }
    ComplianceLog {
        String id PK
        String userId
        Float amount
        String currency
        Float riskScore
        String riskLevel
        String result
        String rulesTriggered
        DateTime createdAt
    }
    ComplianceRule {
        String id PK
        String code UK
        String name
        Boolean isActive
        Float value
    }
    Attestation {
        String id PK
        String issuer
        String subjectWallet
        String schema
        String status
        String verificationState
        String proof
        DateTime timestamp
    }
    Organization {
        String id PK
        String name
        String taxId
        String status
        DateTime createdAt
    }
    OrgMember {
        String id PK
        String orgId FK
        String userId FK
        String role
        Float dailySettlementLimit
    }
    OrgWallet {
        String id PK
        String orgId FK
        String currency
        Float available
        Float locked
        Float pending
        String address UK
    }
    ApprovalRequest {
        String id PK
        String orgId FK
        String initiatorId
        String type
        Float amount
        String currency
        String status
        String payload
    }
    PaymentRequest {
        String id PK
        String merchantId FK
        Float amount
        String currency
        String status
        DateTime createdAt
    }
    WebhookSubscription {
        String id PK
        String url
        String events
        String secret
        Boolean active
    }
    NetworkSnapshot {
        String id PK
        Int chainId
        Int blockNumber
        Float gasPrice
        String sequencerStatus
        Int rpcLatency
        Int healthScore
        DateTime timestamp
    }

    User ||--o| Wallet : "has one"
    User ||--o| ComplianceProfile : "has one"
    Wallet ||--o{ WalletLedger : "has many"
    User ||--o{ Transaction : "has many"
    Settlement ||--o| SettlementProof : "has one"
    User ||--o{ Attestation : "issues/receives"
    Organization ||--o{ OrgMember : "has many"
    Organization ||--o{ OrgWallet : "has many"
    Organization ||--o{ ApprovalRequest : "has many"
    OrgMember }o--|| User : "belongs to"
    User ||--o{ PaymentRequest : "creates"
```

---

## Multi-Currency Wallet Ledger Pattern

The `Wallet` model uses a **three-state balance model** per currency: `available`, `locked`, `pending`.

```
usdAvailable   — Spendable balance. Subject to pessimistic FOR UPDATE locking on debit.
usdLocked      — Reserved for in-flight settlements (deducted from available, held here).
usdPending     — Received funds awaiting confirmation from counterparty.
```

This is replicated for: `USD`, `KRW`, `MockKRW`, `NGN`.

Every balance mutation also inserts a `WalletLedger` entry for audit traceability.

---

## Indexed Queries

| Model | Indexed Fields | Reason |
|---|---|---|
| `WalletLedger` | `(walletId, currency)`, `createdAt` | Paginated ledger queries |
| `FxConversion` | `userId`, `createdAt` | FX history and analytics |
| `Contact` | `(userId, walletAddress)` UNIQUE | Duplicate contact prevention |
| `OrgMember` | `(orgId, userId)` UNIQUE | Org membership constraint |
| `OrgWallet` | `(orgId, currency)` UNIQUE, `address` UNIQUE | Wallet allocation uniqueness |

---

## Pessimistic Locking

Balance deductions use raw SQL to acquire row-level locks before reads:

```sql
SELECT * FROM "wallets" WHERE "userId" = $1 LIMIT 1 FOR UPDATE
```

This prevents **TOCTOU (Time-of-Check-Time-of-Use)** race conditions when concurrent settlement requests target the same wallet. The `FOR UPDATE` lock is released when the enclosing transaction commits or rolls back.

A fallback `findFirst` (without locking) is used when the environment is not PostgreSQL (e.g., SQLite in test mode).

---

## Cascade Delete Rules

All child records cascade on user deletion:
- `Wallet` → `WalletLedger` entries
- `Transaction` records
- `Kyc` records
- `Contact` records
- `ComplianceProfile`
- `PaymentRequest` records
- `OrgMember` memberships
