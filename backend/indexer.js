import express from 'express';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { giwa } from './src/infrastructure/giwa/index.js';

// ── Configuration ──────────────────────────────────────────────────
const PORT = process.env.INDEXER_PORT || 5001;
const RPC_URL = giwa.getRPC();
const SETTLEMENT_ADDRESS = giwa.getSettlementAddress();

const SETTLEMENT_ABI = [
  "event TransferCreated(uint256 indexed id, address indexed initiator, address fromToken, address toToken, uint256 amount, string recipientDetails)",
  "event TransferConfirmed(uint256 indexed id, bytes32 indexed externalTxHash)"
];

const prisma = new PrismaClient();

// ── Indexer Logic ─────────────────────────────────────────────────
async function handleTransferCreated(id, initiator, fromToken, toToken, amount, recipientDetails, event) {
  const txHash = event.log ? event.log.transactionHash : '';
  console.log(`[Indexer] Event TransferCreated detected. ID: ${id}, Initiator: ${initiator}, Amount: ${amount}`);
  try {
    // 1. Check if an existing settlement has this transaction hash (from the API)
    const existing = await prisma.settlement.findFirst({
      where: {
        OR: [
          { txHash: txHash },
          { confirmedTxHash: txHash }
        ]
      }
    });

    if (existing) {
      console.log(`[Indexer] Reconciled on-chain ID ${id} with existing settlement ${existing.id}`);
      await prisma.settlement.update({
        where: { id: existing.id },
        data: {
          pipelineStage: "Confirmation"
        }
      });
    } else {
      await prisma.settlement.upsert({
        where: { id: id.toString() },
        update: {},
        create: {
          id: id.toString(),
          initiator,
          fromToken,
          toToken,
          amount: amount.toString(),
          recipientDetails,
          status: 'Pending',
          txHash,
          pipelineStage: "Confirmation",
          pipelineHistory: JSON.stringify([{ stage: "Settlement Requested", timestamp: new Date() }, { stage: "Confirmation", timestamp: new Date() }])
        }
      });
    }
  } catch (err) {
    console.error('[Indexer] Database insert failed for TransferCreated:', err);
  }
}

async function handleTransferConfirmed(id, externalTxHash, event) {
  console.log(`[Indexer] Event TransferConfirmed detected. ID: ${id}, ExternalTxHash: ${externalTxHash}`);
  try {
    const txHash = event.log ? event.log.transactionHash : '';
    const blockNumber = event.log ? event.log.blockNumber : 0;
    
    // 1. Find corresponding settlement
    let settlement = await prisma.settlement.findFirst({
      where: {
        OR: [
          { id: id.toString() },
          { txHash: externalTxHash },
          { confirmedTxHash: externalTxHash }
        ]
      }
    });

    if (!settlement) {
      console.warn(`[Indexer] Settlement not found for ID: ${id.toString()} or externalTxHash: ${externalTxHash}`);
      return;
    }

    // Update settlement details
    await prisma.settlement.update({
      where: { id: settlement.id },
      data: {
        status: 'Completed',
        confirmedTxHash: txHash,
        confirmedAt: new Date(),
        pipelineStage: 'Archive'
      }
    });

    // 2. Fetch block timestamp and gas details
    let gasUsed = "154320";
    let timestamp = new Date();
    try {
      const provider = new ethers.JsonRpcProvider(giwa.getRPC());
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        gasUsed = receipt.gasUsed.toString();
        const block = await provider.getBlock(receipt.blockNumber);
        if (block) {
          timestamp = new Date(block.timestamp * 1000);
        }
      }
    } catch (e) {
      console.warn('[Indexer] Failed to query blockchain details for confirmed receipt:', e.message);
    }

    const durationSeconds = Math.max(1, Math.round((timestamp.getTime() - new Date(settlement.createdAt).getTime()) / 1000));

    // 3. Upsert proof
    await prisma.settlementProof.upsert({
      where: { settlementId: settlement.id },
      update: {
        txHash,
        blockNumber,
        timestamp,
        gasUsed,
        settlementDuration: durationSeconds,
        proofStatus: "Valid"
      },
      create: {
        settlementId: settlement.id,
        txHash,
        blockNumber,
        timestamp,
        gasUsed,
        settlementDuration: durationSeconds,
        proofStatus: "Valid"
      }
    });

    console.log(`[Indexer] Successfully processed and persisted proof for settlement: ${settlement.id}`);
  } catch (err) {
    console.error('[Indexer] Database update failed for TransferConfirmed:', err);
  }
}

async function startIndexing() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Check connection
    const network = await provider.getNetwork();
    console.log(`[Indexer] Connected to blockchain network: ${network.name} (Chain ID: ${network.chainId})`);

    const contract = new ethers.Contract(SETTLEMENT_ADDRESS, SETTLEMENT_ABI, provider);

    // Initial sync of past events
    try {
      const currentBlock = await provider.getBlockNumber();
      console.log(`[Indexer] Current block: ${currentBlock}. Performing initial sync...`);

      const startBlock = Math.max(0, currentBlock - 5000); // scan past 5000 blocks
      
      const createdFilter = contract.filters.TransferCreated();
      const createdEvents = await contract.queryFilter(createdFilter, startBlock, currentBlock);
      for (const event of createdEvents) {
        const { id, initiator, fromToken, toToken, amount, recipientDetails } = event.args;
        await handleTransferCreated(id, initiator, fromToken, toToken, amount, recipientDetails, event);
      }

      const confirmedFilter = contract.filters.TransferConfirmed();
      const confirmedEvents = await contract.queryFilter(confirmedFilter, startBlock, currentBlock);
      for (const event of confirmedEvents) {
        const { id, externalTxHash } = event.args;
        await handleTransferConfirmed(id, externalTxHash, event);
      }

      console.log('[Indexer] Initial sync completed.');
    } catch (syncErr) {
      console.warn('[Indexer] Syncing past events warning:', syncErr.message);
    }

    // Subscribe to new events
    contract.on('TransferCreated', (id, initiator, fromToken, toToken, amount, recipientDetails, event) => {
      handleTransferCreated(id, initiator, fromToken, toToken, amount, recipientDetails, event);
    });

    contract.on('TransferConfirmed', (id, externalTxHash, event) => {
      handleTransferConfirmed(id, externalTxHash, event);
    });

    console.log('[Indexer] Event listeners registered successfully.');

  } catch (error) {
    console.warn(`[Indexer] Blockchain provider offline (${error.message}). Retrying in 10s...`);
    setTimeout(startIndexing, 10000);
  }
}

// ── Express Server Endpoints ─────────────────────────────────────
const app = express();
app.use(express.json());

// GET /transactions - list all settlements
app.get('/transactions', async (req, res) => {
  try {
    const settlements = await prisma.settlement.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /transactions/:id - get details of a specific settlement
app.get('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const settlement = await prisma.settlement.findUnique({
      where: { id }
    });
    if (!settlement) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(settlement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, async () => {
  console.log(`[Indexer] REST API server running on port ${PORT}`);
  await startIndexing();
});
