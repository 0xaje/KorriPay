# KorriPay 💳

> **Institutional-grade fintech dashboard** — multi-asset management, real-time swaps, KYC verification, and seamless money transfers. Built with a modern design system and a lightweight Express backend.

![KorriPay Dashboard](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square) ![Node](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38bdf8?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🏠 **Dashboard** | Live balance overview, quick actions, recent transactions |
| 💸 **Send Money** | 3-step wizard — recipient selection, amount entry, review & confirm |
| 🔄 **Asset Swap** | Institutional exchange engine — BTC, ETH, USDC, USD with live rate countdown |
| 🎉 **Swap Success** | Celebratory confetti animation with full transaction receipt |
| 📊 **Portfolio** | Multi-asset breakdown with donut allocation chart and real-time valuations |
| 🧾 **Transaction History** | Filterable activity feed with type, status, and category |
| 🪪 **KYC Verification** | 6-step identity flow with liveness check and camera capture |
| 🌙 **Dark Mode** | System-aware theme toggle across all views |
| 📱 **Responsive** | Mobile-first layout with bottom nav + desktop sidebar |

---

## 🗂️ Project Structure

```
KorriPay/
├── backend/
│   ├── server.js          # Express REST API
│   └── package.json
├── frontend/
│   ├── index.html         # Login / landing page
│   ├── dashboard.html     # Main app (all tabs)
│   ├── app.js             # All interactivity & state management
│   └── styles.css         # Custom CSS
└── package.json           # Root runner scripts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **npm** v9+

### Installation

```bash
# Clone the repo
git clone https://github.com/0xaje/KorriPay.git
cd KorriPay

# Install backend dependencies
npm install --prefix backend
```

### Running Locally

```bash
# Start the backend server (serves frontend too)
npm start
```

Then open **http://localhost:5000** in your browser.

> The backend serves the `frontend/` folder as static files, so no separate frontend server is needed.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Fetch balances and recent transactions |
| `GET` | `/api/transactions` | Full transaction history |
| `POST` | `/api/transactions/send` | Send money to a recipient |
| `POST` | `/api/transactions/add` | Add funds from a source |
| `POST` | `/api/transactions/swap` | Swap between BTC / ETH / USDC / USD |
| `POST` | `/api/transactions/pay` | Pay a bill |

---

## 💱 Supported Assets

| Asset | Symbol | Network |
|---|---|---|
| Bitcoin | BTC | Bitcoin Network |
| Ethereum | ETH | Polygon Network |
| USD Coin | USDC | Polygon Network |
| US Dollar | USD | Standard Settlement |

---

## 🛠️ Tech Stack

- **Frontend** — HTML5, Vanilla JS, TailwindCSS (CDN), Google Fonts (Inter), Material Symbols
- **Backend** — Node.js, Express.js
- **State** — In-memory (backend) + `localStorage` fallback (offline mode)
- **Auth** — Session-based (mock for demo)

---

## 📸 App Views

| View | Route |
|---|---|
| Login | `/index.html` |
| Dashboard | `/dashboard.html` |
| Send Money | `#send` |
| Swap Assets | `#swap` |
| Swap Success | `#swap-success` |
| Portfolio | `#portfolio` |
| Transaction History | `#history` |
| Profile | `#profile` |

---

## 📄 License

MIT © [0xaje](https://github.com/0xaje)
