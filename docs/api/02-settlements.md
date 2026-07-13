# KorriPay API Reference — Settlements

> **Base URL:** `http://localhost:5000/api/v1`  
> **Auth:** All endpoints require a valid session. See [Authentication](01-authentication.md).

---

## Overview

The Settlements API manages the full lifecycle of cross-border L2 settlements. When a settlement is created, it immediately enters a **7-stage asynchronous pipeline** (Compliance → Route → Execute → Confirm → Proof → Archive). The API responds with the settlement record as soon as the pipeline is initiated — pipeline progress can be monitored via the `pipelineStage` field or webhook events.

---

## Endpoints

### `POST /api/v1/settlements`

Create a new L2 settlement request. Runs compliance screening and balance validation synchronously before initiating the async pipeline.

**Request Headers**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**

```json
{
  "recipient": "Elena Gilbert",
  "amount": 500.00,
  "recipientAddress": "0x4a2ae92f883920108e7ef9e8b625cf016dfec156",
  "txHash": "0xoptional_existing_tx_hash",
  "status": "Pending"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `recipient` | `string` | ✅ | Display name of the recipient |
| `amount` | `number` | ✅ | Settlement amount in USD. Must be > 0. |
| `recipientAddress` | `string` | — | Recipient EVM wallet address on GIWA L2 |
| `txHash` | `string` | — | Optional pre-existing L2 transaction hash |
| `status` | `string` | — | Initial status hint. Default: `"Pending"` |

**Response `201`**

```json
{
  "success": true,
  "settlementId": "settlement-1783375863424-abc123",
  "transaction": {
    "id": "tx-1783375863424",
    "title": "Sending to Elena Gilbert",
    "type": "send",
    "amount": 500.00,
    "date": "Jul 7, 2026",
    "timestamp": 1783375863424,
    "category": "Transfer",
    "status": "Pending"
  },
  "settlement": {
    "id": "settlement-1783375863424-abc123",
    "initiator": "0x4a2ae92f883920108e7ef9e8b625cf016dfec156",
    "fromToken": "0x0000000000000000000000000000000000000000",
    "toToken": "0x4a2ae92f883920108e7ef9e8b625cf016dfec156",
    "amount": "500",
    "recipientDetails": "v1: Recipient: Elena Gilbert (0x4a2ae...)",
    "status": "Pending",
    "pipelineStage": "Settlement Requested",
    "pipelineHistory": "[]",
    "createdAt": "2026-07-07T00:00:01.000Z"
  },
  "screening": {
    "result": "Allowed",
    "riskScore": 12,
    "riskLevel": "Low",
    "rulesTriggered": []
  }
}
```

**Error Responses**

| Status | `error` | Cause |
|---|---|---|
| `400` | `"Recipient name is required"` | Empty recipient |
| `400` | `"Invalid amount. Must be greater than 0."` | Non-positive amount |
| `400` | `"Insufficient USD balance"` | Wallet balance check failed |
| `400` | `"Transaction blocked by compliance"` | Compliance screening returned Blocked |
| `500` | `"Internal Server Error"` | Unexpected failure |

**Compliance-Blocked Response `400`**

```json
{
  "error": "Transaction blocked by compliance screening",
  "complianceBlocked": true,
  "screening": {
    "result": "Blocked",
    "riskScore": 85,
    "riskLevel": "High",
    "rulesTriggered": ["DAILY_LIMIT", "VELOCITY_CHECK"]
  }
}
```

---

### `GET /api/v1/settlements`

List settlement requests for the authenticated user. Admins and Compliance officers receive all platform settlements.

**Query Parameters**

_None_

**Response `200`**

```json
{
  "success": true,
  "settlements": [
    {
      "id": "settlement-1783375863424-abc123",
      "initiator": "0x4a2ae...",
      "fromToken": "0x0000...",
      "toToken": "0x4a2ae...",
      "amount": "500",
      "recipientDetails": "v1: Recipient: Elena Gilbert",
      "status": "Completed",
      "txHash": "0xdeadbeef...",
      "confirmedTxHash": "0xdeadbeef...",
      "pipelineStage": "Archive",
      "pipelineHistory": "[...]",
      "createdAt": "2026-07-07T00:00:01.000Z",
      "confirmedAt": "2026-07-07T00:00:06.000Z"
    }
  ]
}
```

---

### `GET /api/v1/settlements/:id`

Fetch a single settlement by ID or transaction hash.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | Settlement ID **or** `txHash` **or** `confirmedTxHash` |

**Response `200`**

```json
{
  "success": true,
  "settlement": { "id": "...", "status": "Completed", "confirmedTxHash": "0x...", ... }
}
```

**Error `404`**

```json
{ "error": "Settlement not found" }
```

---

### `GET /api/v1/proofs`

List cryptographic ZK proof records for settlements.

**Query Parameters**

| Parameter | Type | Description |
|---|---|---|
| `settlementId` | `string` | Filter by settlement ID |

**Response `200`**

```json
{
  "success": true,
  "proofs": [
    {
      "id": "proof-uuid-1234",
      "settlementId": "settlement-1783375863424-abc123",
      "txHash": "0xdeadbeef...",
      "blockNumber": 2450812,
      "timestamp": "2026-07-07T00:00:05.000Z",
      "gasUsed": "142,500",
      "settlementDuration": 4200,
      "proofStatus": "Valid"
    }
  ]
}
```

| `proofStatus` | Meaning |
|---|---|
| `"Valid"` | Proof generated and verified |
| `"Pending"` | Proof generation in progress |
| `"Invalid"` | Proof verification failed |

---

## Settlement Pipeline Stages

| Stage | Description |
|---|---|
| `Settlement Requested` | Record created in DB; pipeline starting |
| `Compliance Screening` | Compliance engine evaluating the transaction |
| `Compliance Screening Blocked` | Terminal — compliance rejected the transaction |
| `Route Selection` | Optimal L2 route being selected |
| `Execution` | On-chain transaction submitted to GIWA L2 |
| `Confirmation` | On-chain confirmation received; `confirmedTxHash` set |
| `Proof Generation` | ZK proof record being written |
| `Archive` | Settlement fully complete and archived |

---

## Code Examples

### TypeScript — Create Settlement

```typescript
import { KorriPayClient } from '@korripay/sdk';

const client = new KorriPayClient({ baseUrl: 'http://localhost:5000/api/v1', token });

const result = await client.createSettlement({
  recipient: 'Elena Gilbert',
  amount: 500.00,
  recipientAddress: '0x4a2ae92f883920108e7ef9e8b625cf016dfec156'
});

console.log('Settlement ID:', result.settlementId);
console.log('Pipeline stage:', result.settlement.pipelineStage);
```

### TypeScript — Poll for Completion

```typescript
async function waitForCompletion(client: KorriPayClient, settlementId: string) {
  const TERMINAL_STAGES = ['Archive', 'Compliance Screening Blocked'];
  const MAX_POLLS = 30;

  for (let i = 0; i < MAX_POLLS; i++) {
    const { settlement } = await client.getSettlement(settlementId);
    console.log(`[${i + 1}] Stage: ${settlement.pipelineStage}`);

    if (settlement.status === 'Completed') {
      console.log('✅ Settlement completed:', settlement.confirmedTxHash);
      return settlement;
    }
    if (settlement.status === 'Failed' || TERMINAL_STAGES.includes(settlement.pipelineStage)) {
      throw new Error(`Settlement failed at stage: ${settlement.pipelineStage}`);
    }
    await new Promise(r => setTimeout(r, 2000)); // 2s poll interval
  }
  throw new Error('Settlement polling timed out');
}

const settlement = await waitForCompletion(client, result.settlementId);
```

### JavaScript — Create and Fetch Proof

```javascript
// Create settlement
const createRes = await fetch('http://localhost:5000/api/v1/settlements', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ recipient: 'Bob', amount: 100 })
});
const { settlementId } = await createRes.json();

// Wait for pipeline to complete, then fetch proof
await new Promise(r => setTimeout(r, 8000));

const proofRes = await fetch(
  `http://localhost:5000/api/v1/proofs?settlementId=${settlementId}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
const { proofs } = await proofRes.json();
console.log('Block number:', proofs[0]?.blockNumber);
console.log('Gas used:', proofs[0]?.gasUsed);
console.log('Duration:', proofs[0]?.settlementDuration, 'ms');
```
