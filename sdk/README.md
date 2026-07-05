# KorriPay JavaScript SDK

The official JavaScript/TypeScript SDK for interacting with the KorriPay L2 payment and compliance platform APIs. This SDK makes it simple to integrate cross-border settlements, wallet queries, automated compliance screenings, identity attestations, and cryptographic proofs into your client or server applications.

## Installation

Install the package via npm, yarn, or pnpm:

```bash
npm install @korripay/sdk
```

---

## Quick Start

### 1. Initialize the Client

Initialize the client with your platform configuration. You can specify a custom `baseUrl` (defaults to `http://localhost:5000/api/v1`) and a session token.

```javascript
import { KorriPayClient } from '@korripay/sdk';

const client = new KorriPayClient({
  baseUrl: 'http://localhost:5000/api/v1',
  token: 'your_session_token_here'
});
```

---

## Core Functions

### `getWallet()`
Retrieves the user's multi-currency and crypto wallet details, including Available, Locked, and Pending balances for USD, KRW, NGN, and MockKRW.

```javascript
try {
  const wallet = await client.getWallet();
  console.log('USD Available Balance:', wallet.balances.USD.available);
  console.log('BTC Balance:', wallet.crypto.BTC);
} catch (error) {
  console.error('Failed to retrieve wallet:', error);
}
```

### `createSettlement(params)`
Initiates a new cross-border L2 settlement transfer. The platform screens the transaction automatically for compliance, runs velocity/rule checks, and creates the settlement order.

```javascript
try {
  const result = await client.createSettlement({
    recipient: 'Elena Gilbert',
    amount: 150.00,
    recipientAddress: '0x4a2ae92f883920108e7ef9e8b625cf016dfec1562',
    status: 'Success'
  });
  console.log('Settlement Initiated! ID:', result.settlementId);
} catch (error) {
  if (error.name === 'KorriPayAPIError') {
    console.error('API Error details:', error.details);
  } else {
    console.error(error.message);
  }
}
```

### `getSettlement(id)`
Retrieves a single settlement details using the Settlement ID or Ethereum transaction hash.

```javascript
try {
  const settlement = await client.getSettlement('settlement-12345');
  console.log('Settlement Status:', settlement.status);
} catch (error) {
  console.error('Error fetching settlement:', error);
}
```

### `getProof(settlementId)`
Fetches the cryptographic/L2 rollup proof confirming the settlement. Returns `null` if the proof is not yet generated.

```javascript
try {
  const proof = await client.getProof('settlement-12345');
  if (proof) {
    console.log('Block Number:', proof.blockNumber);
    console.log('Gas Used:', proof.gasUsed);
    console.log('Proof Status:', proof.status);
  } else {
    console.log('Proof pending generation...');
  }
} catch (error) {
  console.error('Error fetching proof:', error);
}
```

### `verifyIdentity(params)`
Submits identity verification updates to update the KYC status on the database.

```javascript
try {
  const result = await client.verifyIdentity({
    status: 'Verified'
  });
  console.log('KYC Verification status updated to:', result.kyc.status);
} catch (error) {
  console.error('Identity verification submission failed:', error);
}
```

---

## Error Handling

The SDK exposes custom error classes for clean classification:

* **`KorriPayValidationError`**: Raised when local client-side validation fails (e.g., missing fields, negative amount values).
* **`KorriPayAuthenticationError`**: Raised when the API returns an unauthorized state (status 401).
* **`KorriPayAPIError`**: Raised when the server responds with a non-2xx code. Exposes `statusCode` and the JSON `details` returned by the API.

```javascript
import { 
  KorriPayValidationError, 
  KorriPayAuthenticationError, 
  KorriPayAPIError 
} from '@korripay/sdk';

try {
  await client.createSettlement({ recipient: '', amount: -50 });
} catch (error) {
  if (error instanceof KorriPayValidationError) {
    console.error('Local Validation Failed:', error.message);
  } else if (error instanceof KorriPayAuthenticationError) {
    console.error('Please log in again.');
  } else if (error instanceof KorriPayAPIError) {
    console.error(`API Error ${error.statusCode}:`, error.message);
  }
}
```

## License

MIT License.
