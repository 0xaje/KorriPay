import express from 'express';
import cors from 'cors';
import path from 'url';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import fxRouter from './fxController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.fileURLToPath ? path.fileURLToPath(import.meta.url) : import.meta.url.replace("file://", "");
const __dirnamePath = __dirname.substring(0, __dirname.lastIndexOf("/"));

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(__dirnamePath + '/../frontend'));

// ── FX Engine Router ──────────────────────────────────────────────────────
// Mount before requireAuth so public endpoints (/rates, /quote, /fee) work
app.use('/api/fx', (req, res, next) => {
  // Pass userId through if session exists (non-blocking)
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (token && sessions.has(token)) {
    req.userId = sessions.get(token);
  }
  next();
}, fxRouter);

// Nonce and session cache
const nonces = new Map();   // tempId -> nonce
const sessions = new Map(); // token -> userId

// Authentication Middleware
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: "Unauthorized. Session token required." });
    }

    let userId = sessions.get(token);
    if (!userId) {
      if (token.startsWith("session-demo-") || token.startsWith("session-wallet-")) {
        const firstUser = await prisma.user.findFirst();
        if (firstUser) {
          userId = firstUser.id;
          sessions.set(token, userId);
          console.log("[Auth Fallback] Restored local session and mapped to user:", userId);
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Session expired or invalid." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(401).json({ error: "Unauthorized. User not found." });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Seed Database / Retrieve default user & wallet
let defaultUser = null;
let defaultWallet = null;

async function initDatabase() {
  try {
    // 1. Ensure default user exists
    defaultUser = await prisma.user.findFirst();
    if (!defaultUser) {
      defaultUser = await prisma.user.create({
        data: {
          name: "Jane Doe",
          email: "jane.doe@korri.pay"
        }
      });
      console.log("[Server DB] Default user created:", defaultUser.id);
    } else {
      console.log("[Server DB] Existing user found:", defaultUser.id);
    }

    // 2. Ensure default wallet exists
    defaultWallet = await prisma.wallet.findFirst({
      where: { userId: defaultUser.id }
    });
    if (!defaultWallet) {
      defaultWallet = await prisma.wallet.create({
        data: {
          userId: defaultUser.id,
          balance: 1250.00,
          savings: 45.00,
          btcBalance: 14.82,
          ethBalance: 2.45,
          usdcBalance: 2450.00,
          mockkrwBalance: 500000.00
        }
      });
      console.log("[Server DB] Default wallet created");
    } else {
      console.log("[Server DB] Existing wallet found");
    }

    // 3. Ensure default transactions exist
    const txCount = await prisma.transaction.count();
    if (txCount === 0) {
      await prisma.transaction.createMany({
        data: [
          {
            id: "tx-1",
            title: "Sent to John",
            type: "send",
            amount: 240.00,
            date: "Today • 10:45 AM",
            timestamp: Date.now() - 3600000 * 2,
            category: "Transfer",
            status: "Success",
            userId: defaultUser.id
          },
          {
            id: "tx-2",
            title: "Received from Sarah",
            type: "receive",
            amount: 1500.00,
            date: "Yesterday • 4:20 PM",
            timestamp: Date.now() - 3600000 * 24,
            category: "Completed",
            status: "Success",
            userId: defaultUser.id
          },
          {
            id: "tx-3",
            title: "Starbucks Coffee",
            type: "bill",
            amount: 6.50,
            date: "May 24 • 8:12 AM",
            timestamp: Date.now() - 3600000 * 24 * 30,
            category: "Merchant",
            status: "Success",
            userId: defaultUser.id
          }
        ]
      });
      console.log("[Server DB] Default transactions seeded");
    }

    // 4. Ensure default settlements exist
    const settlementCount = await prisma.settlement.count();
    if (settlementCount === 0) {
      await prisma.settlement.createMany({
        data: [
          {
            id: "1",
            initiator: "0x71C8BA52D0FCE8165B1724817B79D335A71F49A2",
            fromToken: "0x0000000000000000000000000000000000000000",
            toToken: "0xe295c52c0020108e7ef9e8b625cf016dfec1562b",
            amount: "150000000000000000000",
            recipientDetails: "Recipient Bank: KR7600200",
            status: "Completed",
            txHash: "0x7a285d83a12903c7ea6e0b79d335a71f49a2a5df335a71f49a20d4400e285d83",
            confirmedTxHash: "0x8b396d94b23014d8fb7e1c8a1446a82e50d1e6e0a46b82a31e550e550d99fe4b",
            createdAt: new Date(Date.now() - 3600000 * 4),
            confirmedAt: new Date(Date.now() - 3600000 * 3.9)
          },
          {
            id: "2",
            initiator: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            fromToken: "0x0000000000000000000000000000000000000000",
            toToken: "0xe295c52c0020108e7ef9e8b625cf016dfec1562b",
            amount: "100000000000000000000000",
            recipientDetails: "Recipient Bank: KR9911822",
            status: "Pending",
            txHash: "0xfa116be88ef4a4ef6e12bbde8812a1446a82e50d1e6e0a55e1c849b39df28a3f",
            createdAt: new Date(Date.now() - 3600000 * 0.5)
          }
        ]
      });
      console.log("[Server DB] Default settlements seeded");
    }

    // 5. Ensure default contacts exist
    const contactCount = await prisma.contact.count();
    if (contactCount === 0) {
      await prisma.contact.createMany({
        data: [
          {
            userId: defaultUser.id,
            walletAddress: "0x4a2ae92f883920108e7ef9e8b625cf016dfec1562",
            name: "Elena Gilbert",
            nickname: "Elena",
            isFavorite: true,
            lastTransactedAt: new Date(Date.now() - 3600000 * 24 * 5)
          },
          {
            userId: defaultUser.id,
            walletAddress: "0x12b5a0bc7ef9e8b625cf016dfec1562b77aa99fe",
            name: "Marcus Vane",
            nickname: "Marcus",
            isFavorite: true,
            lastTransactedAt: new Date(Date.now() - 3600000 * 2)
          },
          {
            userId: defaultUser.id,
            walletAddress: "0xf92c33d1b625cf016dfec1562b77aa99feb88aa2e",
            name: "Saira Khan",
            nickname: "Saira",
            isFavorite: true,
            lastTransactedAt: new Date(Date.now() - 3600000 * 24)
          },
          {
            userId: defaultUser.id,
            walletAddress: "0xbb8a11227c625cf016dfec1562b77aa99feb8813a",
            name: "Jordan Lee",
            nickname: "Jordan",
            isFavorite: true,
            lastTransactedAt: null
          },
          {
            userId: defaultUser.id,
            walletAddress: "0x712388219feb8813a0108e7ef9e8b625cf016dfe",
            name: "John Doe",
            nickname: "John",
            isFavorite: false,
            lastTransactedAt: new Date(Date.now() - 3600000 * 48)
          }
        ]
      });
      console.log("[Server DB] Default contacts seeded");
    }
  } catch (err) {
    console.error("[Server DB] Initialization failed:", err);
  }
}

// Helper to format date relative to now
function getFormattedDate() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `Today • ${timeStr}`;
}

// ==================== AUTHENTICATION ENDPOINTS ====================
// (FX Engine routes already mounted above at /api/fx)

app.get('/api/auth/nonce', (req, res) => {
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const tempId = "temp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8);
  nonces.set(tempId, nonce);
  res.json({ nonce, tempId });
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const { message, signature, address, tempId } = req.body;

    if (!message || !signature || !address || !tempId) {
      return res.status(400).json({ error: "Missing required verification fields." });
    }

    const savedNonce = nonces.get(tempId);
    if (!savedNonce) {
      return res.status(400).json({ error: "Nonce expired or invalid. Please retry." });
    }
    nonces.delete(tempId); // single use

    if (!message.includes(savedNonce)) {
      return res.status(400).json({ error: "Message does not contain the expected nonce." });
    }

    // Recover address using ethers
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(400).json({ error: "Invalid signature. Address mismatch." });
    }

    // Find or create user
    const normalizedAddress = address.toLowerCase();
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: `User ${address.slice(0, 6)}...${address.slice(-4)}`,
          walletAddress: normalizedAddress
        }
      });

      // Create wallet with default balances for this user
      await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 1250.00,
          savings: 45.00,
          btcBalance: 14.82,
          ethBalance: 2.45,
          usdcBalance: 2450.00,
          mockkrwBalance: 500000.00
        }
      });
    }

    // Create session
    const sessionToken = "session-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessions.set(sessionToken, user.id);

    res.json({
      success: true,
      token: sessionToken,
      userId: user.id,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/demo', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required for demo mode." });
    }

    // For demo purposes, allow any password, just authenticate or create the user
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: email.split('@')[0],
          email: email.toLowerCase()
        }
      });

      await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 1250.00,
          savings: 45.00,
          btcBalance: 14.82,
          ethBalance: 2.45,
          usdcBalance: 2450.00,
          mockkrwBalance: 500000.00
        }
      });
    }

    const sessionToken = "session-demo-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessions.set(sessionToken, user.id);

    res.json({
      success: true,
      token: sessionToken,
      userId: user.id,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PROTECTED DASHBOARD ENDPOINTS ====================

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const wallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { timestamp: 'desc' },
      take: 10
    });
    const kyc = await prisma.kyc.findFirst({ where: { userId: req.user.id } });

    res.json({
      balance: wallet ? wallet.balance : 1250.00,
      savings: wallet ? wallet.savings : 45.00,
      btcBalance: wallet ? wallet.btcBalance : 14.82,
      ethBalance: wallet ? wallet.ethBalance : 2.45,
      usdcBalance: wallet ? wallet.usdcBalance : 2450.00,
      mockkrwBalance: wallet ? wallet.mockkrwBalance : 500000.00,
      transactions: transactions || [],
      kycStatus: kyc ? kyc.status : "NotStarted"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { timestamp: 'desc' }
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/send', requireAuth, async (req, res) => {
  try {
    const { recipient, amount, txHash, status, recipientAddress } = req.body;
    const numAmount = Number(amount);

    if (!recipient || recipient.trim() === '') {
      return res.status(400).json({ error: "Recipient name is required" });
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount. Must be greater than 0." });
    }

    const wallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });
    if (!wallet) {
      return res.status(400).json({ error: "Wallet not found" });
    }

    if (numAmount > wallet.balance) {
      return res.status(400).json({ error: "Insufficient balance for this transfer." });
    }

    const txStatus = status || "Success";

    if (txStatus !== "Failed") {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: numAmount } }
      });
    }

    let title = `Sent to ${recipient.trim()}`;
    if (txStatus === "Pending") {
      title = `Sending to ${recipient.trim()}`;
    } else if (txStatus === "Failed") {
      title = `Failed to ${recipient.trim()}`;
    }

    const newTx = await prisma.transaction.create({
      data: {
        id: `tx-${Date.now()}`,
        title,
        type: "send",
        amount: numAmount,
        date: getFormattedDate(),
        timestamp: Date.now(),
        category: "Transfer",
        txHash: txHash || null,
        status: txStatus,
        userId: req.user.id
      }
    });

    if (recipientAddress) {
      try {
        await prisma.contact.upsert({
          where: {
            userId_walletAddress: {
              userId: req.user.id,
              walletAddress: recipientAddress.trim()
            }
          },
          update: {
            lastTransactedAt: new Date()
          },
          create: {
            userId: req.user.id,
            walletAddress: recipientAddress.trim(),
            name: recipient.trim(),
            lastTransactedAt: new Date()
          }
        });
      } catch (contactErr) {
        console.error("[Server] Failed to auto-save contact:", contactErr);
      }
    }

    const updatedWallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });

    res.json({
      message: txStatus === "Pending" ? "Transaction initiated" : "Money sent successfully!",
      balance: Number(updatedWallet.balance.toFixed(2)),
      transaction: newTx
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/update', requireAuth, async (req, res) => {
  try {
    const { id, txHash, status } = req.body;

    const tx = await prisma.transaction.findFirst({
      where: id ? { id } : { txHash }
    });

    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const oldStatus = tx.status;
    let title = tx.title;

    if (status === "Success") {
      title = tx.title.replace("Sending to", "Sent to");
    } else if (status === "Failed") {
      title = tx.title.replace("Sending to", "Failed to");
      if (oldStatus === "Pending") {
        await prisma.wallet.updateMany({
          where: { userId: req.user.id },
          data: { balance: { increment: tx.amount } }
        });
      }
    }

    const updatedTx = await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status,
        title
      }
    });

    const wallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });

    res.json({
      message: `Transaction updated to ${status}`,
      balance: Number(wallet.balance.toFixed(2)),
      transaction: updatedTx
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/add', requireAuth, async (req, res) => {
  try {
    const { source, amount } = req.body;
    const numAmount = Number(amount);

    if (!source || source.trim() === '') {
      return res.status(400).json({ error: "Funding source name is required" });
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount. Must be greater than 0." });
    }

    const wallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });
    if (!wallet) return res.status(400).json({ error: "Wallet not found" });

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: numAmount } }
    });

    const newTx = await prisma.transaction.create({
      data: {
        id: `tx-${Date.now()}`,
        title: `Received from ${source.trim()}`,
        type: "receive",
        amount: numAmount,
        date: getFormattedDate(),
        timestamp: Date.now(),
        category: "Completed",
        status: "Success",
        userId: req.user.id
      }
    });

    const updatedWallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });

    res.json({
      message: "Money added successfully!",
      balance: Number(updatedWallet.balance.toFixed(2)),
      transaction: newTx
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/swap', requireAuth, async (req, res) => {
  try {
    const { fromAsset, toAsset, fromAmount, toAmount } = req.body;
    const numFromAmount = Number(fromAmount);
    const numToAmount = Number(toAmount);
    
    const wallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });
    if (!wallet) return res.status(400).json({ error: "Wallet not found" });

    let updateData = {};
    if (fromAsset === 'BTC') {
      if (numFromAmount > wallet.btcBalance) {
        return res.status(400).json({ error: "Insufficient BTC balance." });
      }
      updateData.btcBalance = { decrement: numFromAmount };
    } else if (fromAsset === 'ETH') {
      if (numFromAmount > wallet.ethBalance) {
        return res.status(400).json({ error: "Insufficient ETH balance." });
      }
      updateData.ethBalance = { decrement: numFromAmount };
    } else if (fromAsset === 'USDC') {
      if (numFromAmount > wallet.usdcBalance) {
        return res.status(400).json({ error: "Insufficient USDC balance." });
      }
      updateData.usdcBalance = { decrement: numFromAmount };
    } else if (fromAsset === 'MockKRW') {
      if (numFromAmount > wallet.mockkrwBalance) {
        return res.status(400).json({ error: "Insufficient MockKRW balance." });
      }
      updateData.mockkrwBalance = { decrement: numFromAmount };
    } else if (fromAsset === 'USD') {
      if (numFromAmount > wallet.balance) {
        return res.status(400).json({ error: "Insufficient USD balance." });
      }
      updateData.balance = { decrement: numFromAmount };
    }

    if (toAsset === 'USDC') {
      updateData.usdcBalance = { ...updateData.usdcBalance, increment: numToAmount };
    } else if (toAsset === 'BTC') {
      updateData.btcBalance = { ...updateData.btcBalance, increment: numToAmount };
    } else if (toAsset === 'ETH') {
      updateData.ethBalance = { ...updateData.ethBalance, increment: numToAmount };
    } else if (toAsset === 'MockKRW') {
      updateData.mockkrwBalance = { ...updateData.mockkrwBalance, increment: numToAmount };
    } else if (toAsset === 'USD') {
      updateData.balance = { ...updateData.balance, increment: numToAmount };
    }

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: updateData
    });

    const newTx = await prisma.transaction.create({
      data: {
        id: `tx-${Date.now()}`,
        title: `Swapped ${numFromAmount} ${fromAsset} for ${toAsset}`,
        type: "send",
        amount: numFromAmount,
        date: getFormattedDate(),
        timestamp: Date.now(),
        category: "Transfer",
        status: "Success",
        userId: req.user.id
      }
    });

    const updatedWallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });

    res.json({
      message: "Assets swapped successfully!",
      balance: Number(updatedWallet.balance.toFixed(2)),
      btcBalance: Number(updatedWallet.btcBalance.toFixed(4)),
      ethBalance: Number(updatedWallet.ethBalance.toFixed(4)),
      usdcBalance: Number(updatedWallet.usdcBalance.toFixed(2)),
      mockkrwBalance: Number(updatedWallet.mockkrwBalance.toFixed(2)),
      transaction: newTx
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/pay', requireAuth, async (req, res) => {
  try {
    const { biller, amount, category } = req.body;
    const numAmount = Number(amount);

    if (!biller || biller.trim() === '') {
      return res.status(400).json({ error: "Biller name is required" });
    }
    if (!category || category.trim() === '') {
      return res.status(400).json({ error: "Category is required" });
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount. Must be greater than 0." });
    }

    const wallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });
    if (!wallet) return res.status(400).json({ error: "Wallet not found" });

    if (numAmount > wallet.balance) {
      return res.status(400).json({ error: "Insufficient balance to pay this bill." });
    }

    const extraSavings = Number((numAmount * 0.01).toFixed(2));

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: numAmount },
        savings: { increment: extraSavings }
      }
    });

    const newTx = await prisma.transaction.create({
      data: {
        id: `tx-${Date.now()}`,
        title: biller.trim(),
        type: "bill",
        amount: numAmount,
        date: getFormattedDate(),
        timestamp: Date.now(),
        category: category.trim(),
        status: "Success",
        userId: req.user.id
      }
    });

    const updatedWallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });

    res.json({
      message: "Bill paid successfully!",
      balance: Number(updatedWallet.balance.toFixed(2)),
      savings: Number(updatedWallet.savings.toFixed(2)),
      transaction: newTx
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kyc', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status is required" });

    const kyc = await prisma.kyc.findFirst({
      where: { userId: req.user.id }
    });

    let updatedKyc;
    if (kyc) {
      updatedKyc = await prisma.kyc.update({
        where: { id: kyc.id },
        data: { status }
      });
    } else {
      updatedKyc = await prisma.kyc.create({
        data: {
          userId: req.user.id,
          status
        }
      });
    }

    res.json({ message: "KYC status updated", kyc: updatedKyc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/explorer', requireAuth, async (req, res) => {
  try {
    const settlements = await prisma.settlement.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CONTACTS ENDPOINTS ====================

app.get('/api/contacts', requireAuth, async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { userId: req.user.id },
      orderBy: [
        { isFavorite: 'desc' },
        { name: 'asc' }
      ]
    });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts', requireAuth, async (req, res) => {
  try {
    const { walletAddress, name, nickname, isFavorite } = req.body;
    if (!walletAddress || !name) {
      return res.status(400).json({ error: "Wallet address and name are required" });
    }

    const contact = await prisma.contact.upsert({
      where: {
        userId_walletAddress: {
          userId: req.user.id,
          walletAddress: walletAddress.trim()
        }
      },
      update: {
        name: name.trim(),
        nickname: nickname ? nickname.trim() : null,
        isFavorite: isFavorite !== undefined ? Boolean(isFavorite) : undefined
      },
      create: {
        userId: req.user.id,
        walletAddress: walletAddress.trim(),
        name: name.trim(),
        nickname: nickname ? nickname.trim() : null,
        isFavorite: isFavorite !== undefined ? Boolean(isFavorite) : false
      }
    });

    res.json({ message: "Contact saved successfully", contact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts/favorite', requireAuth, async (req, res) => {
  try {
    const { id, isFavorite } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Contact ID is required" });
    }

    const contact = await prisma.contact.update({
      where: { id, userId: req.user.id },
      data: { isFavorite: Boolean(isFavorite) }
    });

    res.json({ message: "Favorite status updated", contact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.contact.delete({
      where: { id, userId: req.user.id }
    });
    res.json({ message: "Contact deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== MERCHANT PAY ENDPOINTS ====================

app.post('/api/merchant/request', requireAuth, async (req, res) => {
  try {
    const { amount, currency, description } = req.body;
    if (!amount || !currency || !description) {
      return res.status(400).json({ error: "Amount, currency, and description are required" });
    }

    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        merchantId: req.user.id,
        amount: Number(amount),
        currency: currency.trim(),
        description: description.trim(),
        status: "Pending"
      }
    });

    res.json(paymentRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/merchant/request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        merchant: {
          select: {
            name: true,
            walletAddress: true,
            email: true
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: "Payment request not found" });
    }

    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/merchant/pay', requireAuth, async (req, res) => {
  try {
    const { paymentRequestId, txHash } = req.body;
    if (!paymentRequestId) {
      return res.status(400).json({ error: "Payment Request ID is required" });
    }

    const paymentRequest = await prisma.paymentRequest.findUnique({
      where: { id: paymentRequestId },
      include: {
        merchant: true
      }
    });

    if (!paymentRequest) {
      return res.status(404).json({ error: "Payment request not found" });
    }

    if (paymentRequest.status !== "Pending") {
      return res.status(400).json({ error: "Payment request is already paid or expired" });
    }

    const amount = paymentRequest.amount;
    const currency = paymentRequest.currency;

    // Load customer's wallet
    const customerWallet = await prisma.wallet.findFirst({ where: { userId: req.user.id } });
    if (!customerWallet) {
      return res.status(400).json({ error: "Customer wallet not found" });
    }

    let fieldToDecrement = 'balance'; // default USD
    const curr = currency.toUpperCase();
    if (curr === 'USDC') {
      fieldToDecrement = 'usdcBalance';
    } else if (curr === 'ETH') {
      fieldToDecrement = 'ethBalance';
    } else if (curr === 'BTC') {
      fieldToDecrement = 'btcBalance';
    } else if (curr === 'KRW' || curr === 'MOCKKRW') {
      fieldToDecrement = 'mockkrwBalance';
    }

    const currentBalance = customerWallet[fieldToDecrement];
    if (currentBalance < amount) {
      return res.status(400).json({ error: `Insufficient ${curr} balance. Required: ${amount}, available: ${currentBalance}` });
    }

    // 1. Deduct customer balance
    await prisma.wallet.update({
      where: { id: customerWallet.id },
      data: { [fieldToDecrement]: { decrement: amount } }
    });

    // 2. Credit merchant balance (if merchant has a wallet)
    const merchantWallet = await prisma.wallet.findFirst({ where: { userId: paymentRequest.merchantId } });
    if (merchantWallet) {
      await prisma.wallet.update({
        where: { id: merchantWallet.id },
        data: { [fieldToDecrement]: { increment: amount } }
      });
    }

    // 3. Update Payment Request status
    const payerUser = req.user;
    const updatedRequest = await prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: {
        status: "Paid",
        paidAt: new Date(),
        payerAddress: payerUser.walletAddress || "0xPayerAddress",
        txHash: txHash || "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join("")
      }
    });

    // 4. Create Merchant Settlement Record
    const settlement = await prisma.merchantSettlement.create({
      data: {
        paymentRequestId: paymentRequestId,
        merchantId: paymentRequest.merchantId,
        amount: amount,
        currency: currency,
        status: "Settled",
        txHash: updatedRequest.txHash
      }
    });

    // 5. Add Transaction record for Customer
    await prisma.transaction.create({
      data: {
        id: `tx-${Date.now()}`,
        title: `Payment to ${paymentRequest.merchant.name}`,
        type: "send", // so it shows as outflow in dashboard
        amount: amount,
        date: getFormattedDate(),
        timestamp: Date.now(),
        category: "Merchant",
        txHash: updatedRequest.txHash,
        status: "Success",
        userId: req.user.id
      }
    });

    res.json({
      message: "Payment processed successfully",
      paymentRequest: updatedRequest,
      settlement
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/merchant/settlements', requireAuth, async (req, res) => {
  try {
    const settlements = await prisma.merchantSettlement.findMany({
      where: { merchantId: req.user.id },
      include: {
        paymentRequest: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ANALYTICS ENDPOINT ====================

app.get('/api/analytics', async (req, res) => {
  try {
    const settlements = await prisma.settlement.findMany();
    const transactions = await prisma.transaction.findMany();
    const usersCount = await prisma.user.count();

    const totalTransactions = transactions.length;
    
    let totalVolume = 0;
    transactions.forEach(tx => {
      totalVolume += tx.amount;
    });

    const totalSettlementsCount = settlements.length;
    const successfulSettlementsCount = settlements.filter(s => s.status === 'Completed' || s.status === 'Success').length;
    const successRate = totalSettlementsCount > 0 ? (successfulSettlementsCount / totalSettlementsCount) * 100 : 100;

    let totalDurationSeconds = 0;
    let countedSettlements = 0;
    settlements.forEach(s => {
      if (s.confirmedAt && s.createdAt) {
        const diffMs = new Date(s.confirmedAt).getTime() - new Date(s.createdAt).getTime();
        totalDurationSeconds += diffMs / 1000;
        countedSettlements++;
      }
    });
    const avgSettlementTime = countedSettlements > 0 ? Math.round(totalDurationSeconds / countedSettlements) : 45;

    const avgFeeSaved = totalTransactions > 0 ? 1.08 : 0;

    const activeUsers = new Set(transactions.map(t => t.userId).filter(Boolean)).size || usersCount;

    // --- Chart Data ---
    
    // 1. Daily Volume (Last 7 Days)
    const dailyVolume = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dailyVolume[dateStr] = 0;
    }

    transactions.forEach(tx => {
      try {
        const txDate = new Date(tx.timestamp || tx.date);
        const dateStr = txDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (dailyVolume[dateStr] !== undefined) {
          dailyVolume[dateStr] += tx.amount;
        }
      } catch (e) {}
    });

    const dailyVolumeData = Object.keys(dailyVolume).map(key => ({
      label: key,
      value: Math.round(dailyVolume[key] * 100) / 100
    }));

    // 2. Weekly Volume (Last 4 Weeks)
    const weeklyVolumeData = [
      { label: 'Week 1', value: 0 },
      { label: 'Week 2', value: 0 },
      { label: 'Week 3', value: 0 },
      { label: 'Week 4', value: 0 }
    ];
    transactions.forEach(tx => {
      const diffDays = Math.floor((Date.now() - (tx.timestamp || Date.now())) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) weeklyVolumeData[3].value += tx.amount;
      else if (diffDays < 14) weeklyVolumeData[2].value += tx.amount;
      else if (diffDays < 21) weeklyVolumeData[1].value += tx.amount;
      else if (diffDays < 28) weeklyVolumeData[0].value += tx.amount;
    });
    weeklyVolumeData.forEach(w => w.value = Math.round(w.value * 100) / 100);

    // 3. Asset Distribution
    const assets = {};
    settlements.forEach(s => {
      const token = s.toToken === "0x0000000000000000000000000000000000000000" ? "ETH" : "MockKRW";
      assets[token] = (assets[token] || 0) + 1;
    });
    if (!assets["ETH"]) assets["ETH"] = 5;
    if (!assets["MockKRW"]) assets["MockKRW"] = 12;
    assets["USDC"] = transactions.filter(t => t.category === "USDC" || t.title.includes("USDC")).length || 8;

    const assetDistribution = Object.keys(assets).map(key => ({
      label: key,
      value: assets[key]
    }));

    // 4. Settlement Speed
    const speedCategories = {
      '< 30s': 0,
      '30s-1m': 0,
      '1m-2m': 0,
      '2m+': 0
    };
    settlements.forEach(s => {
      if (s.confirmedAt && s.createdAt) {
        const diffSeconds = (new Date(s.confirmedAt).getTime() - new Date(s.createdAt).getTime()) / 1000;
        if (diffSeconds < 30) speedCategories['< 30s']++;
        else if (diffSeconds < 60) speedCategories['30s-1m']++;
        else if (diffSeconds < 120) speedCategories['1m-2m']++;
        else speedCategories['2m+']++;
      }
    });
    if (Object.values(speedCategories).every(v => v === 0)) {
      speedCategories['< 30s'] = 8;
      speedCategories['30s-1m'] = 15;
      speedCategories['1m-2m'] = 4;
      speedCategories['2m+'] = 1;
    }

    const settlementSpeed = Object.keys(speedCategories).map(key => ({
      label: key,
      value: speedCategories[key]
    }));

    res.json({
      metrics: {
        totalVolume: Math.round(totalVolume * 100) / 100,
        avgSettlementTime,
        avgFeeSaved,
        totalTransactions,
        activeUsers,
        successRate: Math.round(successRate * 10) / 10
      },
      charts: {
        dailyVolume: dailyVolumeData,
        weeklyVolume: weeklyVolumeData,
        assetDistribution,
        settlementSpeed
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server and initialize database
app.listen(PORT, async () => {
  console.log(`KorriPay backend server running on port ${PORT}`);
  await initDatabase();
});
