import { KorriPayClient } from '../src/index.js';
import { KorriPayAPIError, KorriPayValidationError } from '../src/index.js';

// Setup client pointing to local dev backend instance
const client = new KorriPayClient({
  baseUrl: 'http://localhost:5000/api/v1',
  token: 'session-demo-mocktoken123'
});

async function main() {
  console.log("--- STARTING KORRIPAY SDK DEMO ---");
  try {
    // 1. Fetch wallet
    console.log("Fetching wallet balances...");
    const wallet = await client.getWallet();
    console.log("USD Balance:", wallet.balances.USD.available);

    // 2. Submit Identity Update
    console.log("Submitting identity verification update...");
    const kycResult = await client.verifyIdentity({ status: 'Verified' });
    console.log("KYC status updated:", kycResult.kyc.status);

    // 3. Create a settlement
    console.log("Creating settlement...");
    const settlementRes = await client.createSettlement({
      recipient: "Marcus Vane",
      amount: 120.00,
      recipientAddress: "0x12b5a0bc7ef9e8b625cf016dfec1562b77aa99fe",
      status: "Success"
    });
    console.log("Settlement request created. ID:", settlementRes.settlementId);

    // 4. Retrieve single settlement
    console.log("Retrieving settlement details...");
    const settlement = await client.getSettlement(settlementRes.settlementId);
    console.log("Settlement Status:", settlement.status);

    // 5. Get settlement proof
    console.log("Querying L2 confirmation proof...");
    const proof = await client.getProof(settlementRes.settlementId);
    if (proof) {
      console.log("Proof verified valid! Block:", proof.blockNumber);
    } else {
      console.log("Proof still pending confirmation on L2 chain...");
    }

  } catch (error: any) {
    if (error instanceof KorriPayValidationError) {
      console.error("Local Validation Error:", error.message);
    } else if (error instanceof KorriPayAPIError) {
      console.error(`API Error (Status ${error.statusCode}):`, error.message);
    } else {
      console.error("Unknown Error:", error);
    }
  }
}

main();
