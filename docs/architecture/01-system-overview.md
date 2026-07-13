# KorriPay — System Overview

> **Version:** RC2 · **Last Updated:** 2026-07-07  
> This document provides a high-level view of the entire KorriPay platform — what it does, how its components relate, and the design principles that govern them.

---

## What Is KorriPay?

KorriPay is an **institutional-grade, cross-border payment platform** built natively on the **GIWA Layer-2 blockchain** (Chain ID: `92837`). It enables businesses and individuals to execute real-time, cryptographically-proven settlements across currencies (USD, KRW, NGN) with an on-chain compliance and attestation layer.

---

## System Components

```mermaid
graph TB
    subgraph Client["Client Layer"]
        UI["Frontend\n(Vanilla HTML/JS)"]
        SDK["@korripay/sdk\n(TypeScript)"]
        EXT["External\nMerchant Apps"]
    end

    subgraph API["Backend API Layer (Node.js / Express)"]
        V1["/api/v1\nVersioned REST"]
        SRV["server.js\nLegacy Routes"]
        DOCS["/api-docs\nSwagger UI"]
        OBS["Observability\n/health /ready /live /metrics"]
    end

    subgraph SVC["Service Layer"]
        SS["settlementService\nState Machine + ZK Proof"]
        AS["attestationService\nProvider Router"]
        TS["trustScoreService\nScore Engine"]
        WS["webhookService\nHMAC Event Delivery"]
        LS["lockService\nRedis / Mutex"]
        NS["networkIntelligence\nRPC Telemetry"]
    end

    subgraph INFRA["GIWA Infrastructure Layer"]
        GI["GiwaInfrastructure\nSingleton Instance"]
        REG["GIWAServiceRegistry\nProvider Pool + Failover"]
        DOJ["DojangIntegration\n(Trust Provider)"]
        KRW["KRWStablecoin\n(Asset Bridge)"]
    end

    subgraph CHAIN["GIWA L2 Network — Chain ID 92837"]
        SC["KorriSettlement.sol\nEscrow Contract"]
        TR["KorriTreasury.sol\nCustody Contract"]
        EAS["EAS Registry\n0xEA50...0000"]
        RPC["op-reth Node\nJSON-RPC"]
        OSAKA["Osaka EVM\nPrecompiles"]
    end

    subgraph DB["PostgreSQL (Prisma ORM)"]
        MODELS["22 Models\nUsers·Wallets·Settlements\nAttestations·Compliance\nOrgs·Webhooks·Network"]
    end

    Client --> API
    API --> SVC
    SVC --> INFRA
    SVC --> DB
    INFRA --> CHAIN
    INFRA --> DB
```

---

## Design Principles

| Principle | Implementation |
|---|---|
| **GIWA-Native First** | All blockchain interactions route through `GiwaInfrastructure`. No direct hardcoded RPC URLs. |
| **Provider Abstraction** | Trust providers (Mock → Dojang → Enterprise) implement `BaseAttestationProvider`. Swap at runtime. |
| **Traceability** | Every settlement has a `pipelineHistory` JSON log, a `SettlementProof`, and an L2 `txHash`. |
| **Defence in Depth** | Helmet headers + CORS + Rate limiting + Auth + Row-level DB locks + Distributed Redis locks. |
| **Operational Transparency** | Prometheus `/metrics`, DB-pinged `/ready`, process-level `/live`, and full `/health` report. |
| **Zero Trust Middleware** | Every protected route runs through `requireAuth` + session validation before handlers execute. |

---

## Technology Choices

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 20 LTS | Async I/O ideal for concurrent settlement pipelines |
| Framework | Express.js | Minimal overhead; full control over middleware chain |
| ORM | Prisma + PostgreSQL | Type-safe queries; migration system; cascade relations |
| Blockchain | ethers.js v6 | Full EIP-712, ABI encoding, JsonRpcProvider support |
| Contracts | Solidity 0.8.20 + OpenZeppelin | Battle-tested access control and reentrancy guards |
| SDK | TypeScript ESM | Type safety for external integrators |
| Containers | Docker + Compose | Reproducible dev/staging/prod environments |
| Observability | Prometheus-compatible `/metrics` | Standard scrape format; integrates with Grafana |

---

## Data Flow: Settlement Request

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant ComplianceEngine
    participant SettlementService
    participant GIWA_L2
    participant Database

    User->>Frontend: Initiates Create Settlement
    Frontend->>Backend: POST /api/v1/settlements
    Backend->>ComplianceEngine: screenTransaction(userId, amount, currency)
    ComplianceEngine-->>Backend: { result: "Allowed", riskScore: 12 }
    Backend->>SettlementService: validateTransfer() — SELECT FOR UPDATE
    SettlementService-->>Backend: wallet (locked row)
    Backend->>Database: UPDATE wallet (decrement usdAvailable)
    Backend->>Database: CREATE settlement (status: Pending)
    Backend-->>Frontend: 201 { settlementId }

    Note over SettlementService: Async pipeline starts
    SettlementService->>SettlementService: Stage 1: Settlement Requested
    SettlementService->>SettlementService: Stage 2: Compliance Screening
    SettlementService->>SettlementService: Stage 3: Route Selection
    SettlementService->>GIWA_L2: initiateSettlement() → TransferCreated event
    SettlementService->>GIWA_L2: completeSettlement() → TransferConfirmed event
    SettlementService->>SettlementService: Stage 5: Confirmation
    SettlementService->>Database: UPDATE settlement (status: Completed, confirmedTxHash)
    SettlementService->>SettlementService: Stage 6: Proof Generation
    SettlementService->>Database: CREATE settlement_proof
    SettlementService->>SettlementService: Stage 7: Archive
    SettlementService->>Backend: dispatchEvent('settlement.completed')
```

---

## Environment Environments

| Environment | Compose File | Backend Port | Database | GIWA RPC |
|---|---|---|---|---|
| Local Dev | `Dockerfile.dev` | 5000 | Local Postgres | Simulation fallback |
| Staging | `docker-compose.staging.yml` | 3001 | `korripay_staging` | Staging RPC |
| Production | `docker-compose.prod.yml` | 3000 (behind nginx) | `korripay` | Live GIWA L2 |
