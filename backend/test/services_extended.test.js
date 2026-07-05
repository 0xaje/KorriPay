import { expect } from 'chai';
import { settlementService } from '../src/services/settlementService.js';
import { attestationService } from '../src/services/attestationService.js';
import { screenTransaction, logComplianceCheck, generateComplianceReport, convertToUSDEquivalent } from '../complianceService.js';
import { networkIntelligence } from '../src/services/networkIntelligenceService.js';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';


const prisma = new PrismaClient();

describe('KorriPay Extended Service Logic Tests', () => {
  let testUser;
  let testAttestation;

  before(async () => {
    // Setup test user
    testUser = await prisma.user.create({
      data: {
        name: "Extended Service User",
        email: `ext_service_${Date.now()}@korripay.com`,
        walletAddress: `0xext${Math.random().toString(16).substring(2, 38)}`
      }
    });

    // Ensure compliance rules exist
    await prisma.complianceRule.upsert({
      where: { code: 'KYC_ENFORCEMENT' },
      update: { isActive: true },
      create: { code: 'KYC_ENFORCEMENT', name: 'KYC Enforcement', isActive: true, description: 'Enforce KYC' }
    });
  });

  after(async () => {
    if (testAttestation) {
      await prisma.attestation.delete({ where: { id: testAttestation.id } }).catch(() => {});
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    networkIntelligence.stopSnapshotLoop();
    await prisma.$disconnect();
  });

  describe('Attestation Abstraction Service', () => {
    it('should create a valid payroll/identity attestation and dispatch webhook event', async () => {
      testAttestation = await attestationService.createAttestation({
        issuer: '0x1111111111111111111111111111111111111111',
        subjectWallet: testUser.walletAddress,
        schema: 'Identity',
        details: { verifiedName: "Extended Service User", countryOfOrigin: "NG" }
      });

      expect(testAttestation.id).to.not.be.undefined;
      expect(testAttestation.schema).to.equal('Identity');
      expect(testAttestation.status).to.equal('Active');
    });

    it('should list attestations filtered by subject and schema', async () => {
      const list = await attestationService.listAttestations({
        subjectWallet: testUser.walletAddress,
        schema: 'Identity',
        status: 'Active'
      });

      expect(list.length).to.be.greaterThan(0);
      expect(list[0].id).to.equal(testAttestation.id);
    });

    it('should verify and then revoke an attestation', async () => {
      const verifyRes = await attestationService.verifyAttestation(testAttestation.id);
      expect(verifyRes.valid).to.be.true;

      const revoked = await attestationService.revokeAttestation(testAttestation.id);
      expect(revoked.status).to.equal('Revoked');

      const verifyRevoked = await attestationService.verifyAttestation(testAttestation.id);
      expect(verifyRevoked.valid).to.be.false;
    });
  });

  describe('Compliance Engine Service', () => {
    it('should convert fiat/crypto balances to USD equivalents', async () => {
      const btcUSD = await convertToUSDEquivalent(1, 'BTC');
      expect(btcUSD).to.equal(64000.0);

      const usdUSD = await convertToUSDEquivalent(100, 'USD');
      expect(usdUSD).to.equal(100);
    });

    it('should screen transactions and block blacklisted keywords', async () => {
      const screenRes = await screenTransaction(
        testUser.id,
        500,
        'USD',
        'send',
        'Tornado Cash interaction'
      );

      expect(screenRes.result).to.equal('Blocked');
      expect(screenRes.rulesTriggered).to.include('BLACKLIST_MEMO_CHECK');
    });

    it('should screen transactions and flag user with high frequency transfers', async () => {
      // Create 5 dummy transactions within 10 minutes
      await prisma.transaction.createMany({
        data: Array.from({ length: 5 }).map((_, i) => ({
          id: `ext-tx-${i}-${Date.now()}`,
          title: `Transfer ${i}`,
          amount: 10,
          type: 'send',
          date: new Date().toLocaleDateString(),
          timestamp: Date.now() - 60000,
          userId: testUser.id,
          category: 'Transfer'
        }))
      });

      const screenRes = await screenTransaction(
        testUser.id,
        20,
        'USD',
        'send',
        'Regular transaction'
      );

      expect(screenRes.rulesTriggered).to.include('RAPID_TX_FREQUENCY');
      expect(screenRes.result).to.equal('Flagged'); // KYC unverified + frequency
    });

    it('should compile and store automated compliance audit reports', async () => {
      // Seed a compliance log
      await logComplianceCheck(testUser.id, null, 250, 'USD', {
        riskScore: 85,
        riskLevel: 'High',
        result: 'Blocked',
        rulesTriggered: ['BLACKLIST_MEMO_CHECK'],
        details: 'Blocked keyword'
      });

      const start = new Date(Date.now() - 3600000);
      const end = new Date();
      const report = await generateComplianceReport('DAILY', start, end);

      expect(report.id).to.not.be.undefined;
      expect(report.totalTransactions).to.be.greaterThan(0);
      expect(report.blockedCount).to.be.greaterThan(0);
    });
  });

  describe('Settlement Pipeline & Proof Engine', () => {
    before(async () => {
      await settlementService.initProvider();
    });

    it('should calculate transfer validation under compliance screening status', async () => {
      const screening = {
        result: 'Passed',
        riskScore: 10,
        riskLevel: 'Low',
        rulesTriggered: [],
        details: 'Pass'
      };

      // Set up available balances
      await prisma.wallet.upsert({
        where: { userId: testUser.id },
        update: { usdAvailable: 200 },
        create: { userId: testUser.id, usdAvailable: 200 }
      });

      const wallet = await settlementService.validateTransfer(testUser.id, 50, 'USD', screening);
      expect(wallet.usdAvailable).to.be.greaterThanOrEqual(50);
    });

    it('should run state machine stages and generate cryptographic settlement proofs', async () => {
      const req = await settlementService.createSettlementRequest({
        initiator: testUser.id,
        fromToken: 'USD',
        toToken: 'MockKRW',
        amount: '0.001',
        recipientDetails: '0xrecipientaddress',
        txHash: '0xmocktxhash'
      });

      expect(req.status).to.equal('Pending');

      // Transition stages
      const t1 = await settlementService.transitionStage(req.id, 'Compliance Screening');
      expect(t1.pipelineStage).to.equal('Compliance Screening');

      // Generate proof
      const proof = await settlementService.generateSettlementProof(req);
      expect(proof.id).to.not.be.undefined;
      expect(proof.settlementId).to.equal(req.id);
      expect(proof.proofStatus).to.equal("Valid");
    });

    it('should run and await the full state machine happy path', async () => {
      const req = await settlementService.createSettlementRequest({
        initiator: testUser.id,
        fromToken: 'USD',
        toToken: 'MockKRW',
        amount: '0.001',
        recipientDetails: '0xrecipientaddress',
        txHash: '0xmocktxhash'
      });

      await settlementService.runPipelineStateMachine(req.id, {
        initiator: testUser.id,
        amount: '0.001',
        recipientDetails: '0xrecipientaddress',
        txHash: '0xmocktxhash'
      });

      const updated = await prisma.settlement.findUnique({ where: { id: req.id } });
      expect(updated.status).to.equal('Completed');
      expect(updated.pipelineStage).to.equal('Archive');
    });

    it('should run and await the blocked state machine path when amount is > 10000', async () => {
      const req = await settlementService.createSettlementRequest({
        initiator: testUser.id,
        fromToken: 'USD',
        toToken: 'MockKRW',
        amount: '15000',
        recipientDetails: '0xrecipientaddress',
        txHash: '0xmocktxhash'
      });

      await settlementService.runPipelineStateMachine(req.id, {
        initiator: testUser.id,
        amount: '15000',
        recipientDetails: '0xrecipientaddress',
        txHash: '0xmocktxhash'
      });

      const updated = await prisma.settlement.findUnique({ where: { id: req.id } });
      expect(updated.status).to.equal('Failed');
      expect(updated.pipelineStage).to.equal('Compliance Screening Blocked');
    });

    it('should broadcast transaction and track confirmations to completion', async () => {
      const req = await settlementService.createSettlementRequest({
        initiator: testUser.id,
        fromToken: 'USD',
        toToken: 'MockKRW',
        amount: '0.001',
        recipientDetails: '0xrecipientaddress',
        txHash: '0xmocktxhash'
      });

      let txHash = '0xnewtxhash';
      console.log("[TEST DEBUG] settlementService.provider status:", settlementService.provider !== null);
      if (settlementService.provider) {
        try {
          const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', settlementService.provider);
          const tx = await wallet.sendTransaction({
            to: '0x0000000000000000000000000000000000000000',
            value: 0
          });
          txHash = tx.hash;
          console.log("[TEST DEBUG] Real transaction sent successfully:", txHash);
        } catch (e) {
          console.log("[TEST DEBUG] Failed to send real transaction:", e.message);
        }
      }

      const updated = await settlementService.broadcastTransaction(req.id, txHash);
      expect(updated.txHash).to.equal(txHash);

      // Poll the database until status is Completed or we timeout after 10 seconds
      let confirmed;
      for (let i = 0; i < 20; i++) {
        confirmed = await prisma.settlement.findUnique({ where: { id: req.id } });
        if (confirmed.status === 'Completed' || confirmed.status === 'Failed') {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      expect(confirmed.status).to.equal('Completed');
    });

    it('should handle errors in the state machine catch block when transitionStage throws', async () => {
      const req = await settlementService.createSettlementRequest({
        initiator: testUser.id,
        fromToken: 'USD',
        toToken: 'MockKRW',
        amount: '0.001',
        recipientDetails: '0xrecipientaddress',
        txHash: '0xmocktxhash'
      });

      const originalTransitionStage = settlementService.transitionStage;
      settlementService.transitionStage = async () => { throw new Error("Mocked transition failure"); };

      try {
        await settlementService.runPipelineStateMachine(req.id, {
          initiator: testUser.id,
          amount: '0.001',
          recipientDetails: '0xrecipientaddress',
          txHash: '0xmocktxhash'
        });
      } finally {
        settlementService.transitionStage = originalTransitionStage;
      }

      const updated = await prisma.settlement.findUnique({ where: { id: req.id } });
      expect(updated.status).to.equal('Failed');
    });
  });

  describe('Webhook Service Operations', () => {
    let sub;
    let originalFetch;
    let webhookServiceInstance;

    before(async () => {
      originalFetch = global.fetch;
      // Dynamically import webhookService to ensure freshness
      const mod = await import('../src/services/webhookService.js');
      webhookServiceInstance = mod.webhookService;
    });

    after(() => {
      global.fetch = originalFetch;
    });

    it('should create, retrieve, toggle, rotate, and delete subscriptions', async () => {
      // 1. Create
      sub = await webhookServiceInstance.createSubscription('http://localhost:8888/hook', ['settlement.completed', '*']);
      expect(sub.id).to.not.be.undefined;
      expect(sub.events).to.equal('settlement.completed,*');

      // 2. Retrieve
      const list = await webhookServiceInstance.getSubscriptions();
      expect(list.some(s => s.id === sub.id)).to.be.true;

      // 3. Toggle
      const toggled = await webhookServiceInstance.toggleSubscription(sub.id, false);
      expect(toggled.active).to.be.false;

      // 4. Rotate secret
      const originalSecret = sub.secret;
      const rotated = await webhookServiceInstance.rotateSecret(sub.id);
      expect(rotated.secret).to.not.equal(originalSecret);

      // Clean up/Delete
      await webhookServiceInstance.deleteSubscription(sub.id);
    });

    it('should retry webhook delivery on network/server error and log it', async () => {
      // Create active subscription
      const tempSub = await webhookServiceInstance.createSubscription('http://localhost:9999/faulty-hook', ['test.event']);
      
      // Mock fetch to reject
      global.fetch = async () => {
        throw new Error("Simulated webhook network failure");
      };

      // Dispatch directly and wait for retry loop (timeout/exponential backoff is bypassed or quick since attempt count is 3)
      // Note: We temporarily stub setTimeout during this run to speed up retry backoff!
      const originalTimeout = global.setTimeout;
      global.setTimeout = (fn) => fn();

      try {
        await webhookServiceInstance._dispatchToSubscriber(tempSub, 'test.event', JSON.stringify({ foo: 'bar' }));
      } finally {
        global.setTimeout = originalTimeout;
      }

      // Get delivery logs
      const logs = await webhookServiceInstance.getDeliveryLogs(tempSub.id);
      expect(logs.length).to.be.greaterThan(0);
      expect(logs[0].success).to.be.false;
      expect(logs[0].responseStatus).to.equal(500);

      // Delete subscription
      await webhookServiceInstance.deleteSubscription(tempSub.id);
    });
  });
});
