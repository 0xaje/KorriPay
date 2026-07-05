/**
 * KorriPay FX Engine — fxController.js
 * ─────────────────────────────────────
 * Express route handlers for all FX Engine endpoints.
 * Mount with: app.use('/api/fx', fxRouter)
 */

import { Router } from 'express';
import {
  convertFX,
  fetchLiveRates,
  recordFXConversion,
  getFXHistory,
  getFXAnalytics,
  calculateFee,
} from './fxService.js';

export const fxOverrides = {
  fetchLiveRates: null,
  convertFX: null,
  getFXHistory: null,
  getFXAnalytics: null,
  calculateFee: null,
  recordFXConversion: null
};

const router = Router();

// ── GET /api/fx/rates ──────────────────────────────────────────────────────
// Returns live exchange rates vs USD base.
// Public endpoint — no auth required (used in Send Money preview).
// Mount with: app.use('/api/fx', fxRouter)
router.get('/rates', async (req, res) => {
  try {
    const rates = await (fxOverrides.fetchLiveRates || fetchLiveRates)();
    res.json({
      base:      'USD',
      rates:     { KRW: rates.KRW, NGN: rates.NGN, USD: 1 },
      source:    rates._source,
      timestamp: rates._timestamp,
    });
  } catch (err) {
    console.error('[FX Controller] /rates error:', err);
    res.status(500).json({ error: 'Failed to fetch exchange rates.' });
  }
});

// ── POST /api/fx/convert ───────────────────────────────────────────────────
// Performs a full FX conversion with fee breakdown.
// Body: { amount: number, fromCurrency: string, toAsset: string }
// Public — auth optional (record conversion to history only if user present).
router.post('/convert', async (req, res) => {
  try {
    const { amount, fromCurrency, toAsset } = req.body;

    if (!amount || !fromCurrency || !toAsset) {
      return res.status(400).json({ error: 'amount, fromCurrency, and toAsset are required.' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number.' });
    }

    const result = await (fxOverrides.convertFX || convertFX)(numericAmount, fromCurrency.toUpperCase(), toAsset);

    // If a userId is present in the request (set by requireAuth), save history
    if (req.userId) {
      const txHash = req.body.txHash ?? null;
      await (fxOverrides.recordFXConversion || recordFXConversion)(req.userId, result, txHash).catch((e) =>
        console.warn('[FX] History record failed (non-fatal):', e.message)
      );
    }

    res.json(result);
  } catch (err) {
    console.error('[FX Controller] /convert error:', err);
    res.status(400).json({ error: err.message ?? 'Conversion failed.' });
  }
});

// ── POST /api/fx/quote ─────────────────────────────────────────────────────
// Returns a real-time quote without recording to history.
// Body: { amount: number, fromCurrency: string, toAsset: string }
router.post('/quote', async (req, res) => {
  try {
    const { amount, fromCurrency, toAsset } = req.body;

    const numericAmount = parseFloat(amount ?? 0);
    const result = await (fxOverrides.convertFX || convertFX)(
      numericAmount || 1,
      (fromCurrency ?? 'USD').toUpperCase(),
      toAsset ?? 'USDC'
    );

    res.json(result);
  } catch (err) {
    console.error('[FX Controller] /quote error:', err);
    res.status(400).json({ error: err.message ?? 'Quote failed.' });
  }
});

// ── GET /api/fx/history ────────────────────────────────────────────────────
// Returns FX conversion history for the authenticated user.
// Query params: limit (default 50), offset (default 0)
router.get('/history', requireAuthMiddleware, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? '50'), 200);
    const offset = parseInt(req.query.offset ?? '0');

    const result = await (fxOverrides.getFXHistory || getFXHistory)(req.userId, limit, offset);
    res.json(result);
  } catch (err) {
    console.error('[FX Controller] /history error:', err);
    res.status(500).json({ error: 'Failed to retrieve FX history.' });
  }
});

// ── GET /api/fx/analytics ──────────────────────────────────────────────────
// Returns aggregated FX analytics for the authenticated user.
// Query params: days (default 30)
router.get('/analytics', requireAuthMiddleware, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days ?? '30'), 365);
    const result = await (fxOverrides.getFXAnalytics || getFXAnalytics)(req.userId, days);
    res.json(result);
  } catch (err) {
    console.error('[FX Controller] /analytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve FX analytics.' });
  }
});

// ── GET /api/fx/fee ────────────────────────────────────────────────────────
// Returns the fee breakdown for a given USD-equivalent amount.
// Query params: amount, currency
router.get('/fee', async (req, res) => {
  try {
    const { amount, currency } = req.query;

    const numericAmount = parseFloat(amount ?? 0);
    const feeRate = 0.005; // 0.5%

    // To express fee in source currency, first get rates
    const rates = await (fxOverrides.fetchLiveRates || fetchLiveRates)();
    const usdEquivalent = !currency || currency === 'USD'
      ? numericAmount
      : numericAmount / (rates[currency.toUpperCase()] ?? 1);

    const fee = (fxOverrides.calculateFee || calculateFee)(usdEquivalent, feeRate);

    res.json({
      inputAmount:    numericAmount,
      currency:       (currency ?? 'USD').toUpperCase(),
      usdEquivalent:  Math.round(usdEquivalent * 10000) / 10000,
      feeRatePercent: (feeRate * 100).toFixed(2),
      feeUSD:         fee.feeUSD,
      isFree:         fee.isZero,
      label:          fee.isZero ? 'Free (≤ $5 USD)' : `${(feeRate * 100).toFixed(1)}% KorriPay Fee`,
    });
  } catch (err) {
    console.error('[FX Controller] /fee error:', err);
    res.status(500).json({ error: 'Failed to calculate fee.' });
  }
});

// ── Local auth helper ──────────────────────────────────────────────────────
// This mirrors the requireAuth middleware in server.js.
// The router will be mounted after that middleware is applied, so
// req.userId will already be set when needed. This guard is used
// only on the history/analytics routes which require login.
function requireAuthMiddleware(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

export default router;
