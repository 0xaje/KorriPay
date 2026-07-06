# Attestation Layer Architecture

> **Service:** `backend/src/services/attestationService.js`  
> **Pattern:** Strategy / Provider Pattern — switchable at runtime via `TRUST_PROVIDER` env var

---

## Overview

The Attestation Layer manages the full lifecycle of **identity, merchant, business, payroll, and compliance credentials** (attestations) for KorriPay users. It uses the **Strategy pattern** with a provider router, allowing seamless switching between `Mock`, `Dojang`, and `Enterprise` attestation backends.

---

## Provider Architecture

```mermaid
classDiagram
    class BaseAttestationProvider {
        +issue(data) Promise~Attestation~
        +verify(id) Promise~VerifyResult~
        +revoke(id) Promise~Attestation~
        +list(filters) Promise~Attestation[]~
    }

    class MockTrustProvider {
        +issue() Writes to PostgreSQL
        +verify() Reads from PostgreSQL
        +revoke() Updates PostgreSQL status
        +list() Queries PostgreSQL
        -generateMockECDSAProof() string
    }

    class DojangTrustProvider {
        +issue() did:dojang: prefix
        +verify() Validates dojang- proof signature
        +revoke() Updates status
        +list() Filters by did:dojang: issuer
        -verifyLiveness() boolean
    }

    class EnterpriseTrustProvider {
        +issue() did:enterprise: prefix
        +verify() Validates enterprise-kms- proof signature
        +revoke() Updates status
        +list() Filters by did:enterprise: issuer
        -verifyKMSSignature() boolean
    }

    class AttestationService {
        -provider BaseAttestationProvider
        +createAttestation(data)
        +verifyAttestation(id)
        +revokeAttestation(id)
        +listAttestations(filters)
        -resolveProvider() BaseAttestationProvider
    }

    BaseAttestationProvider <|-- MockTrustProvider
    BaseAttestationProvider <|-- DojangTrustProvider
    BaseAttestationProvider <|-- EnterpriseTrustProvider
    AttestationService --> BaseAttestationProvider : uses active provider
```

---

## Provider Selection

```mermaid
flowchart LR
    ENV["TRUST_PROVIDER\nenvironment variable"] --> ROUTER{"Provider\nRouter"}
    ROUTER -->|"'mock' or unset"| MOCK["MockTrustProvider\n(Development / Testnet)"]
    ROUTER -->|"'dojang'"| DOJ["DojangTrustProvider\n(Future Production)"]
    ROUTER -->|"'enterprise'"| ENT["EnterpriseTrustProvider\n(Institutional)"]
```

---

## Attestation Schema Types

| Schema | Purpose | Issued By |
|---|---|---|
| `Identity` | Personal KYC identity credential | KYC pipeline / Admin |
| `Merchant` | Merchant business registration | Admin / Dojang |
| `Business` | Corporate entity verification | Enterprise provider |
| `Payroll` | Employment / payroll credential | Enterprise provider |
| `Compliance` | Regulatory compliance clearance | Compliance engine |

---

## Attestation Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active : issue()
    Active --> Revoked : revoke()
    Active --> Expired : TTL elapsed (future)
    Revoked --> [*]
    Expired --> [*]
```

### Status Values
| Status | `verificationState` | Meaning |
|---|---|---|
| `Active` | `Valid` | Credential is live and passes verification |
| `Revoked` | `Revoked` | Issuer has revoked the credential |
| `Expired` | `Expired` | Time-to-live exceeded (future implementation) |

---

## Proof Format by Provider

| Provider | Proof Format | Example |
|---|---|---|
| Mock | `mock-signature-ecdsa-sha256-0x{40 hex chars}` | `mock-signature-ecdsa-sha256-0xabcdef1234...` |
| Dojang | `dojang-proof-sig-0x{40 hex chars}` | `dojang-proof-sig-0x12345678ab...` |
| Enterprise | `enterprise-kms-sig-0x{40 hex chars}` | `enterprise-kms-sig-0xfedcba9876...` |

> **Note for RC3:** The Mock provider proof is a locally generated deterministic hex. In production with Dojang or EAS, this will be replaced with a real on-chain attestation UID from the EAS contract registry at `0xEA50000000000000000000000000000000000000`.

---

## DID (Decentralised Identifier) Prefixing

Each provider applies a DID prefix to the issuer field:

```javascript
// Mock:      issuer as-is
// Dojang:    "did:dojang:" + issuer   (if not already prefixed)
// Enterprise: "did:enterprise:" + issuer
```

This allows querying attestations by provider by filtering on the `issuer` field prefix.

---

## Attestation API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/attestations` | Create new attestation (requires auth) |
| `GET` | `/api/v1/attestations` | List attestations, filter by schema/wallet/status |
| `GET` | `/api/v1/attestations/:id` | Get single attestation |
| `POST` | `/api/attestations` | Legacy create endpoint |
| `GET` | `/api/attestations/:id` | Legacy verify endpoint |
| `POST` | `/api/admin/attestations/issue` | Admin-issued attestation |
| `POST` | `/api/admin/attestations/:id/revoke` | Admin revocation |

---

## Trust Score Integration

The `trustScoreService` consumes attestation data to compute a **0–100 trust score** for any wallet address:

```mermaid
flowchart LR
    WALLET["Wallet Address"] --> TS["trustScoreService.calculateScore(wallet)"]
    TS --> ATT["Count Active Attestations\nby schema type"]
    TS --> HIST["Load TrustScoreHistory\nfrom DB"]
    ATT --> SCORE["Compute composite\ntrust score 0–100"]
    HIST --> SCORE
    SCORE --> SAVE["Persist to\nTrustScoreHistory"]
    SCORE --> RETURN["Return score + breakdown"]
```

### Score Weights
| Factor | Weight |
|---|---|
| Identity attestation present | +30 |
| Compliance attestation present | +25 |
| Merchant attestation present | +20 |
| Business attestation present | +15 |
| Transaction history (positive) | +10 |
| Any Revoked attestations | −20 per |
