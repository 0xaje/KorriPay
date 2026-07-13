# KorriPay API Reference — Authentication

> **Base URL:** `http://localhost:5000`  
> **Version:** v1 · **Auth Scheme:** Session Cookie (`session`) or Bearer Token  
> **Interactive Docs:** [`/api-docs`](http://localhost:5000/api-docs) (Swagger UI)

---

## Overview

KorriPay supports two authentication methods:

| Method | Header / Cookie | Used By |
|---|---|---|
| **Session Cookie** | `Cookie: session=<token>` | Browser frontend (auto-managed) |
| **Bearer Token** | `Authorization: Bearer <token>` | SDK, API clients, programmatic access |

All protected endpoints require a valid session. Requests without a valid session receive `401 Unauthorized`.

---

## Endpoints

### `POST /api/auth/signup`

Register a new user account.

**Request Body**

```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "password": "SecurePass123!"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | ✅ | Non-empty |
| `email` | `string` | ✅ | Valid email, unique |
| `password` | `string` | ✅ | Minimum 6 characters |

**Response `201`**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "id": "3f2e1d4c-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "role": "USER"
  }
}
```

**Error Responses**

| Status | `error` | Cause |
|---|---|---|
| `400` | `"Name, email, and password are required"` | Missing fields |
| `400` | `"Email already registered"` | Duplicate email |
| `500` | `"Internal Server Error"` | Unexpected failure |

---

### `POST /api/auth/signin`

Authenticate with email and password.

**Request Body**

```json
{
  "email": "alice@example.com",
  "password": "SecurePass123!"
}
```

**Response `200`**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "id": "3f2e1d4c-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "role": "USER",
    "walletAddress": "0x4a2ae92f883920108e7ef9e8b625cf016dfec156"
  }
}
```

**Error Responses**

| Status | `error` | Cause |
|---|---|---|
| `400` | `"Email and password are required"` | Missing fields |
| `401` | `"Invalid email or password"` | Wrong credentials |

---

### `POST /api/auth/demo`

Authenticate or create a demo user account.

**Request Body**

```json
{
  "email": "demo@korripay.io"
}
```

**Response `200`**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": { "id": "...", "name": "Demo User", "email": "demo@korripay.io", "role": "USER" }
}
```

---

### `GET /api/auth/nonce`

Get a one-time nonce for EIP-712 wallet signature authentication.

**Response `200`**

```json
{
  "nonce": "KorriPay authentication nonce: 8f3d2a1b9c4e5f6d"
}
```

---

### `POST /api/auth/verify`

Verify an EIP-712 wallet signature and issue a session token.

**Request Body**

```json
{
  "address": "0x4a2ae92f883920108e7ef9e8b625cf016dfec156",
  "signature": "0xabcdef1234567890..."
}
```

**Response `200`**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": { "id": "...", "walletAddress": "0x4a2ae..." }
}
```

**Error Responses**

| Status | `error` | Cause |
|---|---|---|
| `400` | `"Invalid signature"` | Signature does not match address |
| `400` | `"Nonce not found or expired"` | Nonce was not generated or expired |

---

## Code Examples

### TypeScript — Sign In

```typescript
const response = await fetch('http://localhost:5000/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'alice@example.com',
    password: 'SecurePass123!'
  })
});

const { token, user } = await response.json();
console.log('Authenticated as:', user.name);
console.log('Token:', token);
```

### JavaScript — Wallet Authentication

```javascript
// 1. Request nonce
const nonceRes = await fetch('/api/auth/nonce');
const { nonce } = await nonceRes.json();

// 2. Sign with MetaMask (EIP-712)
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [nonce, userWalletAddress]
});

// 3. Verify and get token
const verifyRes = await fetch('/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: userWalletAddress, signature })
});

const { token } = await verifyRes.json();
```

### Using the SDK

```typescript
import { KorriPayClient } from '@korripay/sdk';

// After signin, pass the token to the client
const client = new KorriPayClient({
  baseUrl: 'http://localhost:5000/api/v1',
  token: 'eyJhbGciOiJIUzI1NiIsInR5...'
});
```
