# KorriPay API Reference — Wallets

> **Base URL:** `http://localhost:5000/api/v1`  
> **Auth:** All endpoints require a valid session. See [Authentication](01-authentication.md).

---

## Overview

The Wallets API exposes the multi-currency **Available / Locked / Pending** balance ledger for each user. Balances are updated atomically with pessimistic row-level locking (PostgreSQL `SELECT ... FOR UPDATE`) to prevent race conditions. When the GIWA L2 RPC is reachable and the user has a registered wallet address, on-chain balances (MockKRW, USDC) are refreshed on every wallet read.

---

## Balance States

| State | Description |
|---|---|
| `available` | Spendable balance. Decremented on settlement initiation. |
| `locked` | Reserved for in-flight settlements. Released on completion or failure. |
| `pending` | Funds received from counterparty, awaiting confirmation. |

---

## Endpoints

### `GET /api/v1/wallets`

Retrieve the full multi-currency wallet for the authenticated user. Creates the wallet with default balances on first access.

**Response `200`**

```json
{
  "success": true,
  "wallet": {
    "id": "wallet-uuid-1234",
    "savings": 45.00,
    "balances": {
      "USD":     { "available": 1250.00, "locked": 0.00, "pending": 0.00 },
      "KRW":     { "available": 0.00,    "locked": 0.00, "pending": 0.00 },
      "NGN":     { "available": 0.00,    "locked": 0.00, "pending": 0.00 },
      "MockKRW": { "available": 500000.00, "locked": 0.00, "pending": 0.00 }
    },
    "crypto": {
      "BTC":  14.82,
      "ETH":  2.45,
      "USDC": 2450.00
    }
  }
}
```

---

### `POST /api/wallet/credit`

Credit a currency balance to the authenticated user's wallet.

**Request Body**

```json
{
  "currency": "USD",
  "amount": 500.00,
  "balanceType": "available",
  "description": "Customer deposit"
}
```

| Field | Type | Required | Valid Values |
|---|---|---|---|
| `currency` | `string` | ✅ | `USD`, `KRW`, `MockKRW`, `NGN` |
| `amount` | `number` | ✅ | Must be > 0 |
| `balanceType` | `string` | ✅ | `available`, `locked`, `pending` |
| `description` | `string` | ✅ | Human-readable ledger entry description |

**Response `200`**

```json
{
  "success": true,
  "message": "500 USD credited to available balance",
  "wallet": { "id": "...", "balances": { "USD": { "available": 1750.00 } } },
  "ledgerEntry": {
    "id": "ledger-uuid-5678",
    "currency": "USD",
    "balanceType": "available",
    "amount": 500.00,
    "runningBalance": 1750.00,
    "entryType": "credit",
    "description": "Customer deposit",
    "createdAt": "2026-07-07T00:00:01.000Z"
  }
}
```

---

### `POST /api/wallet/debit`

Debit a currency balance from the authenticated user's wallet.

**Request Body**

```json
{
  "currency": "USD",
  "amount": 100.00,
  "balanceType": "available",
  "description": "Settlement payout"
}
```

**Error `400` — Insufficient Funds**

```json
{ "error": "Insufficient USD available balance. Required: 100, Available: 45.00" }
```

---

### `POST /api/wallet/lock`

Move funds from `available` to `locked` for a pending settlement.

**Request Body**

```json
{
  "currency": "USD",
  "amount": 300.00
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "300 USD locked",
  "wallet": { "balances": { "USD": { "available": 950.00, "locked": 300.00 } } }
}
```

---

### `POST /api/wallet/unlock`

Move funds from `locked` back to `available` (e.g., on settlement failure or refund).

**Request Body**

```json
{
  "currency": "USD",
  "amount": 300.00
}
```

---

### `GET /api/wallet/ledger`

Retrieve the double-entry ledger history for the authenticated user's wallet.

**Query Parameters**

| Parameter | Type | Description |
|---|---|---|
| `currency` | `string` | Filter by currency (USD, KRW, etc.) |
| `limit` | `number` | Max entries to return. Default: 50 |
| `offset` | `number` | Pagination offset |

**Response `200`**

```json
{
  "success": true,
  "ledger": [
    {
      "id": "ledger-uuid-1234",
      "currency": "USD",
      "balanceType": "available",
      "amount": 500.00,
      "runningBalance": 1750.00,
      "entryType": "credit",
      "description": "Customer deposit",
      "txHash": null,
      "referenceId": null,
      "createdAt": "2026-07-07T00:00:01.000Z"
    }
  ],
  "total": 42
}
```

---

### `GET /api/wallet/summary`

Get a combined balance summary across all currencies.

**Response `200`**

```json
{
  "success": true,
  "summary": {
    "totalUSDEquivalent": 1295.82,
    "breakdown": {
      "USD":     { "available": 1250.00, "locked": 0, "pending": 0 },
      "KRW":     { "available": 0, "locked": 0, "pending": 0 },
      "NGN":     { "available": 0, "locked": 0, "pending": 0 },
      "MockKRW": { "available": 500000.00, "locked": 0, "pending": 0 }
    },
    "crypto": { "BTC": 14.82, "ETH": 2.45, "USDC": 2450.00 }
  }
}
```

---

## Code Examples

### TypeScript — Get Wallet Balance

```typescript
import { KorriPayClient } from '@korripay/sdk';

const client = new KorriPayClient({ baseUrl: 'http://localhost:5000/api/v1', token });

const { wallet } = await client.getWallet();

console.log('USD available:', wallet.balances.USD.available);
console.log('MockKRW available:', wallet.balances.MockKRW.available);
console.log('ETH balance:', wallet.crypto.ETH);
```

### TypeScript — Check Before Settlement

```typescript
async function canSend(client: KorriPayClient, amountUSD: number): Promise<boolean> {
  const { wallet } = await client.getWallet();
  const available = wallet.balances.USD.available;
  
  if (available < amountUSD) {
    console.error(`Insufficient funds. Available: $${available}, Required: $${amountUSD}`);
    return false;
  }
  return true;
}

if (await canSend(client, 500)) {
  const result = await client.createSettlement({ recipient: 'Bob', amount: 500 });
}
```

### JavaScript — Credit Wallet

```javascript
const res = await fetch('http://localhost:5000/api/wallet/credit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    currency: 'USD',
    amount: 1000.00,
    balanceType: 'available',
    description: 'Test deposit'
  })
});

const { wallet, ledgerEntry } = await res.json();
console.log('New USD available:', wallet.balances.USD.available);
console.log('Ledger entry ID:', ledgerEntry.id);
```

### JavaScript — Ledger History

```javascript
const res = await fetch(
  'http://localhost:5000/api/wallet/ledger?currency=USD&limit=10',
  { headers: { 'Authorization': `Bearer ${token}` } }
);
const { ledger, total } = await res.json();

ledger.forEach(entry => {
  const sign = entry.entryType === 'credit' ? '+' : '-';
  console.log(`${entry.createdAt} ${sign}${entry.amount} ${entry.currency} → Balance: ${entry.runningBalance}`);
});
```
