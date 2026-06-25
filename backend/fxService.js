/**
 * KorriPay FX Engine — fxService.js
 * ─────────────────────────────────
 * Provides real exchange rate resolution, currency conversion,
 * fee calculation, and FX analytics aggregation.
 *
 * Supported Input Currencies:  KRW | USD | NGN
 * Supported Output Assets:     MockKRW | USDC
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Constants ──────────────────────────────────────────────────────────────

/** KorriPay platform FX fee expressed as a decimal fraction (0.5%) */
const FX_FEE_RATE = 0.005;

/** MockKRW peg: 1 MockKRW = 1 KRW (1:1 peg maintained by treasury) */
const MOCKKRW_PEG = 1;

/** Supported fiat inputs */
const SUPPORTED_INPUTS = ['KRW', 'USD', 'NGN'];

/** Supported stablecoin outputs */
const SUPPORTED_OUTPUTS = ['MockKRW', 'USDC'];

/** Free tier limit — conversions below this USD equivalent have zero fee */
const FREE_TIER_USD_LIMIT = 5;

// ── Live Rate Fetcher ─────────────────────────────────────────────────────

/**
 * Fetch live exchange rates from the ExchangeRate-API (free tier).
 * Falls back to hardcoded emergency rates if the network request fails.
 *
 * @returns {Object} rates — { KRW: number, NGN: number, USD: number } all vs USD base
 */
export async function fetchLiveRates() {
  const FALLBACK_RATES = {
    KRW: 1325.50,   // 1 USD = 1325.50 KRW
    NGN: 1610.00,   // 1 USD = 1610.00 NGN
    USD: 1.0,
  };

  try {
    // Use open.er-api.com free endpoint (no API key required)
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`Rate API responded ${response.status}`);

    const data = await response.json();

    if (data.result !== 'success') throw new Error('Rate API returned error result');

    const rates = {
      KRW: data.rates?.KRW ?? FALLBACK_RATES.KRW,
      NGN: data.rates?.NGN ?? FALLBACK_RATES.NGN,
      USD: 1.0,
      _source: 'live',
      _timestamp: data.time_last_update_utc ?? new Date().toUTCString(),
    };

    console.info(`[FX] Live rates fetched: 1 USD = ${rates.KRW} KRW / ${rates.NGN} NGN`);
    return rates;
  } catch (err) {
    console.warn(`[FX] Rate fetch failed (${err.message}). Using fallback rates.`);
    return { ...FALLBACK_RATES, _source: 'fallback', _timestamp: new Date().toUTCString() };
  }
}

// ── Conversion Engine ──────────────────────────────────────────────────────

/**
 * Convert an amount from a fiat input currency to a stablecoin output.
 *
 * @param {number}  amount        - Numeric amount in input currency
 * @param {string}  fromCurrency  - 'KRW' | 'USD' | 'NGN'
 * @param {string}  toAsset       - 'MockKRW' | 'USDC'
 * @returns {Object} Conversion breakdown
 */
export async function convertFX(amount, fromCurrency, toAsset) {
  if (!SUPPORTED_INPUTS.includes(fromCurrency)) {
    throw new Error(`Unsupported input currency: ${fromCurrency}. Supported: ${SUPPORTED_INPUTS.join(', ')}`);
  }
  if (!SUPPORTED_OUTPUTS.includes(toAsset)) {
    throw new Error(`Unsupported output asset: ${toAsset}. Supported: ${SUPPORTED_OUTPUTS.join(', ')}`);
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number.');
  }

  const rates = await fetchLiveRates();

  // Step 1: Normalise input to USD
  const usdEquivalent = fromCurrency === 'USD'
    ? amount
    : amount / rates[fromCurrency];

  // Step 2: Determine output amount
  let outputAmount;
  let outputRate;

  if (toAsset === 'MockKRW') {
    // MockKRW is pegged 1:1 to KRW
    // Amount in KRW → directly in MockKRW
    const krwEquivalent = fromCurrency === 'KRW'
      ? amount
      : usdEquivalent * rates.KRW;
    outputAmount = krwEquivalent * MOCKKRW_PEG;
    outputRate = fromCurrency === 'KRW'
      ? MOCKKRW_PEG
      : rates.KRW;
  } else {
    // USDC is pegged 1:1 to USD
    outputAmount = usdEquivalent;
    outputRate = fromCurrency === 'USD' ? 1 : (1 / rates[fromCurrency]);
  }

  // Step 3: Fee calculation
  const feeResult = calculateFee(usdEquivalent, FX_FEE_RATE);

  // Step 4: Net output after fee (fee is deducted from output)
  const feeInOutput = toAsset === 'MockKRW'
    ? feeResult.feeUSD * rates.KRW
    : feeResult.feeUSD;

  const netOutputAmount = Math.max(0, outputAmount - feeInOutput);

  return {
    input: {
      amount,
      currency: fromCurrency,
    },
    output: {
      asset:        toAsset,
      grossAmount:  round(outputAmount, 6),
      netAmount:    round(netOutputAmount, 6),
    },
    rate: {
      value:      round(outputRate, 6),
      display:    `1 ${fromCurrency} = ${round(outputRate, 4)} ${toAsset}`,
      source:     rates._source,
      timestamp:  rates._timestamp,
    },
    fee: {
      ratePercent:  (FX_FEE_RATE * 100).toFixed(2),
      usdEquivalent: round(feeResult.feeUSD, 4),
      inOutputAsset: round(feeInOutput, 6),
      isZero:       feeResult.isZero,
      label:        feeResult.isZero ? 'Free (small amount)' : `${(FX_FEE_RATE * 100).toFixed(1)}% Platform Fee`,
    },
    usdEquivalent: round(usdEquivalent, 4),
    rates: {
      KRW: rates.KRW,
      NGN: rates.NGN,
    },
  };
}

// ── Fee Engine ────────────────────────────────────────────────────────────

/**
 * Calculate platform fee with a free-tier waiver.
 *
 * @param {number} usdAmount  - USD equivalent of the transaction
 * @param {number} feeRate    - Fee as decimal (0.005 = 0.5%)
 * @returns {{ feeUSD: number, isZero: boolean }}
 */
export function calculateFee(usdAmount, feeRate = FX_FEE_RATE) {
  if (usdAmount <= FREE_TIER_USD_LIMIT) {
    return { feeUSD: 0, isZero: true };
  }
  return {
    feeUSD: usdAmount * feeRate,
    isZero: false,
  };
}

// ── Conversion History ────────────────────────────────────────────────────

/**
 * Record a completed FX conversion in the database.
 *
 * @param {string} userId      - KorriPay user ID
 * @param {Object} conversion  - Result object from convertFX()
 * @param {string} [txHash]    - Optional on-chain transaction hash
 */
export async function recordFXConversion(userId, conversion, txHash = null) {
  return prisma.fxConversion.create({
    data: {
      userId,
      fromCurrency:   conversion.input.currency,
      toAsset:        conversion.output.asset,
      inputAmount:    conversion.input.amount,
      outputAmount:   conversion.output.netAmount,
      exchangeRate:   conversion.rate.value,
      feeUSD:         conversion.fee.usdEquivalent,
      feeInOutput:    conversion.fee.inOutputAsset,
      usdEquivalent:  conversion.usdEquivalent,
      rateSource:     conversion.rate.source,
      txHash,
    },
  });
}

/**
 * Retrieve FX conversion history for a given user.
 *
 * @param {string} userId   - KorriPay user ID
 * @param {number} limit    - Max records to return (default 50)
 * @param {number} offset   - Pagination offset (default 0)
 */
export async function getFXHistory(userId, limit = 50, offset = 0) {
  const [records, total] = await Promise.all([
    prisma.fxConversion.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      skip:    offset,
    }),
    prisma.fxConversion.count({ where: { userId } }),
  ]);

  return { records, total, limit, offset };
}

// ── FX Analytics ─────────────────────────────────────────────────────────

/**
 * Aggregate FX analytics for a user over the past N days.
 *
 * @param {string} userId - KorriPay user ID
 * @param {number} days   - Lookback window in days (default 30)
 */
export async function getFXAnalytics(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const records = await prisma.fxConversion.findMany({
    where: {
      userId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (records.length === 0) {
    return {
      totalConversions:   0,
      totalVolumeUSD:     0,
      totalFeesPaidUSD:   0,
      avgRateKRW:         null,
      avgRateNGN:         null,
      currencyBreakdown:  {},
      assetBreakdown:     {},
      dailyVolume:        [],
    };
  }

  // Aggregate
  const totalVolumeUSD  = records.reduce((s, r) => s + r.usdEquivalent, 0);
  const totalFeesPaidUSD = records.reduce((s, r) => s + r.feeUSD, 0);

  // Currency breakdown
  const currencyBreakdown = {};
  const assetBreakdown    = {};

  for (const r of records) {
    currencyBreakdown[r.fromCurrency] = (currencyBreakdown[r.fromCurrency] ?? 0) + r.usdEquivalent;
    assetBreakdown[r.toAsset]         = (assetBreakdown[r.toAsset] ?? 0) + r.outputAmount;
  }

  // Daily volume map
  const dailyMap = {};
  for (const r of records) {
    const day = r.createdAt.toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + r.usdEquivalent;
  }
  const dailyVolume = Object.entries(dailyMap).map(([date, volumeUSD]) => ({ date, volumeUSD: round(volumeUSD, 2) }));

  return {
    totalConversions:   records.length,
    totalVolumeUSD:     round(totalVolumeUSD, 2),
    totalFeesPaidUSD:   round(totalFeesPaidUSD, 4),
    currencyBreakdown,
    assetBreakdown,
    dailyVolume,
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────

function round(value, decimals = 2) {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}
