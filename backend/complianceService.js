import { PrismaClient } from '@prisma/client';
import { fetchLiveRates } from './fxService.js';

const prisma = new PrismaClient();

// Hardcoded crypto prices for USD conversion (approximate fallback rates)
const CRYPTO_PRICES_USD = {
  BTC: 64000.0,
  ETH: 3400.0,
  USDC: 1.0,
  MockKRW: 1 / 1400.0, // ₩1400 = $1
  USD: 1.0,
  KRW: 1 / 1325.50,
  NGN: 1 / 1610.00
};

/**
 * Normalise a currency and amount to its USD equivalent.
 */
export async function convertToUSDEquivalent(amount, currency) {
  const normCurrency = currency.toUpperCase();
  
  // Try using live rates for fiat currencies
  try {
    if (normCurrency === 'USD') return amount;
    
    if (normCurrency === 'KRW' || normCurrency === 'NGN') {
      const rates = await fetchLiveRates();
      const rate = rates[normCurrency];
      if (rate && rate > 0) {
        return amount / rate;
      }
    }
  } catch (err) {
    console.warn('[Compliance] Failed to fetch live rates for USD normalisation, using fallback:', err.message);
  }

  // Fallback to static prices
  const price = CRYPTO_PRICES_USD[normCurrency] || 1.0;
  return amount * price;
}

/**
 * Screen a transaction against compliance rules.
 * 
 * @param {string} userId - User initiating the transaction
 * @param {number} amount - Amount of the transaction
 * @param {string} currency - Currency of the transaction (USD, BTC, etc.)
 * @param {string} txType - Transaction type (send, swap, bill, etc.)
 * @param {string} detailsStr - Description or metadata of the transaction
 * @returns {Promise<{ result: 'Passed' | 'Flagged' | 'Blocked', riskScore: number, riskLevel: 'Low' | 'Medium' | 'High', rulesTriggered: string[], details: string }>}
 */
export async function screenTransaction(userId, amount, currency, txType, detailsStr = '') {
  console.log(`[Compliance Engine] Screening transaction: User=${userId}, Amount=${amount} ${currency}, Type=${txType}`);
  
  // 1. Fetch compliance rules & user profile & user's KYC status
  const [rules, profile, kyc, user] = await Promise.all([
    prisma.complianceRule.findMany(),
    prisma.complianceProfile.findUnique({ where: { userId } }),
    prisma.kyc.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
    prisma.user.findUnique({ where: { id: userId } })
  ]);

  // If user profile doesn't exist, create default one
  let userProfile = profile;
  if (!userProfile) {
    userProfile = await prisma.complianceProfile.create({
      data: {
        userId,
        riskLevel: 'Low',
        kycEnforced: true,
        dailyLimitUSD: 5000.0,
        singleTxLimitUSD: 2000.0,
        suspiciousThresholdUSD: 1000.0
      }
    });
  }

  const kycStatus = kyc ? kyc.status : 'NotStarted';
  const usdAmount = await convertToUSDEquivalent(amount, currency);
  
  let riskScore = 0;
  const rulesTriggered = [];
  const findings = [];
  let finalResult = 'Passed';

  // Helper to check rule activity
  const isRuleActive = (code) => {
    const rule = rules.find(r => r.code === code);
    return rule ? rule.isActive : true;
  };

  // Rule 1: KYC Enforcement
  if (isRuleActive('KYC_ENFORCEMENT') && userProfile.kycEnforced) {
    if (kycStatus !== 'Verified') {
      rulesTriggered.push('KYC_ENFORCEMENT');
      riskScore += 45;
      findings.push('User KYC status is unverified (Current: ' + kycStatus + ').');
      
      // If user profile risk level is already Medium/High, or status is NotStarted, we block
      if (userProfile.riskLevel === 'High' || usdAmount > 50) {
        finalResult = 'Blocked';
      } else {
        if (finalResult !== 'Blocked') finalResult = 'Flagged';
      }
    }
  }

  // Rule 2: Single Transaction Limit (Velocity check)
  if (isRuleActive('VELOCITY_SINGLE_TX')) {
    const rule = rules.find(r => r.code === 'VELOCITY_SINGLE_TX');
    const limit = userProfile.singleTxLimitUSD || (rule ? rule.value : 2000.0);
    
    if (usdAmount > limit) {
      rulesTriggered.push('VELOCITY_SINGLE_TX');
      riskScore += 60;
      findings.push(`Transaction amount $${usdAmount.toFixed(2)} exceeds single transaction limit ($${limit.toFixed(2)}).`);
      finalResult = 'Blocked';
    }
  }

  // Rule 3: Daily cumulative velocity limit
  if (isRuleActive('VELOCITY_DAILY')) {
    const rule = rules.find(r => r.code === 'VELOCITY_DAILY');
    const limit = userProfile.dailyLimitUSD || (rule ? rule.value : 5000.0);

    // Calculate sum of transactions in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pastTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        timestamp: { gte: oneDayAgo.getTime() },
        status: { in: ['Success', 'Pending'] }
      }
    });

    let dailyAccumulatorUSD = 0;
    for (const tx of pastTransactions) {
      const txUsdVal = await convertToUSDEquivalent(tx.amount, 'USD'); // Transaction model amounts in DB are treated as USD equivalent or USD base
      dailyAccumulatorUSD += txUsdVal;
    }

    const projectedDailyUSD = dailyAccumulatorUSD + usdAmount;
    if (projectedDailyUSD > limit) {
      rulesTriggered.push('VELOCITY_DAILY');
      riskScore += 50;
      findings.push(`Cumulative 24h transaction volume $${projectedDailyUSD.toFixed(2)} exceeds daily limit ($${limit.toFixed(2)}).`);
      finalResult = 'Blocked';
    }
  }

  // Rule 4: Suspicious Transaction Detection (Amount thresholds and frequency)
  if (isRuleActive('SUSPICIOUS_TX')) {
    const rule = rules.find(r => r.code === 'SUSPICIOUS_TX');
    const threshold = userProfile.suspiciousThresholdUSD || (rule ? rule.value : 1000.0);

    if (usdAmount > threshold) {
      rulesTriggered.push('SUSPICIOUS_TX');
      riskScore += 30;
      findings.push(`Transaction amount $${usdAmount.toFixed(2)} exceeds the suspicious transaction threshold ($${threshold.toFixed(2)}).`);
      if (finalResult !== 'Blocked') finalResult = 'Flagged';
    }
  }

  // Suspicious Name/Memo check (Blacklist check)
  const blacklistKeywords = ['TORNADO CASH', 'TORNADOCASH', 'BLACKMARKET', 'DARKWEB', 'RANSOMWARE', 'HACK', 'LAUNDERING', 'SILK ROAD'];
  const detailsUpper = detailsStr.toUpperCase();
  for (const keyword of blacklistKeywords) {
    if (detailsUpper.includes(keyword)) {
      rulesTriggered.push('BLACKLIST_MEMO_CHECK');
      riskScore += 80;
      findings.push(`Transaction memo contains blacklisted keyword: "${keyword}".`);
      finalResult = 'Blocked';
      break;
    }
  }

  // Frequency/Rapid Velocity Check
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentTxCount = await prisma.transaction.count({
    where: {
      userId,
      timestamp: { gte: tenMinutesAgo.getTime() }
    }
  });

  if (recentTxCount >= 5) {
    rulesTriggered.push('RAPID_TX_FREQUENCY');
    riskScore += 40;
    findings.push(`High transaction frequency detected (Current: ${recentTxCount + 1} transactions in 10 minutes).`);
    if (finalResult !== 'Blocked') finalResult = 'Flagged';
  }

  // Apply Risk Profile Modifier
  if (userProfile.riskLevel === 'High') {
    riskScore += 20;
    findings.push('User risk profile is flagged as HIGH.');
    if (usdAmount > 200 && finalResult === 'Passed') {
      finalResult = 'Flagged';
      rulesTriggered.push('HIGH_RISK_USER_MODIFIER');
    }
  } else if (userProfile.riskLevel === 'Medium') {
    riskScore += 10;
  }

  // Custom risk bounds
  riskScore = Math.min(100, riskScore);
  
  let computedRiskLevel = 'Low';
  if (riskScore >= 70) {
    computedRiskLevel = 'High';
  } else if (riskScore >= 35) {
    computedRiskLevel = 'Medium';
  }

  const detailsJoined = findings.length > 0 
    ? findings.join(' | ') 
    : 'Transaction passed all active compliance policies.';

  return {
    result: finalResult,
    riskScore,
    riskLevel: computedRiskLevel,
    rulesTriggered,
    details: detailsJoined
  };
}

/**
 * Log a compliance check result in PostgreSQL.
 */
export async function logComplianceCheck(userId, transactionId, amount, currency, screeningResult) {
  try {
    const log = await prisma.complianceLog.create({
      data: {
        userId,
        transactionId: transactionId || null,
        amount,
        currency,
        riskScore: screeningResult.riskScore,
        riskLevel: screeningResult.riskLevel,
        result: screeningResult.result,
        rulesTriggered: JSON.stringify(screeningResult.rulesTriggered),
        details: screeningResult.details
      }
    });

    // If a transaction was blocked or flagged, let's automatically elevate user risk profile if riskScore is high
    if (screeningResult.riskScore >= 75) {
      await prisma.complianceProfile.update({
        where: { userId },
        data: { riskLevel: 'High' }
      });
      console.log(`[Compliance] Automatically elevated user ${userId} risk level to HIGH due to compliance log risk score: ${screeningResult.riskScore}`);
    } else if (screeningResult.riskScore >= 40) {
      // Elevate to Medium if current risk level is Low
      const profile = await prisma.complianceProfile.findUnique({ where: { userId } });
      if (profile && profile.riskLevel === 'Low') {
        await prisma.complianceProfile.update({
          where: { userId },
          data: { riskLevel: 'Medium' }
        });
        console.log(`[Compliance] Automatically elevated user ${userId} risk level to MEDIUM`);
      }
    }

    return log;
  } catch (err) {
    console.error('[Compliance] Failed to log compliance check:', err);
    throw err;
  }
}

/**
 * Generate a Compliance Report summarizing compliance logs and transaction statuses.
 * 
 * @param {string} type - DAILY, SUSPICIOUS, KYC
 * @param {Date} startPeriod
 * @param {Date} endPeriod
 * @returns {Promise<any>}
 */
export async function generateComplianceReport(type, startPeriod, endPeriod) {
  try {
    const query = {
      createdAt: {
        gte: startPeriod,
        lte: endPeriod
      }
    };

    const logs = await prisma.complianceLog.findMany({
      where: query,
      orderBy: { createdAt: 'desc' }
    });

    const totalTx = logs.length;
    const flagged = logs.filter(l => l.result === 'Flagged');
    const blocked = logs.filter(l => l.result === 'Blocked');
    const passed = logs.filter(l => l.result === 'Passed');

    // Risk level breakdowns
    const highRiskLogs = logs.filter(l => l.riskLevel === 'High');
    const medRiskLogs = logs.filter(l => l.riskLevel === 'Medium');
    const lowRiskLogs = logs.filter(l => l.riskLevel === 'Low');

    const rulesCounter = {};
    for (const log of logs) {
      try {
        const rules = JSON.parse(log.rulesTriggered);
        for (const rule of rules) {
          rulesCounter[rule] = (rulesCounter[rule] || 0) + 1;
        }
      } catch (e) {
        // parsing failed or string format
      }
    }

    const summaryData = {
      passedCount: passed.length,
      highRiskCount: highRiskLogs.length,
      mediumRiskCount: medRiskLogs.length,
      lowRiskCount: lowRiskLogs.length,
      rulesTriggeredSummary: rulesCounter,
      averageRiskScore: totalTx > 0 ? (logs.reduce((sum, l) => sum + l.riskScore, 0) / totalTx) : 0,
      timestamp: new Date().toISOString()
    };

    const title = `${type.toUpperCase()} Compliance Audit Report - ${new Date().toLocaleDateString()}`;

    const report = await prisma.complianceReport.create({
      data: {
        name: title,
        type,
        startPeriod,
        endPeriod,
        totalTransactions: totalTx,
        flaggedCount: flagged.length,
        blockedCount: blocked.length,
        summaryData: JSON.stringify(summaryData),
        generatedBy: 'System Compliance Engine'
      }
    });

    return report;
  } catch (err) {
    console.error('[Compliance] Failed to generate compliance report:', err);
    throw err;
  }
}
