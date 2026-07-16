# Entity Relationship Diagram (ERD)

This document visualizes the relational domains of the KorriPay core database.

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : owns
    ORGANIZATIONS ||--o{ KEY_KEYS : manages
    ORGANIZATIONS ||--o{ SETTLEMENTS : matching
    ORGANIZATIONS ||--o{ TREASURY_ACCOUNTS : reserves
    ORGANIZATIONS ||--o{ LEDGER_ACCOUNTS : audits
    ORGANIZATIONS ||--o{ AUDIT_LOGS : records

    ORGANIZATION_MEMBERS }|--|| ORGANIZATIONS : belongs_to
    ORGANIZATION_MEMBERS }|--|| USERS : belongs_to
    ORGANIZATION_MEMBERS }|--|| ROLES : has

    SESSIONS }|--|| USERS : references
    SESSIONS }|--|| ORGANIZATIONS : targets

    SETTLEMENTS ||--o{ SETTLEMENT_INSTRUCTIONS : defines
    SETTLEMENTS ||--o{ SETTLEMENT_ROUTES : paths
    SETTLEMENTS ||--o{ SETTLEMENT_FEES : taxes
    SETTLEMENTS ||--o{ SETTLEMENT_EVENTS : timeline

    LEDGER_TRANSACTIONS ||--|{ LEDGER_ENTRIES : includes
    LEDGER_ENTRIES }|--|| LEDGER_ACCOUNTS : matches

    COMPLIANCE_ASSESSMENTS }|--|| SETTLEMENTS : reviews
    IDENTITY_PROFILES ||--o{ CREDENTIALS : checks
    IDENTITY_PROFILES ||--o{ VERIFICATION_RECORDS : inspects

    SETTLEMENTS ||--o{ SETTLEMENT_PROOFS : generates
    SETTLEMENTS ||--o{ SETTLEMENT_CERTIFICATES : signs
```

## Relational Domains

### 1. Identity Domain

Tracks participants, role assignments, authentication tokens, API keys, and multi-tenant organizational hierarchies.

### 2. Settlement Domain

Manages the lifecycle status changes of transactions, instructions, route selection, and settlement histories.

### 3. Treasury Domain

Double-entry ledger balances calculated dynamically from debit and credit items matching an immutable ledger transaction.
