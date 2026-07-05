# Release Candidate 1 (RC1) Architecture Review

This review documents the structural analysis, system scores, identified weaknesses, and high-impact remediation strategies for the **KorriPay** Release Candidate.

---

## 📊 Scorecard

| Metric | Score | Key Takeaway |
| :--- | :--- | :--- |
| **Architecture Score** | **8.5 / 10** | Solid layered architecture with a centralized GIWA infrastructure layer, decoupled Trust Layer adapters, and sequential execution pipeline. |
| **Maintainability Score** | **7.5 / 10** | High coverage test suite (200 passing tests) and clear separation of service logic, but impacted by a bloated monolithic frontend (`app.js`) and lack of backend TypeScript types. |
| **Scalability Score** | **8.0 / 10** | Multi-currency balance ledgering and event-driven webhook dispatches are highly scalable. However, the transaction queue (`txQueue`) is currently in-memory only. |
| **GIWA Alignment Score** | **9.5 / 10** | Complete migration of EVM networks to a centralized infrastructure layer. Native support for EAS, Dojang, and Enterprise providers with dynamic, runtime-swappable trust modules. |
| **Developer Experience Score**| **8.5 / 10** | Comprehensive automated test coverage, standardized OpenAPI Swagger docs, and simple local environment setup. |

---

## 🔍 System Component Inspections

### 1. Backend Service Layer
*   **Decoupled Trust Providers:** Excellent implementation of the `BaseAttestationProvider` interface. The `MockTrustProvider`, `DojangTrustProvider`, and `EnterpriseTrustProvider` isolate all provider-specific formatting (e.g., custom DID prefixes and cryptographic signatures) from the controller endpoints.
*   **State Machine Pipeline:** The settlement pipeline transitions requests cleanly through stages (Compliance, Route Selection, Execution, Confirmation, Archive).
*   **Concerns:** `server.js` (59KB) and `apiV1.js` (31KB) are monoliths that combine route registration, validation schemas, error handling, and business actions.

### 2. Frontend Layer
*   **Design & Templates:** Uses beautiful templates for pages like `dashboard.html`, `trust.html`, and `treasury.html`. 
*   **Concerns:**
    *   No modern SPA framework is used. Redundant boilerplate exists across HTML files (menus, scripts, styling imports).
    *   `app.js` is a monolithic 253KB script containing routing, chart drawing, API calls, event handling, and rendering. This will become extremely difficult to maintain as features scale.

### 3. Database Layer (Prisma & PostgreSQL)
*   **Schema Design:** Clean model structures. Support for corporate organizational hierarchies, approval limits, exchange rates, compliance audits, and multi-currency balances.
*   **Concerns:** Balance updates in `walletService.js` rely on standard Prisma transaction operations without row-level locking (`SELECT FOR UPDATE`), making them vulnerable to race conditions under concurrent requests.

### 4. Smart Contracts (L2 Settlement & Treasury)
*   **Safety Features:** Uses OpenZeppelin’s `AccessControl` and `ReentrancyGuard` to protect funds. Separation of concerns between escrowing/settlement (`KorriSettlement.sol`) and cold storage/asset management (`KorriTreasury.sol`) is well designed.
*   **Concerns:** No upgradeability mechanism (e.g., UUPS proxies). Any upgrades to the settlement flow will require redeploying the contract and manually updating the associated configuration addresses.

### 5. Wallet Integration
*   **RPC & Provider Decoupling:** Uses the centralized `GiwaInfrastructure` to resolve RPC nodes. Handles raw transaction broadcasting, blocks, gas costs, and confirmation logs correctly.
*   **Concerns:** Ethers.js provider is instantiated per-transaction or lazy-loaded, which can lead to overhead if many connections are opened simultaneously under high load.

---

## ⚠️ Architectural Weaknesses

1.  **Single-Instance In-Memory Transaction Queue (`txQueue`):**
    *   *Description:* The `settlementService` processes transactions sequentially using a promise chain (`this.txQueue`). 
    *   *Risk:* In a clustered or horizontally-scaled production setup, multiple instances of the backend will run independently. This in-memory queue will fail to prevent nonce collisions and gas price race conditions across instances.
2.  **Lack of Row-Level Database Balance Locking:**
    *   *Description:* Financial balance operations deduct and credit balances via Prisma, but do not issue pessimistic locks.
    *   *Risk:* Under high-frequency concurrent API calls (e.g. double-spending attempts), a wallet can withdraw more than its available balance before the database completes the write.
3.  **Frontend Code Duplication & Monolithic JavaScript:**
    *   *Description:* Layout components (header, sidebar, charts, state managers) are manually copied into multiple HTML files.
    *   *Risk:* Hard to test frontend units, increases page payload sizes, and slows down development velocity.

---

## 💡 Recommended High-Impact Improvements

### 1. Shift from In-Memory Queue to Distributed Lock (Redis & Redlock)
*   **Recommendation:** Replace `this.txQueue` in `settlementService.js` with a distributed lock mechanism using Redis/Redlock.
*   **Impact:** Ensures that only a single worker node can execute smart contract transactions for a specific signer wallet at any given moment, enabling safe horizontal scaling.

### 2. Implement Pessimistic Locking on Balance Updates
*   **Recommendation:** Use raw PostgreSQL queries (`prisma.$queryRaw`) with `SELECT ... FOR UPDATE` when reading balances that are about to be modified.
*   **Impact:** Completely eliminates balance deduction race conditions, preventing double-spending on the database level.

### 3. Separate API Routes from Business Controllers (MVC)
*   **Recommendation:** Split `apiV1.js` and `server.js` into modular route files (`/routes/attestations.js`, `/routes/settlements.js`) and corresponding controller modules (`/controllers/...`).
*   **Impact:** Dramatically improves code readability, isolation, and unit testability.

### 4. Transition to a Component-Based SPA (React + TypeScript)
*   **Recommendation:** Migrate the frontend code to a unified Single Page Application (SPA) using React, Vite, and TailwindCSS.
*   **Impact:** Simplifies state management, eliminates duplicate HTML code, and secures auth credentials within a centralized React context provider.
