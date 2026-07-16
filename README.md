# KorriPay Monorepo

Enterprise-grade financial infrastructure and high-throughput settlement engine built on Node.js, Express, TypeScript, Solidity, React 19, and Tailwind CSS v4.

## Monorepo Architecture

This workspace uses `pnpm` workspaces and `TurboRepo` for fast build orchestration:

```
korripay/
├── apps/               # Frontend applications and docs portal
│   ├── api/            # Express.js API gateway with Pino logging
│   ├── web/            # React 19 SPA styled with Tailwind CSS v4
│   └── docs/           # Documentation portal
├── packages/           # Shareable config packages and utility libraries
│   ├── config/         # Shareable tsconfig, ESLint, Prettier settings
│   ├── shared/         # Common enums, constants, types, and helpers
│   ├── errors/         # Application-wide Custom Error framework
│   ├── ui/             # Core UI components and design tokens
│   └── sdk/            # Client SDK integration skeleton
├── contracts/          # Solidity smart contracts (Hardhat workspaces)
│   ├── settlement/     # Settlement logic and escrow accounts
│   ├── treasury/       # Vaults and reserve management
│   └── identity/       # Verification registries and attestations
├── services/           # Backend microservices and background workers
│   ├── settlement-engine/  # High-throughput BullMQ transaction matching
│   ├── compliance/     # KYC/AML routing and transaction checks
│   ├── treasury/       # Cold/hot wallet ledger services
│   ├── proof/          # Zero-knowledge and proof verification
│   ├── attestation/    # Settlement confirmation attestations
│   └── notification/   # Webhook dispatchers and notifications
├── infrastructure/     # DevOps, Docker, monitoring, and runner configs
│   ├── docker/         # Dev and production Dockerfiles
│   ├── monitoring/     # Prometheus and Grafana configs
│   └── scripts/        # Seeding, migration, backups, and health checks
└── prisma/             # PostgreSQL database schema and migrations
```

## Getting Started

### Prerequisites

- Node.js LTS (>= 22.x)
- pnpm (>= 10.x)
- Docker & Docker Compose (for running DBs/Redis)

### Local Development Setup

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Boot infrastructure (DB and Redis)**:

   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

3. **Deploy database schemas**:

   ```bash
   pnpm --filter @korripay/api prisma db push
   ```

4. **Start local services in dev mode**:
   ```bash
   pnpm dev
   ```
   - API Gateway: [http://localhost:3001](http://localhost:3001)
   - Web App: [http://localhost:3000](http://localhost:3000)
   - Prometheus: [http://localhost:9090](http://localhost:9090)
   - Grafana: [http://localhost:3002](http://localhost:3002)

## Reference Documentation

Detailed architectural and process specifications are available in the [docs/](file:///home/oyeolorun/KorriPay/docs/) folder:

- [Architecture Overview](file:///home/oyeolorun/KorriPay/docs/architecture-overview.md)
- [Contributing Guide](file:///home/oyeolorun/KorriPay/docs/contributing.md)
- [Coding Standards](file:///home/oyeolorun/KorriPay/docs/coding-standards.md)
- [Branch Strategy](file:///home/oyeolorun/KorriPay/docs/branch-strategy.md)
- [Versioning Policy](file:///home/oyeolorun/KorriPay/docs/versioning-policy.md)
