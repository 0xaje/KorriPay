# KorriPay Terminology Alignment Report

This document reports the refactoring of user-facing terminology throughout the **KorriPay** codebase. The objective was to shift public positioning from a retail remittance/payment tool to an **infrastructure-grade, programmable settlement platform** built natively on the GIWA L2 network.

---

## 1. Terminology Alignment Summary

The following key terms were aligned across all user interface files, documentation files, and the SDK descriptions:

| Consumer Fintech Term | Infrastructure Term | Alignment Context / Applied Area |
|:---|:---|:---|
| **"Send Money"** | **"Create Settlement"** | Main sidebar and button triggers, tab headings, input modal headers. |
| **"Payment"** / **"Payments"** | **"Settlement"** / **"Settlement Infrastructure"** | Status updates, system components, card headers, overview features, and descriptions. |
| **"Transaction History"** | **"Settlement Ledger"** | Ledger listings, tables headings, empty state labels, navigation links. |
| **"Receipt"** / **"Payment Proof"** | **"Settlement Proof"** | PDF receipt document layouts, share options, download action text, success toasts. |
| **"Transfer"** | **"Settlement"** | Fee calculations, conversions summaries, status boards. |
| **"Trust Center"** / **"Trust Explorer"** | **"Attestation Registry"** | Trust Center page titles, header links, and attestation listings. |
| **"Wallet Dashboard"** / **"Dashboard"** | **"Settlement Dashboard"** | General references to the main workspace window. |

---

## 2. Updated Codebase Files

The refactoring was completed across the following workspace files:

### User Interface / Front-End
- [index.html](file:///home/oyeolorun/KorriPay/frontend/index.html) — Landing page headings, titles, navigation links, and flow graphics.
- [dashboard.html](file:///home/oyeolorun/KorriPay/frontend/dashboard.html) — Nav panels, card lists, buttons, tooltips, and modal views.
- [app.js](file:///home/oyeolorun/KorriPay/frontend/app.js) — Tab naming logic, user toasts, share messages, status panels, and PDF printing schemas.
- [trust.html](file:///home/oyeolorun/KorriPay/frontend/trust.html) — Title tag, navigation center links, header title, and safety rating gauges.
- [treasury.html](file:///home/oyeolorun/KorriPay/frontend/treasury.html) — Trust Center navigation links updated to Attestation Registry.
- [organization.html](file:///home/oyeolorun/KorriPay/frontend/organization.html) — Consent warnings, toast alerts, and header link structures.
- [developers.html](file:///home/oyeolorun/KorriPay/frontend/developers.html) — Navigation headers updated to Attestation Registry.
- [pay.html](file:///home/oyeolorun/KorriPay/frontend/pay.html) — Success status messages and PDF mapping logs.
- [showcase.html](file:///home/oyeolorun/KorriPay/frontend/showcase.html) — Interactive live simulator triggers, console logs, and slide flow decks.
- [dashboard-mockup.html](file:///home/oyeolorun/KorriPay/frontend/dashboard-mockup.html) — Static mock navigation, quick actions, tables, and item categories.
- [history-mockup.html](file:///home/oyeolorun/KorriPay/frontend/history-mockup.html) — Static title, headers, table rows, and activity types.
- [send-mockup.html](file:///home/oyeolorun/KorriPay/frontend/send-mockup.html) — Static form titles, summaries, fees, and button states.
- [send-recipient-mockup.html](file:///home/oyeolorun/KorriPay/frontend/send-recipient-mockup.html) — Target headers, summary overlays, and disclaimer texts.
- [swap-success-mockup.html](file:///home/oyeolorun/KorriPay/frontend/swap-success-mockup.html) — Sidebar navigation and action controls.
- [institutional-swap-mockup.html](file:///home/oyeolorun/KorriPay/frontend/institutional-swap-mockup.html) — Activity ticker feeds.

### Swagger Specification
- [apiV1.js](file:///home/oyeolorun/KorriPay/backend/apiV1.js) — OpenAPI `@openapi` JSDoc annotations, path summaries, and request parameter descriptions.

### Platform Documentation
- [README.md](file:///home/oyeolorun/KorriPay/README.md) — Root documentation, system features checklist, and pipeline overviews.
- [sdk/README.md](file:///home/oyeolorun/KorriPay/sdk/README.md) — SDK intro docs, functions wrappers JSDocs, and usage examples comments.
- [docs/architecture/01-system-overview.md](file:///home/oyeolorun/KorriPay/docs/architecture/01-system-overview.md) — Flowchart trigger labels.
- [docs/architecture/06-settlement-pipeline.md](file:///home/oyeolorun/KorriPay/docs/architecture/06-settlement-pipeline.md) — L2 sequencer diagrams and fallback simulation logs.
- [docs/architecture/08-attestation-layer.md](file:///home/oyeolorun/KorriPay/docs/architecture/08-attestation-layer.md) — Scoring table factors.
- [docs/api/02-settlements.md](file:///home/oyeolorun/KorriPay/docs/api/02-settlements.md) — Settlements endpoints description parameters.
- [REGRESSION_REPORT.md](file:///home/oyeolorun/KorriPay/REGRESSION_REPORT.md) — Verification summaries.

---

## 3. Intentionally Unchanged Terms & Code Structures

To satisfy the constraint **"Do NOT modify business logic, APIs, database schemas, smart contracts, tests, routing, or functionality"**, the following terms/symbols were kept unchanged:

| Unchanged Term | Source Location / File Pattern | Technical Justification |
|:---|:---|:---|
| **`category: "Transfer"`** | Backend controllers, servers, and tests | Stored database values and payload variables which are verified in mocha tests (e.g. `services_extended.test.js`). |
| **`TransferCreated`** / **`TransferConfirmed`** | Smart contracts, indexers, and tests | Solidity event names defined in `KorriSettlement.sol` and registered on-chain on GIWA L2; changing them breaks block parsing/ABI compatibility. |
| **`validateTransfer()`** / **`transferAssets()`** / **`safeTransfer()`** | Smart contracts, services files, test scripts | Core smart contract methods, internal Javascript classes, and library functions (`SafeERC20`) mapping blockchain transactions. |
| **`transaction hash`** / **`txHash`** | Database schema, JSDoc schemas, wallet models | Standard EVM/blockchain data structures for on-chain identity tracking. |
| **`transaction receipts`** / **`getTransactionReceipt`** | Ethers.js helper scripts, indexer loops | Standard Web3 provider RPC methods fetching cryptographic status. |
| **"Pay Merchant"** / **"Pay Bill"** / **"Payment Request"** | Front-end templates, checkout pages (`pay.html`) | Allowed retail payment workflows representing customer-facing invoices. |
| **`btn-swap-success-receipt`** / **`send-recent-transfers-list`** | HTML element IDs | Preserved to prevent breaking Javascript DOM binding hooks and event listener triggers. |

---

## 4. Quality Assurance

A complete regression suite was executed following the refactoring:
- Run: `npm run test` inside `backend/`
- **Result:** 100% of the 200/200 integration, controller, and unit tests passed successfully.
- **Verification:** Confirming that all API routes (`/api/v1/settlements`), database transactions, compliance checks, and lock primitives remain fully functional and error-free.
