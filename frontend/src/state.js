export let isBackendConnected = { value: false };

// Mock Fallback Data (if backend is unreachable)
export let localState = {
  balance: 1250.00,
  savings: 45.00,
  btcBalance: 14.82,
  ethBalance: 2.45,
  usdcBalance: 2450.00,
  mockkrwBalance: 500000.00,
  currencies: {
    USD:     { available: 1250.00, locked: 0, pending: 0 },
    KRW:     { available: 0,       locked: 0, pending: 0 },
    NGN:     { available: 0,       locked: 0, pending: 0 },
    MockKRW: { available: 500000,  locked: 0, pending: 0 },
  },
  transactions: [
    { id: "tx-1", title: "Sent to John",        type: "send",    amount: 240.00,  date: "Today • 10:45 AM",    timestamp: Date.now() - 3600000 * 2,      category: "Transfer" },
    { id: "tx-2", title: "Received from Sarah", type: "receive", amount: 1500.00, date: "Yesterday • 4:20 PM", timestamp: Date.now() - 3600000 * 24,     category: "Completed" },
    { id: "tx-3", title: "Starbucks Coffee",    type: "bill",    amount: 6.50,   date: "May 24 • 8:12 AM",   timestamp: Date.now() - 3600000 * 24 * 30, category: "Merchant" }
  ]
};

// Main State
export let state = {
  balance: 0,
  savings: 0,
  btcBalance: 0,
  ethBalance: 0,
  usdcBalance: 0,
  mockkrwBalance: 0,
  currencies: {
    USD:     { available: 0, locked: 0, pending: 0 },
    KRW:     { available: 0, locked: 0, pending: 0 },
    NGN:     { available: 0, locked: 0, pending: 0 },
    MockKRW: { available: 0, locked: 0, pending: 0 },
  },
  transactions: []
};
