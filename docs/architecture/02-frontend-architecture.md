# Frontend Architecture

> **Stack:** Vanilla HTML5 · Vanilla CSS · Vanilla JavaScript (ES Modules via CDN) · Wagmi/Viem · ethers.js

---

## Overview

The KorriPay frontend is a **multi-page application (MPA)** served as static files by the Express backend. Navigation is handled through URL hash routing (`#send`, `#history`, `#portfolio`) and direct HTML file links for distinct pages such as `/trust.html`, `/developers.html`, and `/admin.html`.

---

## Page Structure

```mermaid
graph LR
    A["index.html\n(Login / Wallet Connect)"]
    B["dashboard.html\n(Main App — All Tabs)"]
    C["trust.html\n(Trust Layer Explorer)"]
    D["treasury.html\n(Treasury Analytics)"]
    E["developers.html\n(Developer Portal)"]
    F["organization.html\n(Corporate Org Management)"]
    G["admin.html\n(Admin Control Panel)"]

    A -->|Auth Success| B
    B --> C
    B --> D
    B --> E
    B --> F
    B --> G
```

### Page Inventory

| File | Route | Purpose |
|---|---|---|
| `index.html` | `/` | Login, wallet signature authentication |
| `dashboard.html` | `/dashboard.html` | Main dashboard with hash-routed tabs |
| `trust.html` | `/trust` | GIWA Trust Layer provider explorer |
| `treasury.html` | `/treasury` | Treasury analytics, reserves, allocation |
| `developers.html` | `/developers` | API docs, SDK playground, webhook tester |
| `organization.html` | `/organization` | Corporate org RBAC management |
| `admin.html` | `/admin` | User management, KYC review, audit logs |
| `showcase.html` | `/showcase` | Interactive platform demo deck |
| `pay.html` | `/pay` | Standalone bill payment page |

---

## JavaScript Architecture

```mermaid
graph TD
    subgraph Core["Core Modules"]
        APP["app.js\n(Main — 270KB)\nRouting · State · API Calls\nUI Rendering · Chart Drawing"]
        WS["walletService.js\nWagmi createConfig\nMetaMask · Coinbase Wallet\nEIP-712 Signing"]
        TS["tokenService.js\nToken Address Registry\nChain ID → Contract Addresses"]
        WH["walletHooks.js\nBalance Fetching\nTransaction Watching"]
    end

    subgraph Infra["Infrastructure"]
        GI["src/infrastructure/giwa/\nGiwaFrontendInfrastructure\nNetworkRegistry instance"]
    end

    subgraph Data["Data Layer (via authFetch)"]
        AF["authFetch()\nHardened HTTP wrapper:\n• Retry with backoff\n• Offline detection\n• 401 redirect"]
    end

    APP --> WS
    APP --> TS
    APP --> WH
    APP --> GI
    APP --> AF
    WS --> GI
    TS --> GI
```

---

## `app.js` — Internal Organisation

`app.js` is the monolithic application file (~270KB). Its internal sections:

| Section | Responsibility |
|---|---|
| Constants & Config | API base URL, retry config, top-loader bar setup |
| `authFetch()` | Hardened fetch wrapper with exponential-backoff retry and offline state checks |
| Route Handler | Hash-change listener → renders the correct view |
| Dashboard Tab | Balance display, quick actions, recent transactions |
| Send Tab | 3-step wizard (Recipient → Amount → Review) |
| Swap Tab | FX engine UI, rate countdown timer, submission |
| History Tab | Filterable paginated transaction list |
| Portfolio Tab | Asset allocation donut chart (Chart.js), valuations |
| Compliance Tab | Risk profile display, KYC status |
| Explorer Tab | Settlement list with GIWA proof modals |
| Settings / Profile | User profile management |
| Modal Manager | `openModal()` / `closeAllModals()` with focus-trapping for accessibility |

---

## Wallet Integration

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant walletService
    participant MetaMask
    participant Backend

    User->>Frontend: Click "Connect Wallet"
    Frontend->>walletService: connect()
    walletService->>MetaMask: eth_requestAccounts
    MetaMask-->>walletService: address
    Frontend->>Backend: GET /api/auth/nonce
    Backend-->>Frontend: { nonce: "..." }
    Frontend->>walletService: signTypedData (EIP-712)
    walletService->>MetaMask: eth_signTypedData_v4
    MetaMask-->>walletService: signature
    Frontend->>Backend: POST /api/auth/verify { address, signature }
    Backend-->>Frontend: { token, user }
    Frontend->>Frontend: Store token, redirect to /dashboard.html
```

### Supported Connectors

| Connector | Library | Status |
|---|---|---|
| MetaMask | Wagmi injected connector | ✅ Active |
| Coinbase Wallet | Wagmi coinbaseWallet connector | ✅ Active |
| WalletConnect | Wagmi walletConnect connector | 🔄 Planned |

---

## `authFetch()` — Resilience Pattern

```javascript
// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

// Features:
// 1. Detects navigator.onLine before each request
// 2. Retries on network errors / 5xx with exponential backoff
// 3. Redirects to / on 401 Unauthorized
// 4. Drives the global top-loading progress bar
```

---

## GIWA Frontend Infrastructure

`frontend/src/infrastructure/giwa/` mirrors the backend infrastructure module:

```
GiwaFrontendInfrastructure
    ├── getRPC()         → GIWA_RPC_URL env
    ├── getExplorer()    → Block explorer base URL
    ├── getChainId()     → 92837
    └── getChainMetadata() → name, symbol, chainId, hardfork
```

The singleton `giwa` instance is imported by `walletService.js` and `tokenService.js` to ensure all network references resolve dynamically from environment config.

---

## Accessibility & Performance

| Feature | Implementation |
|---|---|
| Focus trapping | Modal open/close captures and restores keyboard focus |
| ARIA labels | Buttons and interactive elements carry `aria-label` attributes |
| Keyboard navigation | Tab-order managed for all modal dialogs |
| Offline banner | Displayed when `navigator.onLine === false` |
| Top loading bar | CSS-animated progress indicator driven by `authFetch` |
| Async ZK tasks | ZK-SNARK simulation offloaded via `setTimeout(0)` to avoid main-thread blocking |
