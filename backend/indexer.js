import express from 'express';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';

// ── Configuration ──────────────────────────────────────────────────
const PORT = process.env.INDEXER_PORT || 5001;
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const SETTLEMENT_ADDRESS = process.env.SETTLEMENT_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

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
        txHash
      }
    });
  } catch (err) {
    console.error('[Indexer] Database insert failed for TransferCreated:', err);
  }
}

async function handleTransferConfirmed(id, externalTxHash, event) {
  console.log(`[Indexer] Event TransferConfirmed detected. ID: ${id}, ExternalTxHash: ${externalTxHash}`);
  try {
    await prisma.settlement.update({
      where: { id: id.toString() },
      data: {
        status: 'Completed',
        confirmedTxHash: externalTxHash,
        confirmedAt: new Date()
      }
    });
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
