/**
 * KorriPay Multi-Currency Wallet Controller
 * ─────────────────────────────────────────
 * REST endpoints for multi-currency wallet balances,
 * ledger entries, locking/unlocking funds, and wallet analytics.
 *
 * Mount in server.js with: app.use('/api/wallet', requireAuth, walletRouter)
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router  = Router();
const prisma  = new PrismaClient();

// ── Supported currencies & their DB column prefixes ───────────────────────
const CURRENCIES = {
  USD:      { prefix: 'usd',      symbol: '$',  decimals: 2,  name: 'US Dollar' },
  KRW:      { prefix: 'krw',      symbol: '₩',  decimals: 0,  name: 'Korean Won' },
  NGN:      { prefix: 'ngn',      symbol: '₦',  decimals: 2,  name: 'Nigerian Naira' },
  MockKRW:  { prefix: 'mockkrw', symbol: '₩',  decimals: 2,  name: 'MockKRW Stablecoin' },
};

// ── Helper: get or create wallet ──────────────────────────────────────────
async function getOrCreateWallet(userId) {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        usdAvailable:     1250.00,
        mockkrwAvailable: 500000.00,
      },
    });
  }
  return wallet;
}

// ── Helper: append ledger entry ───────────────────────────────────────────
async function appendLedger(walletId, { currency, balanceType = 'available', amount, entryType, description, txHash = null, referenceId = null, runningBalance }) {
  return prisma.walletLedger.create({
    data: { walletId, currency, balanceType, amount, entryType, description, txHash, referenceId, runningBalance },
  });
}

// ── Helper: format wallet for API response ────────────────────────────────
function formatWallet(wallet) {
  return {
    id:        wallet.id,
    updatedAt: wallet.updatedAt,
    savings:   wallet.savings,
    // On-chain crypto (read from blockchain, stored as cache)
    crypto: {
      BTC:  { balance: wallet.btcBalance },
      ETH:  { balance: wallet.ethBalance },
      USDC: { balance: wallet.usdcBalance },
    },
    // Fiat & stablecoin multi-currency balances
    currencies: {
      USD: {
        name:      CURRENCIES.USD.name,
        symbol:    CURRENCIES.USD.symbol,
        available: wallet.usdAvailable,
        locked:    wallet.usdLocked,
        pending:   wallet.usdPending,
        total:     wallet.usdAvailable + wallet.usdLocked + wallet.usdPending,
      },
      KRW: {
        name:      CURRENCIES.KRW.name,
        symbol:    CURRENCIES.KRW.symbol,
        available: wallet.krwAvailable,
        locked:    wallet.krwLocked,
        pending:   wallet.krwPending,
        total:     wallet.krwAvailable + wallet.krwLocked + wallet.krwPending,
      },
      NGN: {
        name:      CURRENCIES.NGN.name,
        symbol:    CURRENCIES.NGN.symbol,
        available: wallet.ngnAvailable,
        locked:    wallet.ngnLocked,
        pending:   wallet.ngnPending,
        total:     wallet.ngnAvailable + wallet.ngnLocked + wallet.ngnPending,
      },
      MockKRW: {
        name:      CURRENCIES.MockKRW.name,
        symbol:    CURRENCIES.MockKRW.symbol,
        available: wallet.mockkrwAvailable,
        locked:    wallet.mockkrwLocked,
        pending:   wallet.mockkrwPending,
        total:     wallet.mockkrwAvailable + wallet.mockkrwLocked + wallet.mockkrwPending,
      },
    },
  };
}

// ── GET /api/wallet ────────────────────────────────────────────────────────
// Returns full multi-currency wallet state for authenticated user.
router.get('/', async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.userId);
    res.json(formatWallet(wallet));
  } catch (err) {
    console.error('[Wallet] GET / error:', err);
    res.status(500).json({ error: 'Failed to load wallet.' });
  }
});

// ── GET /api/wallet/ledger ─────────────────────────────────────────────────
// Returns paginated ledger entries for the authenticated user's wallet.
// Query: currency (optional), limit (default 50), offset (default 0)
router.get('/ledger', async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.userId);
    const { currency, limit = '50', offset = '0' } = req.query;

    const where = { walletId: wallet.id };
    if (currency) where.currency = currency.toUpperCase();

    const [entries, total] = await Promise.all([
      prisma.walletLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    Math.min(parseInt(limit), 200),
        skip:    parseInt(offset),
      }),
      prisma.walletLedger.count({ where }),
    ]);

    res.json({ entries, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    console.error('[Wallet] GET /ledger error:', err);
    res.status(500).json({ error: 'Failed to load ledger.' });
  }
});

// ── POST /api/wallet/credit ────────────────────────────────────────────────
// Credit (add) to the available balance of a currency.
// Body: { currency, amount, description, txHash?, referenceId? }
router.post('/credit', async (req, res) => {
  try {
    const { currency, amount, description, txHash, referenceId } = req.body;
    const num = parseFloat(amount);

    if (!currency || !CURRENCIES[currency]) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
    if (!num || num <= 0)                   return res.status(400).json({ error: 'amount must be a positive number.' });

    const wallet  = await getOrCreateWallet(req.userId);
    const prefix  = CURRENCIES[currency].prefix;
    const availKey = `${prefix}Available`;

    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data:  { [availKey]: { increment: num } },
    });

    await appendLedger(wallet.id, {
      currency,
      balanceType:    'available',
      amount:          num,
      entryType:       'credit',
      description:     description ?? `Credit ${num} ${currency}`,
      txHash,
      referenceId,
      runningBalance:  updated[availKey],
    });

    res.json({ success: true, wallet: formatWallet(updated) });
  } catch (err) {
    console.error('[Wallet] POST /credit error:', err);
    res.status(500).json({ error: 'Credit failed.' });
  }
});

// ── POST /api/wallet/debit ─────────────────────────────────────────────────
// Debit (subtract) from available balance.
// Body: { currency, amount, description, txHash?, referenceId? }
router.post('/debit', async (req, res) => {
  try {
    const { currency, amount, description, txHash, referenceId } = req.body;
    const num = parseFloat(amount);

    if (!currency || !CURRENCIES[currency]) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
    if (!num || num <= 0)                   return res.status(400).json({ error: 'amount must be a positive number.' });

    const wallet   = await getOrCreateWallet(req.userId);
    const prefix   = CURRENCIES[currency].prefix;
    const availKey = `${prefix}Available`;

    if (wallet[availKey] < num) {
      return res.status(400).json({ error: `Insufficient ${currency} balance. Available: ${wallet[availKey]}` });
    }

    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data:  { [availKey]: { decrement: num } },
    });

    await appendLedger(wallet.id, {
      currency,
      balanceType:   'available',
      amount:        -num,
      entryType:     'debit',
      description:   description ?? `Debit ${num} ${currency}`,
      txHash,
      referenceId,
      runningBalance: updated[availKey],
    });

    res.json({ success: true, wallet: formatWallet(updated) });
  } catch (err) {
    console.error('[Wallet] POST /debit error:', err);
    res.status(500).json({ error: 'Debit failed.' });
  }
});

// ── POST /api/wallet/lock ──────────────────────────────────────────────────
// Move funds from Available → Locked (e.g. initiating a settlement).
// Body: { currency, amount, description, referenceId? }
router.post('/lock', async (req, res) => {
  try {
    const { currency, amount, description, referenceId } = req.body;
    const num = parseFloat(amount);

    if (!currency || !CURRENCIES[currency]) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
    if (!num || num <= 0)                   return res.status(400).json({ error: 'amount must be a positive number.' });

    const wallet     = await getOrCreateWallet(req.userId);
    const prefix     = CURRENCIES[currency].prefix;
    const availKey   = `${prefix}Available`;
    const lockedKey  = `${prefix}Locked`;

    if (wallet[availKey] < num) {
      return res.status(400).json({ error: `Insufficient available ${currency} to lock. Available: ${wallet[availKey]}` });
    }

    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data:  { [availKey]: { decrement: num }, [lockedKey]: { increment: num } },
    });

    await appendLedger(wallet.id, {
      currency, balanceType: 'available', amount: -num,
      entryType: 'lock', description: description ?? `Locked ${num} ${currency} for settlement`,
      referenceId, runningBalance: updated[availKey],
    });

    res.json({ success: true, wallet: formatWallet(updated) });
  } catch (err) {
    console.error('[Wallet] POST /lock error:', err);
    res.status(500).json({ error: 'Lock failed.' });
  }
});

// ── POST /api/wallet/unlock ────────────────────────────────────────────────
// Move funds from Locked → Available (e.g. refund).
// Body: { currency, amount, description, referenceId? }
router.post('/unlock', async (req, res) => {
  try {
    const { currency, amount, description, referenceId } = req.body;
    const num = parseFloat(amount);

    if (!currency || !CURRENCIES[currency]) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
    if (!num || num <= 0)                   return res.status(400).json({ error: 'amount must be a positive number.' });

    const wallet    = await getOrCreateWallet(req.userId);
    const prefix    = CURRENCIES[currency].prefix;
    const availKey  = `${prefix}Available`;
    const lockedKey = `${prefix}Locked`;

    if (wallet[lockedKey] < num) {
      return res.status(400).json({ error: `Insufficient locked ${currency}. Locked: ${wallet[lockedKey]}` });
    }

    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data:  { [lockedKey]: { decrement: num }, [availKey]: { increment: num } },
    });

    await appendLedger(wallet.id, {
      currency, balanceType: 'locked', amount: -num,
      entryType: 'unlock', description: description ?? `Unlocked ${num} ${currency}`,
      referenceId, runningBalance: updated[availKey],
    });

    res.json({ success: true, wallet: formatWallet(updated) });
  } catch (err) {
    console.error('[Wallet] POST /unlock error:', err);
    res.status(500).json({ error: 'Unlock failed.' });
  }
});

// ── POST /api/wallet/settle ────────────────────────────────────────────────
// Complete a settlement: move Locked → Settled (funds leave the wallet).
// Body: { currency, amount, description, txHash?, referenceId? }
router.post('/settle', async (req, res) => {
  try {
    const { currency, amount, description, txHash, referenceId } = req.body;
    const num = parseFloat(amount);

    if (!currency || !CURRENCIES[currency]) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
    if (!num || num <= 0)                   return res.status(400).json({ error: 'amount must be a positive number.' });

    const wallet    = await getOrCreateWallet(req.userId);
    const prefix    = CURRENCIES[currency].prefix;
    const lockedKey = `${prefix}Locked`;

    if (wallet[lockedKey] < num) {
      return res.status(400).json({ error: `Insufficient locked ${currency} for settlement. Locked: ${wallet[lockedKey]}` });
    }

    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data:  { [lockedKey]: { decrement: num } },
    });

    await appendLedger(wallet.id, {
      currency, balanceType: 'locked', amount: -num,
      entryType: 'settle', description: description ?? `Settlement of ${num} ${currency}`,
      txHash, referenceId, runningBalance: updated[`${prefix}Available`],
    });

    res.json({ success: true, wallet: formatWallet(updated) });
  } catch (err) {
    console.error('[Wallet] POST /settle error:', err);
    res.status(500).json({ error: 'Settle failed.' });
  }
});

// ── GET /api/wallet/summary ────────────────────────────────────────────────
// Returns a flat summary for use in dashboard header / quick stats.
router.get('/summary', async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.userId);
    res.json({
      usd:     { available: wallet.usdAvailable,     locked: wallet.usdLocked,     pending: wallet.usdPending },
      krw:     { available: wallet.krwAvailable,     locked: wallet.krwLocked,     pending: wallet.krwPending },
      ngn:     { available: wallet.ngnAvailable,     locked: wallet.ngnLocked,     pending: wallet.ngnPending },
      mockkrw: { available: wallet.mockkrwAvailable, locked: wallet.mockkrwLocked, pending: wallet.mockkrwPending },
      savings: wallet.savings,
    });
  } catch (err) {
    console.error('[Wallet] GET /summary error:', err);
    res.status(500).json({ error: 'Failed to load wallet summary.' });
  }
});

export default router;
