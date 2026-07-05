import { Router } from 'express';
import { ethers } from 'ethers';

import { PrismaClient } from '@prisma/client';
import { settlementService } from './src/services/settlementService.js';
import { attestationService } from './src/services/attestationService.js';
import { screenTransaction, logComplianceCheck } from './complianceService.js';
import { recipientResolver } from './src/services/recipientResolver.js';
import { serviceRegistry } from './src/giwa/serviceRegistry.js';
import { attestationAggregator } from './src/services/attestationAdapter.js';
import { trustScoreEngine } from './src/services/trustScoreService.js';
import { webhookService } from './src/services/webhookService.js';
import { treasuryService } from './src/services/treasuryService.js';
import { organizationService } from './src/services/organizationService.js';
import { networkIntelligence } from './src/services/networkIntelligenceService.js';

const router = Router();
const prisma = new PrismaClient();

// Helper to format date strings
const getFormattedDate = () => {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * @openapi
 * /api/v1/settlements:
 *   post:
 *     summary: Create a new settlement request
 *     description: Validates and screens user balance, logs compliance parameters, and initiates an L2 settlement.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient
 *               - amount
 *             properties:
 *               recipient:
 *                 type: string
 *                 description: Name of the recipient
 *               amount:
 *                 type: number
 *                 description: Transfer amount in USD
 *               recipientAddress:
 *                 type: string
 *                 description: Optional recipient EVM L2 address
 *               txHash:
 *                 type: string
 *                 description: Optional existing Ethereum transaction hash
 *               status:
 *                 type: string
 *                 default: Success
 *     responses:
 *       201:
 *         description: Settlement request initiated successfully
 *       400:
 *         description: Validation failed or compliance screen blocked the request
 *       500:
 *         description: Internal Server Error
 */
router.post('/settlements', async (req, res) => {
  try {
    const { recipient, amount, txHash, status, recipientAddress } = req.body;
    const numAmount = Number(amount);

    if (!recipient || recipient.trim() === '') {
      return res.status(400).json({ error: "Recipient name is required" });
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount. Must be greater than 0." });
    }

    // Run Compliance Screen
    const screening = await screenTransaction(
      req.userId,
      numAmount,
      'USD',
      'send',
      `v1: Sent to ${recipient.trim()} (${recipientAddress || ''})`
    );

    // Validate transfer
    let wallet;
    try {
      wallet = await settlementService.validateTransfer(req.user.id, numAmount, 'USD', screening);
    } catch (valErr) {
      if (screening.result === 'Blocked') {
        await logComplianceCheck(req.userId, null, numAmount, 'USD', screening);
        return res.status(400).json({
          error: valErr.message,
          complianceBlocked: true,
          screening
        });
      }
      return res.status(400).json({ error: valErr.message });
    }

    const txStatus = status || "Success";

    // Deduct available USD
    if (txStatus !== "Failed") {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { usdAvailable: { decrement: numAmount } }
      });
    }

    let title = `Sent to ${recipient.trim()}`;
    if (txStatus === "Pending") {
      title = `Sending to ${recipient.trim()}`;
    } else if (txStatus === "Failed") {
      title = `Failed to ${recipient.trim()}`;
    }

    // Log transaction
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

    // Create settlement request
    const settlement = await settlementService.createSettlementRequest({
      initiator: req.user.walletAddress || "0x0000000000000000000000000000000000000000",
      fromToken: "0x0000000000000000000000000000000000000000",
      toToken: recipientAddress || "0x0000000000000000000000000000000000000000",
      amount: numAmount,
      recipientDetails: `v1: Recipient: ${recipient.trim()} (${recipientAddress || ''})`,
      txHash: txHash || null
    });

    await logComplianceCheck(req.userId, newTx.id, numAmount, 'USD', screening);

    res.status(201).json({
      success: true,
      settlementId: settlement.id,
      transaction: newTx,
      settlement,
      screening
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/settlements:
 *   get:
 *     summary: Retrieve settlement requests
 *     description: Fetches settlement requests associated with the authenticated user, or all settlements for admin/compliance roles.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of settlements
 *       500:
 *         description: Internal Server Error
 */
router.get('/settlements', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'COMPLIANCE';
    const query = {};

    if (!isAdmin && req.user.walletAddress) {
      query.OR = [
        { initiator: { equals: req.user.walletAddress, mode: 'insensitive' } },
        { toToken: { equals: req.user.walletAddress, mode: 'insensitive' } }
      ];
    }

    const list = await prisma.settlement.findMany({
      where: query,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, settlements: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/proofs:
 *   get:
 *     summary: Retrieve settlement proofs
 *     description: List or filter settlement proofs stored on PostgreSQL.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: settlementId
 *         schema:
 *           type: string
 *         description: Filter proof details by Settlement ID
 *     responses:
 *       200:
 *         description: List of settlement proofs
 *       500:
 *         description: Internal Server Error
 */
router.get('/proofs', async (req, res) => {
  try {
    const { settlementId } = req.query;
    const query = {};
    if (settlementId) {
      query.settlementId = settlementId;
    }

    const list = await prisma.settlementProof.findMany({
      where: query
    });

    res.json({ success: true, proofs: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/wallets:
 *   get:
 *     summary: Retrieve user wallets
 *     description: Get current balances (USD, NGN, KRW, MockKRW) and crypto balance caches for the user.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Multi-currency wallet object
 *       500:
 *         description: Internal Server Error
 */
router.get('/wallets', async (req, res) => {
  try {
    let wallet = await prisma.wallet.findUnique({
      where: { userId: req.userId }
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: req.userId,
          usdAvailable: 1250.00,
          mockkrwAvailable: 500000.00,
        }
      });
    }

    // Retrieve live on-chain balances if network is reachable and wallet address is registered
    let walletAddress = req.user?.walletAddress;
    if (!walletAddress) {
      const dbUser = await prisma.user.findUnique({ where: { id: req.userId } });
      if (dbUser) {
        walletAddress = dbUser.walletAddress;
      }
    }

    if (settlementService.provider && walletAddress) {
      try {
        const mockkrwAddress = '0xdB281c7e997fE762888DDC80509653152778A699';
        const usdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

        const abi = [
          "function balanceOf(address owner) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ];

        const mockKrwContract = new ethers.Contract(mockkrwAddress, abi, settlementService.provider);
        const usdcContract = new ethers.Contract(usdcAddress, abi, settlementService.provider);

        const [krwBal, usdcBal] = await Promise.all([
          mockKrwContract.balanceOf(walletAddress).catch(() => null),
          usdcContract.balanceOf(walletAddress).catch(() => null)
        ]);

        const updateData = {};
        if (krwBal !== null) {
          updateData.mockkrwAvailable = parseFloat(ethers.formatUnits(krwBal, 18));
        }
        if (usdcBal !== null) {
          updateData.usdcBalance = parseFloat(ethers.formatUnits(usdcBal, 6));
        }

        if (Object.keys(updateData).length > 0) {
          wallet = await prisma.wallet.update({
            where: { id: wallet.id },
            data: updateData
          });
        }
      } catch (err) {
        console.warn("[API V1] Failed to query or cache on-chain balances:", err.message);
      }
    }

    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        savings: wallet.savings,
        balances: {
          USD: { available: wallet.usdAvailable, locked: wallet.usdLocked, pending: wallet.usdPending },
          KRW: { available: wallet.krwAvailable, locked: wallet.krwLocked, pending: wallet.krwPending },
          NGN: { available: wallet.ngnAvailable, locked: wallet.ngnLocked, pending: wallet.ngnPending },
          MockKRW: { available: wallet.mockkrwAvailable, locked: wallet.mockkrwLocked, pending: wallet.mockkrwPending }
        },
        crypto: {
          BTC: wallet.btcBalance,
          ETH: wallet.ethBalance,
          USDC: wallet.usdcBalance
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/attestations:
 *   get:
 *     summary: List user attestations
 *     description: Retrieves the active compliance/schema attestations filtered by schema or wallet.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: schema
 *         schema:
 *           type: string
 *           enum: [Identity, Merchant, Business, Payroll, Compliance]
 *         description: Schema category to filter by
 *       - in: query
 *         name: subjectWallet
 *         schema:
 *           type: string
 *         description: EVM wallet address to filter by
 *     responses:
 *       200:
 *         description: List of matching attestations
 *       500:
 *         description: Internal Server Error
 */
router.get('/attestations', async (req, res) => {
  try {
    const { schema, subjectWallet } = req.query;
    const filter = {};
    if (schema) filter.schema = schema;
    if (subjectWallet) {
      filter.subjectWallet = { equals: subjectWallet, mode: 'insensitive' };
    } else {
      // Default to returning user's own wallet attestations if no filter
      if (req.user.walletAddress) {
        filter.subjectWallet = { equals: req.user.walletAddress, mode: 'insensitive' };
      } else {
        filter.subjectWallet = "";
      }
    }

    const list = await attestationService.listAttestations(filter);
    res.json({ success: true, attestations: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/trust/attestations:
 *   get:
 *     summary: List aggregated trust center attestations (EAS & Dojang)
 *     description: Retrieve all active identity, merchant, business, and compliance attestations across providers.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Aggregated list of verified attestations
 */
router.get('/trust/attestations', async (req, res) => {
  try {
    const { subjectWallet } = req.query;
    const wallet = subjectWallet || req.user.walletAddress;
    const list = await attestationAggregator.getAllAttestations(wallet);
    res.json({ success: true, attestations: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/trust/score:
 *   get:
 *     summary: Retrieve dynamic trust score and history trends
 *     description: Calculates dynamic 0-100 score based on identity, settlement history, merchant performance, compliance, wallet age, and transactions.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Trust score details and historical snapshot trend list
 */
router.get('/trust/score', async (req, res) => {
  try {
    const { subjectWallet } = req.query;
    const wallet = subjectWallet || req.user.walletAddress;
    const score = await trustScoreEngine.calculateScore(wallet);
    const history = await trustScoreEngine.getScoreHistory(wallet);
    res.json({ success: true, score, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/attestations:
 *   post:
 *     summary: Issue a new attestation
 *     description: Store a new verified schema attestation (Identity, Merchant, Business, Payroll, or Compliance) for a subject wallet.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - issuer
 *               - subjectWallet
 *               - schema
 *             properties:
 *               issuer:
 *                 type: string
 *                 description: EVM wallet address of the issuer
 *               subjectWallet:
 *                 type: string
 *                 description: EVM wallet address of the subject
 *               schema:
 *                 type: string
 *                 enum: [Identity, Merchant, Business, Payroll, Compliance]
 *               details:
 *                 type: object
 *                 description: Arbitrary JSON metadata relating to the attestation schema
 *     responses:
 *       201:
 *         description: Attestation created successfully
 *       400:
 *         description: Validation failed
 *       500:
 *         description: Internal Server Error
 */
router.post('/attestations', async (req, res) => {
  try {
    const { issuer, subjectWallet, schema, details } = req.body;
    const att = await attestationService.createAttestation({
      issuer,
      subjectWallet,
      schema,
      details
    });

    res.status(201).json({ success: true, attestation: att });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/settlements/{id}:
 *   get:
 *     summary: Retrieve a single settlement request
 *     description: Fetches details of a specific settlement request by ID or transaction hash.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID or transaction hash
 *     responses:
 *       200:
 *         description: Settlement details
 *       404:
 *         description: Settlement not found
 *       500:
 *         description: Internal Server Error
 */
router.get('/settlements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let settlement = await prisma.settlement.findUnique({
      where: { id }
    });

    if (!settlement) {
      settlement = await prisma.settlement.findFirst({
        where: {
          OR: [
            { txHash: id },
            { confirmedTxHash: id }
          ]
        }
      });
    }

    if (!settlement) {
      return res.status(404).json({ error: "Settlement not found" });
    }

    res.json({ success: true, settlement });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/identity/verify:
 *   post:
 *     summary: Verify or update user identity status (KYC)
 *     description: Submit verification data to verify identity. Sets KYC status in the database.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Verified, Pending, Failed, NotStarted]
 *     responses:
 *       200:
 *         description: Identity verification updated
 *       400:
 *         description: Status missing or invalid
 *       500:
 *         description: Internal Server Error
 */
router.post('/identity/verify', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const validStatuses = ["Verified", "Pending", "Failed", "NotStarted"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

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

    res.json({
      success: true,
      message: "Identity status updated",
      kyc: updatedKyc
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/recipients/resolve:
 *   get:
 *     summary: Resolve a recipient query string
 *     description: Parses and resolves a wallet address, username, or up.id name using the extensible Recipient Resolver Service.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address, username (e.g. @john), or up.id name (e.g. john.up.id)
 *     responses:
 *       200:
 *         description: Recipient resolution result
 *       400:
 *         description: Query is required
 *       500:
 *         description: Internal Server Error
 */
router.get('/recipients/resolve', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    const result = await recipientResolver.resolveRecipient(query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/giwa/services:
 *   get:
 *     summary: Retrieve registered GIWA ecosystem services
 *     description: Returns a list of all registered GIWA ecosystem providers along with their health statuses and latency metrics.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of registered GIWA services
 *       500:
 *         description: Internal Server Error
 */
router.get('/giwa/services', async (req, res) => {
  try {
    await serviceRegistry.checkAllHealth();
    res.json({
      timestamp: new Date(),
      services: serviceRegistry.getAllProviders()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/network:
 *   get:
 *     summary: Retrieve GIWA network intelligence status and history
 *     description: Returns current network performance metrics and historical snapshots.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current GIWA network status and history
 *       500:
 *         description: Internal Server Error
 */
router.get('/network', async (req, res) => {
  try {
    const status = await networkIntelligence.getCurrentStatusFromDB();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Webhooks Management Endpoints ──────────────────────────────────────────

/**
 * @openapi
 * /api/v1/webhooks:
 *   get:
 *     summary: List all active webhook subscriptions
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of subscriptions
 */
router.get('/webhooks', async (req, res) => {
  try {
    const list = await webhookService.getSubscriptions();
    res.json({ success: true, subscriptions: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/webhooks:
 *   post:
 *     summary: Register a new webhook subscription
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Webhook subscription created
 */
router.post('/webhooks', async (req, res) => {
  try {
    const { url, events } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });
    const sub = await webhookService.createSubscription(url, events || ['*']);
    res.status(201).json({ success: true, subscription: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/webhooks/{id}/rotate:
 *   post:
 *     summary: Rotate webhook signing secret
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Secret rotated
 */
router.post('/webhooks/:id/rotate', async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await webhookService.rotateSecret(id);
    res.json({ success: true, subscription: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/webhooks/{id}:
 *   delete:
 *     summary: Delete a webhook subscription
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Subscription deleted
 */
router.delete('/webhooks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await webhookService.deleteSubscription(id);
    res.json({ success: true, message: "Subscription deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/webhooks/logs:
 *   get:
 *     summary: Retrieve delivery logs
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of delivery logs
 */
router.get('/webhooks/logs', async (req, res) => {
  try {
    const logs = await webhookService.getDeliveryLogs();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/webhooks/test:
 *   post:
 *     summary: Fire a manual test event to all active endpoints
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Test event dispatched
 */
router.post('/webhooks/test', async (req, res) => {
  try {
    const { event, payload } = req.body;
    const testEvent = event || 'settlement.completed';
    const testPayload = payload || {
      id: "evt_test_" + Math.random().toString(36).substr(2, 9),
      event: testEvent,
      created: new Date().toISOString(),
      data: {
        settlementId: "settlement-test-mock",
        amount: "5000",
        token: "USDC",
        status: "Completed"
      }
    };
    await webhookService.dispatchEvent(testEvent, testPayload);
    res.json({ success: true, message: `Dispatched test event: ${testEvent}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/v1/treasury/metrics:
 *   get:
 *     summary: Retrieve real-time treasury and reserve metrics
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Real-time volume, reserves, liabilities, velocity, and ratio analytics
 */
router.get('/treasury/metrics', async (req, res) => {
  try {
    const metrics = await treasuryService.getMetrics();
    res.json({ success: true, metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Corporate Organization & Team Endpoints ─────────────────────────────────

// Helper middleware to get member's active organization ID from request user
async function getActiveOrg(req, res, next) {
  try {
    const userId = req.userId || (req.user && req.user.id);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Session required." });
    }
    const member = await prisma.orgMember.findFirst({
      where: { userId }
    });
    if (!member) {
      return res.status(200).json({ success: true, organization: null });
    }
    req.orgId = member.orgId;
    req.memberRole = member.role;
    req.memberLimit = member.dailySettlementLimit;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 1. Get my organization details
router.get('/organizations/my-org', getActiveOrg, async (req, res) => {
  try {
    const org = await organizationService.getOrganizationDetails(req.orgId);
    res.json({ success: true, organization: org, currentMember: { role: req.memberRole, limit: req.memberLimit } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create organization
router.post('/organizations', async (req, res) => {
  try {
    const { name, taxId } = req.body;
    const userId = req.userId || (req.user && req.user.id);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Session required." });
    }
    const org = await organizationService.createOrganization(name, taxId, userId);
    res.json({ success: true, organization: org });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Add organization member
router.post('/organizations/members', getActiveOrg, async (req, res) => {
  try {
    const { email, role, dailyLimit } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "User with this email address does not exist." });
    }
    const userId = req.userId || (req.user && req.user.id);
    const member = await organizationService.addMember(req.orgId, user.id, role, parseFloat(dailyLimit), userId);
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update organization member limit/role
router.put('/organizations/members/:userId', getActiveOrg, async (req, res) => {
  try {
    const { role, dailyLimit } = req.body;
    const userId = req.userId || (req.user && req.user.id);
    const updated = await organizationService.updateMember(req.orgId, req.params.userId, role, parseFloat(dailyLimit), userId);
    res.json({ success: true, member: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Remove member from organization
router.delete('/organizations/members/:userId', getActiveOrg, async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user.id);
    await organizationService.removeMember(req.orgId, req.params.userId, userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Initiate corporate settlement
router.post('/organizations/settlements', getActiveOrg, async (req, res) => {
  try {
    const { fromToken, toToken, amount, recipientDetails } = req.body;
    const userId = req.userId || (req.user && req.user.id);
    const result = await organizationService.initiateOrgSettlement(
      req.orgId,
      userId,
      fromToken,
      toToken,
      amount,
      recipientDetails
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Decide approval request
router.post('/organizations/approvals/:approvalId', getActiveOrg, async (req, res) => {
  try {
    const { status } = req.body; // "APPROVED" or "REJECTED"
    const userId = req.userId || (req.user && req.user.id);
    const result = await organizationService.decideApproval(
      req.orgId,
      req.params.approvalId,
      userId,
      status
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
