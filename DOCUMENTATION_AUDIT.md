# KorriPay — Documentation Audit Report

> **Author:** Lead Technical Writer  
> **Scope:** Public Release & Grant Submission Preparation  
> **Status:** Complete — No source code was modified.

---

## Executive Summary

KorriPay has a solid foundation of technical documentation covering architecture, security, performance, and API contracts. However, several critical gaps remain before the codebase is suitable for public release or grant submission. The root `README.md` — the first document any external reader encounters — is **severely outdated**, referencing a legacy stack and missing critical GIWA, Docker, SDK, and infrastructure context. The SDK and smart contracts lack inline troubleshooting sections. CI/CD workflows lack human-readable runbooks.

**Overall Documentation Health: 6.5 / 10**

| Area | Status | Priority |
| :--- | :---: | :--- |
| Root README | 🔴 Critical | P0 |
| SDK Documentation | 🟡 Partial | P1 |
| Smart Contracts | 🟡 Partial | P1 |
| Backend API / Swagger | 🟢 Good | P2 |
| Infrastructure / Docker | 🟡 Partial | P1 |
| CI/CD Workflows | 🟡 Partial | P2 |
| GIWA Architecture | 🟢 Good | P3 |
| Security & Audit Reports | 🟢 Good | P3 |

---

## 1. Missing Documentation

### 1.1 Root README — GIWA L2 Network Context `[P0 — Critical]`
The root `README.md` contains zero mention of the **GIWA Layer-2 network**, which is the platform's defining architectural characteristic. A grant reviewer or external developer reading the README would not understand what makes KorriPay different from a generic fintech backend.

**Missing sections:**
- What GIWA is and why KorriPay is built on it
- Chain ID (`92837`), native token, and explorer URL
- GIWA-specific features: Osaka EVM precompiles, ZK proof pipeline, EAS attestations
- Dojang trust provider overview

### 1.2 Root README — Docker & Deployment `[P0 — Critical]`
No mention of Docker, `docker-compose.prod.yml`, `docker-compose.staging.yml`, or `Dockerfile.dev`. A developer following the README cannot deploy the application to any environment other than bare-metal local.

**Missing sections:**
- Docker quickstart (`docker compose up`)
- Environment variable requirements (pointing to `.env.example`)
- Production deployment instructions
- Scripts directory (`scripts/deploy.sh`, `backup.sh`, `restore.sh`)

### 1.3 Root README — Observability Endpoints `[P1 — High]`
The `/health`, `/ready`, `/live`, and `/metrics` (Prometheus) endpoints — which were implemented and verified — are not documented anywhere in the README or any dedicated operations runbook.

### 1.4 SDK — Missing Methods `[P1 — High]`
`sdk/README.md` documents 4 methods (`getWallet`, `createSettlement`, `getSettlement`, `getProof`, `verifyIdentity`). The `client.ts` implementation confirms these are all public methods, but the README does not document:
- How to configure a **production `baseUrl`** vs local
- How to obtain a **session token** (the auth flow)
- Rate limit behavior and retry guidance
- Webhook subscription lifecycle (documented in API but not SDK)
- Attestation and compliance trust score queries

### 1.5 Smart Contracts — No Deployment Guide `[P1 — High]`
There is no documentation explaining how to deploy `KorriSettlement.sol`, `KorriTreasury.sol`, or `MockKRWStable.sol` to the GIWA L2 network. The `hardhat.config.js` contains no GIWA network config.

**Missing:**
- Deployment script documentation
- Constructor argument values for production
- Contract address registry (post-deploy)
- Upgrade / migration strategy (contracts are non-upgradeable — this should be stated explicitly)

### 1.6 Monitoring — No Grafana Dashboard Documentation `[P2 — Medium]`
`monitoring/prometheus.yml` is configured but there is no `README` inside `monitoring/` explaining:
- How to start the Prometheus + Grafana stack
- What metrics are exposed at `/metrics` and what they represent
- Alert rule recommendations
- How to connect Grafana to the Prometheus data source

### 1.7 CI/CD — No Developer Runbook `[P2 — Medium]`
Four workflow files exist (`ci.yml`, `contracts.yml`, `production.yml`, `staging.yml`) but no `CONTRIBUTING.md` or CI runbook explains:
- How to run CI locally before pushing
- Required GitHub Secrets (`SEMGREP_APP_TOKEN`, `POSTGRES_PASSWORD`, etc.)
- How the staging vs production promotion gates work
- What to do when a CI job fails

### 1.8 Backend — No `backend/README.md` `[P2 — Medium]`
There is no `README.md` inside the `backend/` directory. A new contributor has no entry point for understanding the backend's structure, how to run migrations, or how the service layer is organized.

---

## 2. Outdated Documentation

### 2.1 Root README — Tech Stack `[P0 — Critical]`
The README states:
> **Frontend** — HTML5, Vanilla JS, **TailwindCSS (CDN)**, Google Fonts (Inter), Material Symbols  
> **Backend** — Node.js, Express.js  
> **State** — In-memory (backend) + `localStorage` fallback (offline mode)

This is the original prototype description. The current stack includes:
- **Helmet**, **express-rate-limit**, **compression** middleware (security & performance hardening)
- **Prisma ORM** with **PostgreSQL** (not in-memory state)
- **Swagger/OpenAPI** auto-documentation
- **ethers.js** for EVM L2 interaction
- **GIWA infrastructure layer** (`GiwaInfrastructure.js`)
- No TailwindCSS CDN (custom CSS)

### 2.2 Root README — API Endpoints Table `[P0 — Critical]`
The README lists 6 legacy endpoints as the full API surface. The platform now exposes **50+ endpoints** across three namespaces (`/api/*`, `/api/v1/*`, `/api-docs`). The listed endpoints are still valid but represent less than 15% of the API.

### 2.3 Root README — Project Structure `[P0 — Critical]`
The documented structure:
```
KorriPay/
├── backend/
│   ├── server.js
│   └── package.json
├── frontend/
└── package.json
```
The actual structure now includes `contracts/`, `sdk/`, `scripts/`, `monitoring/`, `.github/workflows/`, `backend/src/services/`, `backend/src/infrastructure/giwa/`, etc.

### 2.4 Root README — Supported Assets `[P1 — High]`
Lists **ETH on Polygon** and **USDC on Polygon** as supported assets. KorriPay is now built on **GIWA L2**, not Polygon. Assets now include **MockKRW**, **KRW**, and **NGN** which are not listed.

### 2.5 Root README — Badge — TailwindCSS `[P2 — Medium]`
The README badge shows `TailwindCSS v3`. The project uses **custom Vanilla CSS**, not TailwindCSS.

### 2.6 MIGRATION_GIWA.md — Test Counts `[P2 — Medium]`
Line 72 states `195/195` backend tests passing. The current test suite has **200/200** tests. Minor discrepancy but creates doubt about document currency.

### 2.7 GIWA_AUDIT.md — RC1 Framing `[P2 — Medium]`
The GIWA audit was written for RC1. The platform is now at **RC2** with significantly improved GIWA alignment scores. The audit's "Recommended Fix Order" is partially or fully resolved but the document has not been updated to reflect this, which could confuse grant reviewers about the current state.

---

## 3. Incorrect Documentation

### 3.1 docker-compose.prod.yml — Healthcheck URL `[P1 — High]`
Line 39 of `docker-compose.prod.yml`:
```yaml
test: ['CMD', 'curl', '-sf', 'http://localhost:3000/api/v1/giwa/services']
```
The root `Dockerfile` was updated to use `/health`. The Docker Compose production file still references the old authenticated API endpoint. This will cause health checks to fail against containers in production that enforce authentication.

### 3.2 docker-compose.staging.yml — Healthcheck URL `[P1 — High]`
Same issue on line 33 of `docker-compose.staging.yml`. Both compose files should reference `/health`.

### 3.3 Root README — Prerequisites `[P2 — Medium]`
States:
> Node.js v18 or higher

CI (`ci.yml` line 14) and the Dockerfile use **Node.js 20**. The minimum stated requirement is incorrect and will cause unexpected behavior if a developer uses Node.js 18.

### 3.4 Root README — Port `[P2 — Medium]`
States `open http://localhost:5000`. The `backend/.env.example` sets `PORT=5000`, and `backend/package.json` start script uses `node server.js` which would use whatever `PORT` is set. The Docker Compose files expose port **3000**. The README is inconsistent with the Docker deployment.

---

## 4. Inconsistent Terminology

| Term Used Inconsistently | Found In | Correct/Preferred Term |
| :--- | :--- | :--- |
| "L2 settlement" vs "cross-border settlement" | SDK README, server.js comments | **L2 cross-border settlement** (use both) |
| "session token" vs "Bearer token" vs "JWT" | SDK README, server.js, auth flow | **Bearer token (JWT)** |
| "Mock" prefix on assets | GIWA_AUDIT, schema.prisma, UI | Clarify: `MockKRW` is a testnet token; document its relationship to future `KRW` |
| "Dojang" (lowercase/uppercase) | MIGRATION_GIWA.md, code, GIWA_AUDIT.md | **Dojang** (always capitalize as a proper noun) |
| "RC1", "RC2", "RC3" | Multiple docs | Define these terms once in a VERSIONING.md or README glossary |
| "GIWA" vs "GIWA L2" vs "GIWA network" | Throughout | **GIWA L2** when referring to the chain; **GIWA** alone when referring to the ecosystem |
| "wallet" vs "Wallet" vs "user wallet" | SDK README, server.js | Standardize: **wallet** (lowercase noun) |
| "KYC" vs "identity verification" | compliance docs, frontend | **KYC** (technical), "identity verification" (user-facing) — document the distinction |

---

## 5. Broken Internal Links

| Document | Link / Reference | Status |
| :--- | :--- | :--- |
| `MIGRATION_GIWA.md` | References `backend/indexer.js` | File not present in repository root or visible in listing |
| `MIGRATION_GIWA.md` | References `backend/src/giwa/serviceRegistry.js` | Path may be outdated — not verified against current structure |
| `GIWA_AUDIT.md` | References `frontend/showcase.html` | Not in visible frontend directory listing |
| `docker-compose.prod.yml` | `./postgres/postgresql.conf` | No `postgres/` directory exists in the repository |
| `docker-compose.prod.yml` | `./nginx/prod.conf`, `./nginx/certs` | No `nginx/` directory exists in the repository |
| `docker-compose.staging.yml` | `./nginx/staging.conf`, `./nginx/certs` | No `nginx/` directory exists in the repository |
| Root `README.md` | No links at all | All referenced files (`dashboard.html`, `app.js`) lack anchor links |

> [!CAUTION]
> The missing `postgres/` and `nginx/` directories referenced in the Docker Compose production file are a **deployment blocker**. The `docker compose up` command will fail for any new operator following the docs.

---

## 6. Missing Diagrams

| Diagram | Where Needed | Priority |
| :--- | :--- | :--- |
| **End-to-end settlement flow** (User → API → L2 → Proof → Archive) | Root README, backend README | P0 |
| **Authentication flow** (Wallet connect → Nonce → Signature → JWT) | Root README, SDK docs | P0 |
| **System component map** (Frontend → Backend → DB → GIWA L2 → EAS) | Root README | P1 |
| **Database schema ERD** | Backend README or dedicated `DATABASE.md` | P1 |
| **CI/CD pipeline flow** (PR → Lint → Test → Security → Docker → Deploy) | CONTRIBUTING.md | P2 |
| **Docker service topology** (nginx → backend → postgres → prometheus) | Infrastructure README | P2 |
| **Trust provider switching diagram** (Mock → Dojang → Enterprise) | MIGRATION_GIWA.md already has one; link from SDK docs | P3 |

> [!NOTE]
> `MIGRATION_GIWA.md` contains an excellent Mermaid architecture diagram. This should be referenced from the root README.

---

## 7. Missing Setup Instructions

### 7.1 Database Setup `[P0 — Critical]`
There are zero instructions anywhere for:
- Installing and starting PostgreSQL locally
- Running `npx prisma migrate dev` to create the database schema
- Seeding the database (the server auto-seeds on startup, but this is undocumented)

### 7.2 Environment Variables `[P0 — Critical]`
`backend/.env.example` exists but:
- Is not referenced from the root README
- Does not explain what each variable does or its valid values
- Missing variables: `SESSION_SECRET`, `WEBHOOK_SECRET`, `SEMGREP_APP_TOKEN` (for CI)

### 7.3 Smart Contract Setup `[P1 — High]`
No instructions for:
```bash
npm install          # install hardhat dependencies
npx hardhat compile  # compile contracts
npx hardhat test     # run contract tests
npx hardhat run scripts/deploy.js --network giwa  # deploy (script doesn't exist yet)
```

### 7.4 SDK Local Development `[P1 — High]`
`sdk/README.md` shows `npm install @korripay/sdk` implying npm registry availability. The package is not published. There are no instructions for local linking:
```bash
cd sdk && npm run build
npm link
cd ../my-app && npm link @korripay/sdk
```

### 7.5 Monitoring Stack Setup `[P2 — Medium]`
No instructions for starting Prometheus or connecting Grafana. The `monitoring/prometheus.yml` references a `postgres-exporter` and `nginx-exporter` that require separate setup not documented anywhere.

### 7.6 Redis Setup (New Dependency) `[P1 — High]`
`lockService.js` now supports Redis via `REDIS_URL`. This is not documented in `.env.example` or any README, and operators have no guidance on when Redis is required vs optional.

---

## 8. Missing Troubleshooting Sections

| Problem Scenario | Document Needed | Priority |
| :--- | :--- | :--- |
| `DATABASE_URL` not set / Prisma connection failure | Backend README / root README | P0 |
| Port 5000 / 3000 already in use | Root README troubleshooting | P0 |
| `npx prisma migrate deploy` fails on fresh DB | Backend README | P0 |
| GIWA RPC node offline — simulation fallback behavior | Backend README, GIWA docs | P1 |
| Docker health check fails on startup | Infrastructure README | P1 |
| JWT token expired — frontend redirect behavior | SDK README | P1 |
| Semgrep token not set — CI warning behavior | CONTRIBUTING.md | P2 |
| `nginx/` or `postgres/` directories missing — compose fails | Infrastructure README | P1 |
| `lockService` Redis connection error — fallback behavior | Backend README | P1 |
| Smart contract compilation fails — OpenZeppelin version mismatch | Contract README | P2 |

---

## 9. Prioritized Documentation Roadmap

### Phase 1 — Pre-Release Blockers (Must complete before any public announcement)

| # | Task | Owner | Effort |
|---|---|---|---|
| 1.1 | **Rewrite root `README.md`** — update stack, GIWA context, Docker quickstart, correct ports, updated API table, updated project structure | Technical Writer | Large |
| 1.2 | **Fix Docker Compose healthcheck URLs** — update `docker-compose.prod.yml` and `docker-compose.staging.yml` to use `/health` | DevOps | Small |
| 1.3 | **Create `nginx/` and `postgres/` directories** with starter config files, or update compose files to remove the missing volume mounts | DevOps | Medium |
| 1.4 | **Add database setup instructions** — Prisma migration steps to root README and a new `backend/README.md` | Technical Writer | Medium |
| 1.5 | **Add `REDIS_URL` to `.env.example`** with explanation of when it is required | Technical Writer | Small |
| 1.6 | **Add end-to-end settlement flow diagram** to root README | Technical Writer | Medium |

### Phase 2 — Grant Submission Quality (Complete before grant application)

| # | Task | Owner | Effort |
|---|---|---|---|
| 2.1 | **Create `CONTRIBUTING.md`** — local dev setup, GitHub Secrets list, CI pipeline guide | Technical Writer | Medium |
| 2.2 | **Create `backend/README.md`** — service architecture, directory structure, migration commands, test runner instructions | Technical Writer | Medium |
| 2.3 | **Create `monitoring/README.md`** — Prometheus setup, Grafana connection, exposed metrics glossary | DevOps | Small |
| 2.4 | **Update GIWA_AUDIT.md** — mark resolved items, update alignment score to reflect RC2 improvements | Technical Writer | Small |
| 2.5 | **Update SDK README** — add auth flow, production baseUrl config, local linking instructions, rate limit behavior | Technical Writer | Medium |
| 2.6 | **Add smart contract deployment section** — constructor args, Hardhat network config for GIWA, post-deploy address registry | Blockchain Engineer | Medium |
| 2.7 | **Standardize terminology** — apply consistent GIWA L2 / Dojang / Bearer token / KYC usage across all documents | Technical Writer | Medium |
| 2.8 | **Add troubleshooting section to root README** — top 5 common setup errors | Technical Writer | Small |

### Phase 3 — Developer Experience Polish (Nice-to-have)

| # | Task | Owner | Effort |
|---|---|---|---|
| 3.1 | Add database ERD diagram to a new `DATABASE.md` | Technical Writer | Medium |
| 3.2 | Add CI/CD pipeline flow diagram to `CONTRIBUTING.md` | Technical Writer | Small |
| 3.3 | Add Docker service topology diagram to infrastructure docs | Technical Writer | Small |
| 3.4 | Create a `GLOSSARY.md` defining RC1/RC2/RC3, GIWA, Dojang, EAS, ZK Proof, Osaka | Technical Writer | Small |
| 3.5 | Publish SDK to npm registry and update SDK README installation instructions | Engineering | Large |
| 3.6 | Update MIGRATION_GIWA.md test counts (195 → 200) | Technical Writer | Small |

---

## Appendix: Document Inventory

| Document | Location | Currency | Public-Ready |
|---|---|---|---|
| Root README | `/README.md` | 🔴 Outdated | ❌ No |
| GIWA Migration | `/MIGRATION_GIWA.md` | 🟢 Current | ✅ Yes |
| GIWA Audit | `/GIWA_AUDIT.md` | 🟡 RC1-era | ⚠️ Partial |
| Security Audit | `/SECURITY_AUDIT.md` | 🟢 Current | ✅ Yes |
| Smart Contract Audit | `/SMART_CONTRACT_AUDIT.md` | 🟢 Current | ✅ Yes |
| Performance Report | `/PERFORMANCE_REPORT.md` | 🟢 Current | ✅ Yes |
| Load Test Report | `/LOAD_TEST_REPORT.md` | 🟢 Current | ✅ Yes |
| Regression Report | `/REGRESSION_REPORT.md` | 🟢 Current | ✅ Yes |
| RC1 Architecture Review | `/RC1_ARCHITECTURE_REVIEW.md` | 🟡 RC1-era | ⚠️ Partial |
| RC2 Release Review | `/RC2_RELEASE_REVIEW.md` | 🟢 Current | ✅ Yes |
| SDK README | `/sdk/README.md` | 🟡 Partial | ⚠️ Partial |
| CI Workflow | `/.github/workflows/ci.yml` | 🟢 Current | ✅ Yes |
| Env Template | `/backend/.env.example` | 🟡 Partial | ⚠️ Partial |
| Prometheus Config | `/monitoring/prometheus.yml` | 🟢 Current | ✅ Yes |
