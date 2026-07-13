<div align="center">

<img src="https://img.shields.io/badge/KorriPay-Production%20Ready-00d084?style=for-the-badge&labelColor=0d1117" alt="KorriPay" />

# KorriPay

**Institutional-grade cross-border programmable settlement infrastructure built natively on the GIWA Layer-2 network.**

[![CI Status](https://img.shields.io/github/actions/workflow/status/0xaje/KorriPay/ci.yml?branch=main&style=flat-square&label=CI&logo=github)](https://github.com/0xaje/KorriPay/actions)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-3b82f6?style=flat-square)](LICENSE)
[![GIWA L2](https://img.shields.io/badge/GIWA%20L2-Chain%2092837-8b5cf6?style=flat-square)](https://giwa.io)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=flat-square&logo=solidity)](https://soliditylang.org/)
[![Tests](https://img.shields.io/badge/Tests-200%20Passing-00d084?style=flat-square)](#testing)

[Overview](#-overview) · [Quick Start](#-quick-start) · [Architecture](#-architecture) · [API Docs](#-api-documentation) · [SDK](#-sdk) · [Deployment](#-deployment) · [Roadmap](#-roadmap)

</div>

---

## 🌐 Overview

KorriPay is an **institutional-grade fintech platform** that enables real-time, traceable cross-border settlements anchored to the **GIWA Layer-2 blockchain**. Every settlement produces a cryptographic proof that can be independently verified — bringing bank-grade compliance to decentralized infrastructure.

### Problem Statement

Cross-border settlements in emerging markets suffer from three critical failures:

1. **Opacity** — settlements disappear into correspondent banking rails with no real-time traceability.
2. **Compliance theatre** — KYC checks are recorded in private databases with no public audit trail.
3. **Settlement risk** — funds can sit in escrow for days with no provable finality signal.

### Why GIWA

KorriPay is built **specifically** for the GIWA L2 network (`Chain ID: 92837`) because:

| Feature | Traditional Banking | Generic EVM L2 | KorriPay on GIWA |
|---|---|---|---|
| Settlement finality | 1–5 business days | Minutes (probabilistic) | **Seconds (ZK-proven)** |
| Compliance audit trail | Private database | Off-chain | **On-chain via EAS** |
| KYC verification | Centralised silo | Not applicable | **Dojang + EAS attestations** |
| Multi-currency support | Limited pairs | Token swaps only | **KRW, NGN, USD, MockKRW** |
| Gas optimisation | N/A | Standard EVM | **Osaka precompiles (P256VERIFY, MODEXP)** |

---

## ✨ Features

### Core Settlement Infrastructure
- **L2 Settlement Pipeline** — 5-stage state machine: Compliance → Route → Execute → Confirm → Archive
- **ZK Proof Generation** — Every settlement produces a cryptographic proof object with block number, gas used, and proof status
- **Multi-Currency Ledger** — Available / Locked / Pending balances for USD, KRW, NGN, and MockKRW
- **FX Engine** — Live exchange rate quotes with institutional fee schedules

### Compliance & Identity
- **GIWA Trust Layer** — Switchable provider architecture: `Mock → Dojang → Enterprise`
- **EAS Attestations** — Identity, Merchant, Business, Payroll, and Compliance attestation types
- **KYC Pipeline** — 6-step identity verification with compliance screening on every transaction
- **Velocity & Rule Engine** — Daily limits, transaction caps, and geographic screening

### Developer Platform
- **REST API v1** — 50+ endpoints with OpenAPI 3.0 / Swagger documentation
- **JavaScript SDK** — TypeScript-first client for settlements, wallets, proofs, and identity
- **Webhook System** — HMAC-SHA256 signed event delivery with automatic retry logic
- **Merchant APIs** — Payment request generation, checkout links, and settlement reconciliation

### Operations
- **Observability** — `/health`, `/ready`, `/live`, `/metrics` (Prometheus-compatible)
- **Admin Dashboard** — User management, KYC review, attestation issuance, audit logs
- **Corporate Organisations** — Multi-member orgs with RBAC, approval limits, and audit trails

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        KorriPay Frontend                             │
│   index.html · dashboard.html · trust.html · treasury.html          │
│   walletService.js (Wagmi/Viem) · tokenService.js · app.js          │
│                 ↓ REST API calls (Bearer JWT)                        │
├──────────────────────────────────────────────────────────────────────┤
│                    Express Backend (Node.js 20)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   API v1     │  │  Controllers  │  │      Middleware           │  │
│  │ /settlements │  │ wallet/fx/    │  │ helmet · cors · ratelimit│  │
│  │ /wallets     │  │ admin/comply  │  │ compression · morgan      │  │
│  │ /proofs      │  │ giwa/trust    │  │ requireAuth · requestId   │  │
│  │ /attestations│  └──────────────┘  └──────────────────────────┘  │
│  └──────────────┘           ↓                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      Service Layer                              │  │
│  │  settlementService · attestationService · trustScoreService    │  │
│  │  webhookService · organizationService · networkIntelligence    │  │
│  │           lockService (Redis/local mutex)                       │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             ↓                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              GiwaInfrastructure Layer                          │  │
│  │  getRPC() · getExplorer() · getSequencer() · getHealth()       │  │
│  │  DojangIntegration · KRWStablecoinIntegration                  │  │
│  │  GIWAServiceRegistry (auto-failover, priority routing)         │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
├─────────────────────────────┼────────────────────────────────────────┤
│          PostgreSQL          │             GIWA L2 Network            │
│      (Prisma ORM)           │         Chain ID: 92837                │
│  Users · Wallets · Txns     │  KorriSettlement.sol (escrow)          │
│  Settlements · Proofs       │  KorriTreasury.sol (custody)           │
│  Attestations · Orgs        │  EAS Registry (0xEA50...0000)          │
│  Compliance · Webhooks      │  Osaka EVM · op-reth · kona-client     │
└──────────────────────────────────────────────────────────────────────┘
```

> Full interactive architecture diagram: [`MIGRATION_GIWA.md`](MIGRATION_GIWA.md#5-system-architecture-diagram)

---

## 🚀 Quick Start

### Prerequisites

| Dependency | Version | Notes |
|---|---|---|
| Node.js | **20+** | LTS recommended |
| npm | 9+ | Bundled with Node.js |
| PostgreSQL | 14+ | Or use Docker (see below) |
| Git | Any | — |

### Option A — Docker (Recommended)

The fastest way to run the full stack locally:

```bash
# 1. Clone the repository
git clone https://github.com/0xaje/KorriPay.git
cd KorriPay

# 2. Copy the environment template
cp backend/.env.example backend/.env
# Edit backend/.env and set your values (see Environment Variables below)

# 3. Start the full stack (backend + postgres + prometheus)
docker compose -f docker-compose.staging.yml up -d

# 4. Run database migrations
docker compose -f docker-compose.staging.yml exec backend npx prisma migrate deploy

# 5. Open in browser
open http://localhost:3001
```

### Option B — Local Development

```bash
# 1. Clone the repository
git clone https://github.com/0xaje/KorriPay.git
cd KorriPay

# 2. Install backend dependencies
npm install --prefix backend

# 3. Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL and other values

# 4. Generate Prisma client and run migrations
cd backend
npx prisma generate
npx prisma migrate dev --name init
cd ..

# 5. Start the development server (hot-reload)
cd backend && npm run dev

# 6. Open in browser
open http://localhost:5000
```

The backend serves the `frontend/` directory as static files — no separate frontend server is needed.

---

## ⚙️ Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Description | Default |
|---|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | — |
| `NODE_ENV` | ✅ | `development`, `staging`, or `production` | `production` |
| `PORT` | — | HTTP server port | `5000` |
| `GIWA_RPC_URL` | — | Primary GIWA L2 RPC endpoint | `http://127.0.0.1:8545` |
| `RPC_BACKUP_URL` | — | Backup RPC for auto-failover | `https://rpc.giwa.io` |
| `GIWA_EXPLORER_URL` | — | Block explorer base URL | `https://explorer.giwa.io` |
| `GIWA_CHAIN_ID` | — | GIWA L2 chain identifier | `92837` |
| `SETTLEMENT_ADDRESS` | — | Deployed `KorriSettlement.sol` address | Localhost default |
| `GIWA_SEQUENCER_ADDRESS` | — | L2 sequencer contract address | See `.env.example` |
| `REDIS_URL` | — | Redis connection string for distributed locks. If unset, uses in-memory mutex (single-instance only). | — |
| `ALLOWED_ORIGINS` | — | Comma-separated CORS origins | `http://localhost:5000` |
| `TRUST_PROVIDER` | — | Active trust provider: `mock`, `dojang`, or `enterprise` | `mock` |

> **Never commit your `.env` file.** It is listed in `.gitignore`.

---

## 💻 Local Development

### Backend

```bash
cd backend

# Start with hot-reload (nodemon)
npm run dev

# Run linter
npm run lint

# Run linter with auto-fix
npm run lint:fix
```

### Frontend

The frontend is served as static files by the Express backend. No build step is required. Edit files in `frontend/` and refresh your browser.

Key frontend files:

| File | Purpose |
|---|---|
| `frontend/index.html` | Login / wallet connect page |
| `frontend/dashboard.html` | Main application (all tabs) |
| `frontend/app.js` | All state management, API calls, and UI logic |
| `frontend/walletService.js` | Wagmi/Viem wallet connector (MetaMask, Coinbase Wallet) |
| `frontend/tokenService.js` | Token address registry by chain ID |
| `frontend/styles.css` | Custom CSS design system |

### Smart Contracts

```bash
# Install root dependencies (includes Hardhat)
npm install

# Compile contracts
npx hardhat compile

# Run Hardhat tests
npx hardhat test

# Generate gas report
REPORT_GAS=true npx hardhat test
```

### SDK

```bash
cd sdk

# Build TypeScript to JavaScript
npm run build

# Link locally for testing in another project
npm link

# In your test project:
npm link @korripay/sdk
```

---

## 🧪 Testing

### Backend Integration & Unit Tests

```bash
cd backend

# Run all 200 tests
npm test

# Run tests with coverage report
npm run coverage
```

The test suite covers:
- REST API v1 endpoints (settlements, wallets, proofs, attestations)
- Controller routes (wallet, FX, compliance, admin, GIWA)
- Service unit tests (settlementService, attestationService, webhookService, trustScore)
- Authentication & authorization flows
- Merchant payment workflows
- Extended branch coverage

### Smart Contract Tests

```bash
# From repository root
npx hardhat test
```

### Load Testing

A load test script is available at `scripts/` for simulating up to 1,000 concurrent users. See [`LOAD_TEST_REPORT.md`](LOAD_TEST_REPORT.md) for benchmark results.

---

## 📦 Repository Structure

```
KorriPay/
│
├── backend/                          # Express.js REST API
│   ├── server.js                     # Main application entry point
│   ├── apiV1.js                      # Versioned /api/v1 route definitions
│   ├── walletController.js           # Wallet credit/debit/lock/unlock/ledger
│   ├── adminController.js            # Admin user/KYC/attestation management
│   ├── giwaController.js             # GIWA network status & service registry
│   ├── complianceService.js          # Transaction screening & velocity checks
│   ├── webhookController.js          # Webhook subscription management
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema (Users, Wallets, Settlements…)
│   │   └── migrations/               # Auto-generated Prisma migrations
│   ├── src/
│   │   ├── infrastructure/
│   │   │   └── giwa/
│   │   │       ├── GiwaInfrastructure.js  # Core GIWA layer (registry, failover)
│   │   │       ├── index.js               # Singleton giwa instance export
│   │   │       └── index.d.ts             # TypeScript definitions
│   │   └── services/
│   │       ├── settlementService.js       # 5-stage settlement state machine
│   │       ├── attestationService.js      # EAS + Dojang attestation engine
│   │       ├── trustScoreService.js       # GIWA trust score calculations
│   │       ├── lockService.js             # Redis/local distributed lock
│   │       ├── webhookService.js          # HMAC-signed event delivery
│   │       ├── organizationService.js     # Corporate org management
│   │       └── networkIntelligenceService.js  # RPC telemetry & health
│   ├── test/                         # Mocha integration & unit test suite
│   └── .env.example                  # Environment variable template
│
├── frontend/                         # Vanilla HTML/CSS/JS frontend
│   ├── index.html                    # Login page
│   ├── dashboard.html                # Main dashboard (all views)
│   ├── trust.html                    # GIWA Trust Layer explorer
│   ├── treasury.html                 # Treasury analytics
│   ├── developers.html               # Developer portal & SDK docs
│   ├── organization.html             # Corporate org management
│   ├── admin.html                    # Admin control panel
│   ├── app.js                        # Main application logic
│   ├── walletService.js              # Wallet connection (Wagmi/Viem)
│   ├── tokenService.js               # Token address registry
│   └── styles.css                    # Global CSS design system
│
├── contracts/                        # Solidity smart contracts
│   ├── KorriSettlement.sol           # Escrow + settlement lifecycle
│   ├── KorriTreasury.sol             # Fund custody & emergency controls
│   └── MockKRWStable.sol             # Testnet KRW stablecoin
│
├── sdk/                              # Official JavaScript/TypeScript SDK
│   ├── src/
│   │   ├── client.ts                 # KorriPayClient class
│   │   ├── types.ts                  # TypeScript interfaces
│   │   ├── errors.ts                 # Typed error classes
│   │   └── index.ts                  # Public exports
│   └── README.md                     # SDK documentation
│
├── scripts/                          # DevOps shell scripts
│   ├── deploy.sh                     # Docker Compose deployment orchestrator
│   ├── backup.sh                     # PostgreSQL database backup (gzip)
│   └── restore.sh                    # Database restore from backup
│
├── monitoring/
│   └── prometheus.yml                # Prometheus scrape configuration
│
├── .github/workflows/
│   ├── ci.yml                        # Lint · Test · Security · Docker
│   ├── contracts.yml                 # Solidity compile · Hardhat · Slither
│   ├── staging.yml                   # Staging deploy pipeline
│   └── production.yml                # Production release pipeline
│
├── docker-compose.staging.yml        # Staging stack (backend + postgres + nginx)
├── docker-compose.prod.yml           # Production stack (+ prometheus, replicas)
├── Dockerfile                        # Production multi-stage image
├── Dockerfile.dev                    # Development image (hot-reload)
├── hardhat.config.js                 # Hardhat contract build config
└── README.md                         # This file
```

---

## 📡 API Documentation

### Interactive Docs (Swagger UI)

Start the backend and open:

```
http://localhost:5000/api-docs
```

### Key Endpoint Groups

#### Observability (no auth required)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/live` | Liveness probe — is the process alive? |
| `GET` | `/ready` | Readiness probe — is the database reachable? |
| `GET` | `/health` | Full system health (memory, uptime, services) |
| `GET` | `/metrics` | Prometheus-compatible telemetry scrape target |

#### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register a new user |
| `POST` | `/api/auth/signin` | Authenticate with email/password |
| `POST` | `/api/auth/demo` | Create/authenticate a demo user |
| `GET` | `/api/auth/nonce` | Get wallet signature challenge nonce |
| `POST` | `/api/auth/verify` | Verify EIP-712 wallet signature |

#### Settlements (v1)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/settlements` | Initiate a new L2 settlement |
| `GET` | `/api/v1/settlements` | List settlements for authenticated user |
| `GET` | `/api/v1/settlements/:id` | Get single settlement details |
| `GET` | `/api/v1/proofs` | List cryptographic proofs |
| `GET` | `/api/v1/wallets` | Get multi-currency wallet |

#### GIWA Network
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/giwa/services` | Service registry and health status |
| `GET` | `/api/v1/network` | Network intelligence & telemetry |
| `GET` | `/api/giwa/status` | Live GIWA L2 network status |

> For the complete endpoint reference, see the [Swagger UI](#) or [`apiV1.js`](backend/apiV1.js).

---

## 📦 SDK

Install the official KorriPay SDK:

```bash
npm install @korripay/sdk
```

> **Note:** The SDK is currently available for local use via `npm link`. npm registry publication is on the [roadmap](#-roadmap).

### Quick Example

```javascript
import { KorriPayClient } from '@korripay/sdk';

// 1. Authenticate via POST /api/auth/signin to get a token
const client = new KorriPayClient({
  baseUrl: 'https://your-korripay-instance.com/api/v1',
  token: 'your_bearer_token'
});

// 2. Check wallet balance
const wallet = await client.getWallet();
console.log('USD Available:', wallet.balances.USD.available);

// 3. Create a settlement
const result = await client.createSettlement({
  recipient: 'Elena Gilbert',
  amount: 150.00,
  recipientAddress: '0x4a2ae92f883920108e7ef9e8b625cf016dfec156'
});
console.log('Settlement ID:', result.settlementId);

// 4. Fetch the ZK proof
const proof = await client.getProof(result.settlementId);
console.log('Block:', proof.blockNumber, '| Gas:', proof.gasUsed);
```

See the full [SDK README](sdk/README.md) for error handling, all methods, and TypeScript types.

---

## 🐳 Deployment

### Staging

```bash
./scripts/deploy.sh staging
```

This builds the Docker image, runs Prisma migrations, and starts the staging stack.

### Production

```bash
./scripts/deploy.sh prod
```

Ensure the following files exist before production deployment:

```
backend/.env.production     # Production environment variables
nginx/prod.conf             # Nginx reverse proxy config
nginx/certs/                # TLS certificates
postgres/postgresql.conf    # PostgreSQL tuning config
```

### Database Backup & Restore

```bash
# Create a timestamped gzip backup
./scripts/backup.sh

# Restore from a backup file
./scripts/restore.sh backups/korripay_backup_20260707_000000.sql.gz
```

### CI/CD Pipelines

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | Push to `main`, `develop`, PRs | Lint → Test → Security scan (Semgrep + npm audit) → Docker build |
| `contracts.yml` | Push touching `contracts/` | Compile → Hardhat test → Slither static analysis |
| `staging.yml` | Push to `develop` | Build → Push GHCR → Deploy to staging |
| `production.yml` | Push tag `v*.*.*` | Build → Push GHCR → Deploy to production |

#### Required GitHub Secrets

| Secret | Description |
|---|---|
| `SEMGREP_APP_TOKEN` | Semgrep SAST scanning token (optional — CI warns if missing) |
| `POSTGRES_USER` | Database username |
| `POSTGRES_PASSWORD` | Database password |
| `GHCR_TOKEN` | GitHub Container Registry push token |

---

## 🗺 Roadmap

### RC2 — Completed ✅
- [x] GIWA infrastructure centralisation layer
- [x] 5-stage settlement state machine with ZK proof pipeline
- [x] Redis-backed distributed lock for multi-instance safety
- [x] PostgreSQL pessimistic row-level locks on balance operations
- [x] Production security hardening (Helmet, CORS, rate limiting)
- [x] Full observability stack (`/health`, `/ready`, `/live`, `/metrics`)
- [x] 200/200 automated tests passing
- [x] Docker production & development images
- [x] Deployment, backup, and restore scripts
- [x] Swagger/OpenAPI documentation

### RC3 — In Progress 🔄
- [ ] EAS on-chain attestation verification (replace DB queries)
- [ ] Real-time network telemetry (replace Math.random() block metrics)
- [ ] GIWA testnet registration in Hardhat config for contract CI
- [ ] Redis cache layer for FX rates and system config
- [ ] `nginx/` and `postgres/` starter configurations

### Post-RC3 — Future 🔮
- [ ] KRW Stablecoin contract integration (live `KRW` on GIWA L2)
- [ ] Dojang production trust provider integration
- [ ] up.id name resolution production rollout
- [ ] npm registry publication of `@korripay/sdk`
- [ ] Frontend migration to React/Vite SPA
- [ ] TypeScript backend migration
- [ ] Grafana dashboard templates for the Prometheus metrics stack
- [ ] PM2 cluster mode configuration for horizontal scaling

---

## 🤝 Contributing

Contributions are welcome. Please follow this workflow:

1. **Fork** the repository and create a branch: `git checkout -b feat/my-feature`
2. **Install** dependencies: `npm install --prefix backend`
3. **Make changes** — no source code modifications to smart contracts without a security review
4. **Run tests**: `cd backend && npm test` — all 200 must pass
5. **Run linter**: `npm run lint`
6. **Open a Pull Request** against `develop`

CI will automatically run lint, tests, security scans, and a Docker build on every PR.

---

## 📋 Audit Reports

KorriPay maintains a complete set of production readiness reports in the repository:

| Report | Description |
|---|---|
| [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) | Full security audit with OWASP mapping and CVSS scores |
| [`SMART_CONTRACT_AUDIT.md`](SMART_CONTRACT_AUDIT.md) | Solidity contract review (access control, reentrancy, gas) |
| [`PERFORMANCE_REPORT.md`](PERFORMANCE_REPORT.md) | Bundle size, LCP, API latency, and DB query benchmarks |
| [`LOAD_TEST_REPORT.md`](LOAD_TEST_REPORT.md) | Concurrent user stress tests (100 / 500 / 1,000 users) |
| [`REGRESSION_REPORT.md`](REGRESSION_REPORT.md) | End-to-end journey verification across all critical flows |
| [`RC2_RELEASE_REVIEW.md`](RC2_RELEASE_REVIEW.md) | CTO release candidate review with 9.4/10 readiness score |
| [`GIWA_AUDIT.md`](GIWA_AUDIT.md) | GIWA L2 native integration audit |
| [`MIGRATION_GIWA.md`](MIGRATION_GIWA.md) | GIWA infrastructure migration technical notes |

---

## 🛟 Support & Troubleshooting

### Common Issues

**`DATABASE_URL` not set / Prisma connection failed**
```bash
# Ensure backend/.env exists and DATABASE_URL is set
cat backend/.env | grep DATABASE_URL
# Run migrations
cd backend && npx prisma migrate dev
```

**Port already in use**
```bash
# Change the port in backend/.env
echo "PORT=5001" >> backend/.env
```

**GIWA RPC offline**
> KorriPay automatically falls back to local simulation mode when the GIWA RPC node is unreachable. Transactions will be simulated with generated hashes. Set `NODE_ENV=production` to disable simulation fallback and require a live RPC.

**Docker health check failing**
> Ensure the backend has finished starting (allow 40s `start_period`). Check logs: `docker compose logs backend`

**Redis connection error**
> `lockService` gracefully falls back to an in-memory mutex if `REDIS_URL` is not set or Redis is unreachable. This is safe for single-instance deployments. For clustered/horizontal scaling, provide a Redis instance.

---

## 📄 License

MIT © [0xaje](https://github.com/0xaje)

---

<div align="center">

Built on **GIWA L2** · Chain ID `92837` · Karst Hardfork · Osaka EVM

</div>
