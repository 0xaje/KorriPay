# Database Naming Conventions

This document establishes the database naming rules and constraints enforced within the KorriPay system.

## Casing Conventions

- **Tables**: Snake_case, pluralized (e.g. `organizations`, `ledger_entries`, `audit_logs`).
- **Columns**: Snake_case (e.g. `organization_id`, `password_hash`, `expires_at`). Matches Postgres defaults when mapped in Prisma.
- **Primary Keys**: UUID strings mapped via `id` in camelCase and `id` in database.
- **Enums**: Upper snake_case (e.g. `FINANCIAL_INSTITUTION`, `SUPER_ADMIN`, `COMPLETED`).

## Immutability Rules

1. **Double-Entry Ledger (`ledger_entries`, `ledger_transactions`)**:
   - Updates are forbidden.
   - Deletions are forbidden.
   - All balance adjustments require corrective debit/credit entries linked to a new ledger transaction.
   - Balances must not be stored as operational properties, but calculated dynamically from entries.

2. **Auditing (`audit_logs`)**:
   - Logs are append-only.
   - Each record stores the SHA-256 hash of its contents to check integrity.

3. **Operations & Events (`domain_events`, `settlement_events`)**:
   - Structured as temporal timelines. Never modify events.
