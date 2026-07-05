import express from 'express';
import { PrismaClient } from '@prisma/client';
import { screenTransaction, logComplianceCheck, generateComplianceReport } from './complianceService.js';

const prisma = new PrismaClient();
export const db = prisma;
export const complianceOverrides = {
  generateComplianceReport: null
};
const router = express.Router();

// Helper middleware to ensure the user is authenticated (similar to requireAuth in server.js)
// In server.js, the requireAuth middleware adds req.user and req.userId to the request.
// This router will be mounted on /api/compliance and will already be protected.

/**
 * GET /api/compliance/profile
 * Retrieve current user's risk level, limits and KYC compliance status.
 */
/**
 * GET /api/compliance/passport
 * Retrieve user's dynamic Compliance Passport details.
 */
router.get('/passport', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch user and profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true, role: true }
    });

    let profile = await prisma.complianceProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      profile = await prisma.complianceProfile.create({
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

    const kyc = await prisma.kyc.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
    const kycStatus = kyc ? kyc.status : 'NotStarted';

    // Fetch active attestations
    const walletAddress = user?.walletAddress || "";
    let attestations = [];
    if (walletAddress) {
      attestations = await prisma.attestation.findMany({
        where: {
          subjectWallet: {
            equals: walletAddress,
            mode: 'insensitive'
          }
        }
      });
    }

    const identityAtt = attestations.find(a => a.schema === 'Identity' && a.status === 'Active');
    const merchantAtt = attestations.find(a => a.schema === 'Merchant' && a.status === 'Active');
    const businessAtt = attestations.find(a => a.schema === 'Business' && a.status === 'Active');
    const travelRuleAtt = attestations.find(a => a.schema === 'Compliance' && a.status === 'Active');

    // Calculate Identity Status
    let identityStatus = 'Unverified';
    if (identityAtt) {
      identityStatus = 'Verified';
    } else if (kycStatus === 'Verified') {
      identityStatus = 'Verified';
    } else if (kycStatus === 'Pending') {
      identityStatus = 'Pending';
    }

    // Calculate Merchant Status
    let merchantStatus = 'Unverified';
    if (merchantAtt) {
      merchantStatus = 'Verified';
    } else if (user?.role === 'MERCHANT') {
      merchantStatus = 'Verified';
    }

    // Calculate Business Status
    let businessStatus = businessAtt ? 'Verified' : 'Unverified';

    // Calculate Compliance Level
    let complianceLevel = 'Tier 1';
    if (profile.dailyLimitUSD > 50000) {
      complianceLevel = 'Tier 3';
    } else if (profile.dailyLimitUSD > 5000) {
      complianceLevel = 'Tier 2';
    }

    // Calculate Risk Score (out of 100)
    let riskScore = 15;
    if (profile.riskLevel === 'Medium') {
      riskScore = 45;
    } else if (profile.riskLevel === 'High') {
      riskScore = 80;
    }

    // Calculate Travel Rule Status
    let travelRuleStatus = 'Pending Verification';
    if (travelRuleAtt) {
      travelRuleStatus = 'Compliant';
    } else if (identityStatus === 'Verified') {
      travelRuleStatus = 'Compliant';
    }

    res.json({
      success: true,
      identityStatus,
      merchantStatus,
      businessStatus,
      complianceLevel,
      riskScore,
      settlementLimit: profile.dailyLimitUSD,
      travelRuleStatus,
      profile
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let profile = await prisma.complianceProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      profile = await prisma.complianceProfile.create({
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

    const kyc = await prisma.kyc.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      profile,
      kycStatus: kyc ? kyc.status : 'NotStarted'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/compliance/profile/update
 * Update risk profile details (simulates compliance officer controls / user testing panel).
 */
router.post('/profile/update', async (req, res) => {
  try {
    const userId = req.userId;
    const { riskLevel, kycEnforced, dailyLimitUSD, singleTxLimitUSD, suspiciousThresholdUSD } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const updateData = {};
    if (riskLevel !== undefined) updateData.riskLevel = riskLevel;
    if (kycEnforced !== undefined) updateData.kycEnforced = kycEnforced;
    if (dailyLimitUSD !== undefined) updateData.dailyLimitUSD = Number(dailyLimitUSD);
    if (singleTxLimitUSD !== undefined) updateData.singleTxLimitUSD = Number(singleTxLimitUSD);
    if (suspiciousThresholdUSD !== undefined) updateData.suspiciousThresholdUSD = Number(suspiciousThresholdUSD);

    const updatedProfile = await prisma.complianceProfile.update({
      where: { userId },
      data: updateData
    });

    res.json({ message: "Risk profile updated successfully", profile: updatedProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/compliance/rules
 * Fetch all global compliance screening rules.
 */
router.get('/rules', async (req, res) => {
  try {
    const rules = await prisma.complianceRule.findMany({
      orderBy: { code: 'asc' }
    });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/compliance/rules/toggle
 * Toggle the status (active/inactive) or parameters of a compliance rule.
 */
router.post('/rules/toggle', async (req, res) => {
  try {
    const { code, isActive, value } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Rule code is required" });
    }

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (value !== undefined) updateData.value = Number(value);

    const updatedRule = await prisma.complianceRule.update({
      where: { code },
      data: updateData
    });

    res.json({ message: `Rule ${code} updated successfully`, rule: updatedRule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/compliance/logs
 * Retrieve system-wide or user-specific compliance screening logs.
 */
router.get('/logs', async (req, res) => {
  try {
    const userId = req.userId;
    // We can fetch all compliance logs to display in the compliance feed, or just user specific logs.
    // For a comprehensive compliance overview, let's fetch the logs of the current user, or let's support viewing all logs for the compliance center.
    const { all } = req.query;

    const query = {};
    if (all !== 'true' && userId) {
      query.userId = userId;
    }

    const logs = await prisma.complianceLog.findMany({
      where: query,
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Populate user names if displaying all logs
    const logsWithUser = await Promise.all(logs.map(async (log) => {
      const user = await prisma.user.findUnique({
        where: { id: log.userId },
        select: { name: true, walletAddress: true }
      });
      return {
        ...log,
        userName: user ? user.name : 'Unknown User',
        walletAddress: user ? user.walletAddress : '0x0000...0000'
      };
    }));

    res.json(logsWithUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/compliance/reports/generate
 * Trigger compilation of a compliance audit report.
 */
router.post('/reports/generate', async (req, res) => {
  try {
    const { type, days } = req.body;
    const lookbackDays = Number(days || 30);
    const reportType = type || 'DAILY'; // DAILY, SUSPICIOUS, KYC

    const startPeriod = new Date();
    startPeriod.setDate(startPeriod.getDate() - lookbackDays);
    const endPeriod = new Date();

    const report = await (complianceOverrides.generateComplianceReport || generateComplianceReport)(reportType, startPeriod, endPeriod);

    res.json({ message: "Report generated successfully", report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/compliance/reports
 * Fetch all compliance reports.
 */
router.get('/reports', async (req, res) => {
  try {
    const reports = await prisma.complianceReport.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/compliance/reports/:id
 * Retrieve detail analysis of a specific report.
 */
router.get('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await prisma.complianceReport.findUnique({
      where: { id }
    });

    if (!report) {
      return res.status(404).json({ error: "Compliance report not found" });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
