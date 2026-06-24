import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory data store
let balance = 1250.00;
let savingsThisMonth = 45.00;
let btcBalance = 14.82;
let ethBalance = 2.45;
let usdcBalance = 2450.00;

let transactions = [
  {
    id: "tx-1",
    title: "Sent to John",
    type: "send", // 'send', 'receive', 'bill', 'add'
    amount: 240.00,
    date: "Today • 10:45 AM",
    timestamp: Date.now() - 3600000 * 2, // 2 hours ago
    category: "Transfer"
  },
  {
    id: "tx-2",
    title: "Received from Sarah",
    type: "receive",
    amount: 1500.00,
    date: "Yesterday • 4:20 PM",
    timestamp: Date.now() - 3600000 * 24, // 24 hours ago
    category: "Completed"
  },
  {
    id: "tx-3",
    title: "Starbucks Coffee",
    type: "bill",
    amount: 6.50,
    date: "May 24 • 8:12 AM",
    timestamp: Date.now() - 3600000 * 24 * 30, // 30 days ago
    category: "Merchant"
  }
];

// Helper to format date relative to now
function getFormattedDate() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `Today • ${timeStr}`;
}

// REST Endpoints
app.get('/api/dashboard', (req, res) => {
  res.json({
    balance: Number(balance.toFixed(2)),
    savings: savingsThisMonth,
    btcBalance: Number(btcBalance.toFixed(4)),
    ethBalance: Number(ethBalance.toFixed(4)),
    usdcBalance: Number(usdcBalance.toFixed(2)),
    transactions: transactions.slice(0, 10) // return top 10
  });
});

app.get('/api/transactions', (req, res) => {
  res.json(transactions);
});

app.post('/api/transactions/send', (req, res) => {
  const { recipient, amount } = req.body;
  const numAmount = Number(amount);

  if (!recipient || recipient.trim() === '') {
    return res.status(400).json({ error: "Recipient name is required" });
  }
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Invalid amount. Must be greater than 0." });
  }
  if (numAmount > balance) {
    return res.status(400).json({ error: "Insufficient balance for this transfer." });
  }

  balance -= numAmount;
  const newTx = {
    id: `tx-${Date.now()}`,
    title: `Sent to ${recipient.trim()}`,
    type: "send",
    amount: numAmount,
    date: getFormattedDate(),
    timestamp: Date.now(),
    category: "Transfer"
  };

  transactions.unshift(newTx);

  res.json({
    message: "Money sent successfully!",
    balance: Number(balance.toFixed(2)),
    transaction: newTx
  });
});

app.post('/api/transactions/add', (req, res) => {
  const { source, amount } = req.body;
  const numAmount = Number(amount);

  if (!source || source.trim() === '') {
    return res.status(400).json({ error: "Funding source name is required" });
  }
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Invalid amount. Must be greater than 0." });
  }

  balance += numAmount;
  const newTx = {
    id: `tx-${Date.now()}`,
    title: `Received from ${source.trim()}`,
    type: "receive",
    amount: numAmount,
    date: getFormattedDate(),
    timestamp: Date.now(),
    category: "Completed"
  };

  transactions.unshift(newTx);

  res.json({
    message: "Money added successfully!",
    balance: Number(balance.toFixed(2)),
    transaction: newTx
  });
});

app.post('/api/transactions/swap', (req, res) => {
  const { fromAsset, toAsset, fromAmount, toAmount, fee } = req.body;
  const numFromAmount = Number(fromAmount);
  const numToAmount = Number(toAmount);
  
  if (fromAsset === 'BTC') {
    if (numFromAmount > btcBalance) {
      return res.status(400).json({ error: "Insufficient BTC balance." });
    }
    btcBalance -= numFromAmount;
  } else if (fromAsset === 'ETH') {
    if (numFromAmount > ethBalance) {
      return res.status(400).json({ error: "Insufficient ETH balance." });
    }
    ethBalance -= numFromAmount;
  } else if (fromAsset === 'USDC') {
    if (numFromAmount > usdcBalance) {
      return res.status(400).json({ error: "Insufficient USDC balance." });
    }
    usdcBalance -= numFromAmount;
  } else if (fromAsset === 'USD') {
    if (numFromAmount > balance) {
      return res.status(400).json({ error: "Insufficient USD balance." });
    }
    balance -= numFromAmount;
  }

  if (toAsset === 'USDC') {
    usdcBalance += numToAmount;
  } else if (toAsset === 'BTC') {
    btcBalance += numToAmount;
  } else if (toAsset === 'ETH') {
    ethBalance += numToAmount;
  } else if (toAsset === 'USD') {
    balance += numToAmount;
  }

  const newTx = {
    id: `tx-${Date.now()}`,
    title: `Swapped ${numFromAmount} ${fromAsset} for ${toAsset}`,
    type: "send",
    amount: numFromAmount,
    date: getFormattedDate(),
    timestamp: Date.now(),
    category: "Transfer"
  };
  transactions.unshift(newTx);

  res.json({
    message: "Assets swapped successfully!",
    balance: Number(balance.toFixed(2)),
    btcBalance: Number(btcBalance.toFixed(4)),
    ethBalance: Number(ethBalance.toFixed(4)),
    usdcBalance: Number(usdcBalance.toFixed(2)),
    transaction: newTx
  });
});

app.post('/api/transactions/pay', (req, res) => {
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
  if (numAmount > balance) {
    return res.status(400).json({ error: "Insufficient balance to pay this bill." });
  }

  balance -= numAmount;
  // Let's assume paying bills also increases savings a little due to "zero hidden fees" / smart payment rewards
  const extraSavings = Number((numAmount * 0.01).toFixed(2));
  savingsThisMonth = Number((savingsThisMonth + extraSavings).toFixed(2));

  const newTx = {
    id: `tx-${Date.now()}`,
    title: biller.trim(),
    type: "bill",
    amount: numAmount,
    date: getFormattedDate(),
    timestamp: Date.now(),
    category: category.trim()
  };

  transactions.unshift(newTx);

  res.json({
    message: "Bill paid successfully!",
    balance: Number(balance.toFixed(2)),
    savings: savingsThisMonth,
    transaction: newTx
  });
});

app.listen(PORT, () => {
  console.log(`KorriPay backend server running on port ${PORT}`);
});
