# KorriPay — Architecture Documentation

> **Version:** RC2 · **Last Updated:** 2026-07-07  
> This directory contains the complete architecture documentation for the KorriPay platform.

---

## Document Index

| # | Document | Description |
|---|---|---|
| 01 | [System Overview](01-system-overview.md) | High-level system components, design principles, and end-to-end data flow |
| 02 | [Frontend Architecture](02-frontend-architecture.md) | MPA page structure, `app.js` organization, wallet integration, `authFetch` resilience |
| 03 | [Backend Architecture](03-backend-architecture.md) | Express middleware stack, route namespaces, authentication flow, error handling |
| 04 | [Database Design](04-database-design.md) | 22-model ERD, wallet ledger pattern, pessimistic locking, cascade rules |
| 05 | [Smart Contract Design](05-smart-contract-design.md) | `KorriSettlement`, `KorriTreasury`, `MockKRWStable` — roles, lifecycle, security |
| 06 | [Settlement Pipeline](06-settlement-pipeline.md) | 7-stage async state machine, distributed locking, ZK proof generation |
| 07 | [Compliance Engine](07-compliance-engine.md) | Rule evaluation, risk scoring, screening flow, compliance logging |
| 08 | [Attestation Layer](08-attestation-layer.md) | Provider pattern (Mock/Dojang/Enterprise), DID prefixing, trust score integration |
| 09 | [SDK Architecture](09-sdk-architecture.md) | TypeScript client, type definitions, error hierarchy, HTTP transport |
| 10 | [GIWA Integration Layer](10-giwa-integration-layer.md) | `GiwaInfrastructure` singleton, service registry, auto-failover, Osaka precompiles |
| 11 | [Operations Dashboard](11-operations-dashboard.md) | Admin UI sections, API endpoints, audit logging, access control |
| 12 | [Developer Portal](12-developer-portal.md) | Swagger UI, webhook system, HMAC signing, recipient resolution |

---

## Quick Reference: Key Design Decisions

| Decision | Rationale |
|---|---|
| Monolithic Express (`server.js`) | Simplicity for RC1/RC2; migration to microservices is a post-RC3 item |
| Prisma ORM | Type-safe queries, automated migrations, cascade delete rules |
| Provider pattern for attestations | Enables hot-swap between Mock → Dojang → Enterprise without code changes |
| Redis + local mutex for locking | Distributed-safe for multi-instance; graceful single-instance fallback |
| `SELECT ... FOR UPDATE` on wallet | Prevents TOCTOU race conditions on concurrent balance operations |
| GiwaInfrastructure singleton | Central point of configuration; eliminates hardcoded RPC URLs across codebase |
| Async settlement pipeline | Fast API response (< 200ms); settlement proceeds in background |
| OpenAPI via JSDoc | Documentation stays co-located with code; auto-generated Swagger UI |
