import request from 'supertest';
import { app } from '../server.js';
import { expect } from 'chai';
import { PrismaClient } from '@prisma/client';
import { networkIntelligence } from '../src/services/networkIntelligenceService.js';
import { ethers } from 'ethers';
import crypto from 'crypto';

import { trustScoreEngine } from '../src/services/trustScoreService.js';
import { convertToUSDEquivalent, screenTransaction, logComplianceCheck, generateComplianceReport } from '../complianceService.js';
import { fxOverrides } from '../fxController.js';
import { db as complianceDb, complianceOverrides } from '../complianceController.js';

const prisma = new PrismaClient();

describe('KorriPay Extra Route & Branch Coverage Enhancer', () => {
  let adminToken;
  let userToken;
  let regularUserId;
  let testContactId;
  let testPaymentRequestId;
  let testAttestationId;
  let testReportId;

  before(async () => {
    // 1. Ensure Jane Doe exists, is ADMIN, and has a wallet address
    let adminUser = await prisma.user.findFirst({ where: { email: 'jane.doe@korri.pay' } });
    const randomAddress = ethers.Wallet.createRandom().address.toLowerCase();
    if (adminUser) {
      adminUser = await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          role: 'ADMIN',
          suspended: false,
          walletAddress: adminUser.walletAddress || randomAddress
        }
      });
    } else {
      adminUser = await prisma.user.create({
        data: {
          name: "Jane Doe",
          email: "jane.doe@korri.pay",
          role: "ADMIN",
          walletAddress: randomAddress
        }
      });
    }

    // 2. Call signin/demo to get a valid admin token mapped to Jane Doe
    const resAdmin = await request(app)
      .post('/api/auth/demo')
      .send({ email: 'jane.doe@korri.pay', password: 'anyPassword' })
      .expect(200);

    adminToken = resAdmin.body.token;

    // 3. Ensure we have the compliance rule seeded
    await prisma.complianceRule.upsert({
      where: { code: 'TX_MAX_USD' },
      update: {},
      create: {
        code: 'TX_MAX_USD',
        name: 'Single Transaction Max USD Limit',
        description: 'Single Transaction Max USD Limit Description',
        isActive: true,
        value: 2000.0
      }
    });
  });

  after(async () => {
    // Cleanup any created test items
    if (testContactId) {
      await prisma.contact.delete({ where: { id: testContactId } }).catch(() => {});
    }
    if (testPaymentRequestId) {
      await prisma.paymentRequest.delete({ where: { id: testPaymentRequestId } }).catch(() => {});
    }
    if (testAttestationId) {
      await prisma.attestation.delete({ where: { id: testAttestationId } }).catch(() => {});
    }
    if (testReportId) {
      await prisma.complianceReport.delete({ where: { id: testReportId } }).catch(() => {});
    }
    
    // Clean up all users created by this test file
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { startsWith: 'test-user-' } },
          { email: { startsWith: 'dup-' } },
          { email: { startsWith: 'demo-user-123' } },
          { email: { startsWith: 'member-' } },
          { email: { startsWith: 'other-' } }
        ]
      }
    }).catch(() => {});

    networkIntelligence.stopSnapshotLoop();
  });

  describe('Authentication & Sign-up/Sign-in Endpoints', () => {
    it('POST /api/auth/signup should register a new user and return a session token', async () => {
      const uniqueEmail = `test-user-${Date.now()}@korri.pay`;
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail,
          password: 'securePassword123',
          name: 'Regular Test User'
        })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.token).to.not.be.undefined;
      userToken = res.body.token;
      regularUserId = res.body.userId;
    });

    it('POST /api/auth/signup should reject duplicate email', async () => {
      const dupEmail = `dup-${Date.now()}-${Math.random()}@korri.pay`;
      // Create first
      await request(app)
        .post('/api/auth/signup')
        .send({ email: dupEmail, password: 'password123' })
        .expect(200);

      // Try duplicate
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: dupEmail, password: 'password123' })
        .expect(400);

      expect(res.body.error).to.contain('User already exists');
    });

    it('POST /api/auth/signup should reject empty fields', async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({ name: 'No Email Or Password' })
        .expect(400);
    });

    it('POST /api/auth/signin should sign in an existing user', async () => {
      const email = 'jane.doe@korri.pay';
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email, password: 'anyPasswordForDemo' })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.token).to.not.be.undefined;
    });

    it('POST /api/auth/signin should reject non-existent user', async () => {
      await request(app)
        .post('/api/auth/signin')
        .send({ email: 'nonexistent@korri.pay', password: 'password' })
        .expect(400);
    });

    it('POST /api/auth/signin should reject empty fields', async () => {
      await request(app)
        .post('/api/auth/signin')
        .send({ password: 'password' })
        .expect(400);
    });

    it('POST /api/auth/demo should authenticate or create demo user', async () => {
      const res = await request(app)
        .post('/api/auth/demo')
        .send({ email: 'demo-user-123@korri.pay', password: 'password' })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.token).to.not.be.undefined;
    });

    it('POST /api/auth/demo should reject if email is missing', async () => {
      await request(app)
        .post('/api/auth/demo')
        .send({ password: 'password' })
        .expect(400);
    });

    it('GET /api/auth/nonce should return a signature nonce', async () => {
      const res = await request(app)
        .get('/api/auth/nonce')
        .query({ address: ethers.Wallet.createRandom().address })
        .expect(200);

      expect(res.body.nonce).to.not.be.undefined;
    });

    it('POST /api/auth/verify should verify wallet signature (failure test)', async () => {
      // Missing signature
      await request(app)
        .post('/api/auth/verify')
        .send({ address: ethers.Wallet.createRandom().address })
        .expect(400);
    });
  });

  describe('Static & General Server Pages', () => {
    it('GET /showcase should return HTML', async () => {
      await request(app).get('/showcase').expect(200);
    });

    it('GET /trust should return HTML', async () => {
      await request(app).get('/trust').expect(200);
    });

    it('GET /developers should return HTML', async () => {
      await request(app).get('/developers').expect(200);
    });

    it('GET /treasury should return HTML', async () => {
      await request(app).get('/treasury').expect(200);
    });

    it('GET /organization should return HTML', async () => {
      await request(app).get('/organization').expect(200);
    });
  });

  describe('Explorer & Analytics API', () => {
    it('GET /api/explorer should retrieve all settlements', async () => {
      const res = await request(app)
        .get('/api/explorer')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('GET /api/analytics should compute analytics dashboards', async () => {
      const res = await request(app)
        .get('/api/analytics')
        .expect(200);

      expect(res.body.metrics).to.not.be.undefined;
      expect(res.body.charts).to.not.be.undefined;
    });
  });

  describe('Contacts API Endpoints', () => {
    it('POST /api/contacts should create a new contact', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          walletAddress: '0x1234567890123456789012345678901234567890',
          name: 'Bob Smith',
          nickname: 'Bobby',
          isFavorite: true
        })
        .expect(200);

      expect(res.body.contact).to.not.be.undefined;
      testContactId = res.body.contact.id;
    });

    it('POST /api/contacts should reject missing parameters', async () => {
      await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ walletAddress: '0x123' })
        .expect(400);
    });

    it('GET /api/contacts should list contacts', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('POST /api/contacts/favorite should toggle favorite status', async () => {
      const res = await request(app)
        .post('/api/contacts/favorite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: testContactId, isFavorite: false })
        .expect(200);

      expect(res.body.contact.isFavorite).to.be.false;
    });

    it('POST /api/contacts/favorite should reject missing id', async () => {
      await request(app)
        .post('/api/contacts/favorite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isFavorite: true })
        .expect(400);
    });

    it('DELETE /api/contacts/:id should remove a contact', async () => {
      await request(app)
        .delete(`/api/contacts/${testContactId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      testContactId = null; // cleared
    });
  });

  describe('Merchant Payment API Endpoints', () => {
    it('POST /api/merchant/request should create payment request', async () => {
      const res = await request(app)
        .post('/api/merchant/request')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 50.00,
          currency: 'USD',
          description: 'Invoice #101'
        })
        .expect(200);

      expect(res.body.id).to.not.be.undefined;
      testPaymentRequestId = res.body.id;
    });

    it('POST /api/merchant/request should reject missing inputs', async () => {
      await request(app)
        .post('/api/merchant/request')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 100 })
        .expect(400);
    });

    it('GET /api/merchant/request/:id should get payment request details', async () => {
      const res = await request(app)
        .get(`/api/merchant/request/${testPaymentRequestId}`)
        .expect(200);

      expect(res.body.amount).to.equal(50);
    });

    it('GET /api/merchant/request/:id should return 404 for invalid ID', async () => {
      await request(app)
        .get('/api/merchant/request/invalid-id-here')
        .expect(404);
    });

    it('POST /api/merchant/pay should execute payment request', async () => {
      const res = await request(app)
        .post('/api/merchant/pay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          paymentRequestId: testPaymentRequestId,
          txHash: '0xabc123'
        })
        .expect(200);

      expect(res.body.message).to.contain('processed successfully');
    });

    it('POST /api/merchant/pay should reject paying a non-pending request', async () => {
      await request(app)
        .post('/api/merchant/pay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          paymentRequestId: testPaymentRequestId
        })
        .expect(400);
    });

    it('POST /api/merchant/pay should reject missing request ID', async () => {
      await request(app)
        .post('/api/merchant/pay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('POST /api/merchant/pay should reject non-existent payment request ID', async () => {
      await request(app)
        .post('/api/merchant/pay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paymentRequestId: 'non-existent-id' })
        .expect(404);
    });

    it('GET /api/merchant/settlements should fetch settlements', async () => {
      await request(app)
        .get('/api/merchant/settlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /api/merchant/stats should fetch stats and compliance status', async () => {
      await request(app)
        .get('/api/merchant/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Operations & Attestations Endpoints', () => {
    it('GET /api/operations/status should report operational health metrics', async () => {
      const res = await request(app)
        .get('/api/operations/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.database).to.not.be.undefined;
    });

    it('POST /api/attestations should create a new EAS attestation', async () => {
      const res = await request(app)
        .post('/api/attestations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          issuer: '0x3333444455556666777788889999000011112222',
          schema: 'Identity',
          subjectWallet: '0x1111222233334444555566667777888899990000',
          details: { riskLevel: 'Low' }
        })
        .expect(201); // Expect 201

      expect(res.body.attestation).to.not.be.undefined;
      testAttestationId = res.body.attestation.id;
    });

    it('POST /api/attestations should reject missing fields', async () => {
      await request(app)
        .post('/api/attestations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ schema: 'Identity' })
        .expect(400);
    });

    it('GET /api/attestations/:id should find attestation details', async () => {
      const res = await request(app)
        .get(`/api/attestations/${testAttestationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.attestation).to.not.be.undefined;
    });

    it('GET /api/attestations/:id should return 404 if not found', async () => {
      await request(app)
        .get('/api/attestations/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('FX Controller Coverage Extensions', () => {
    it('POST /api/fx/convert should validate positive amount', async () => {
      await request(app)
        .post('/api/fx/convert')
        .send({ amount: -10, fromCurrency: 'USD', toAsset: 'MockKRW' })
        .expect(400);
    });

    it('POST /api/fx/convert should check that all inputs are provided', async () => {
      await request(app)
        .post('/api/fx/convert')
        .send({ amount: 100 })
        .expect(400);
    });

    it('GET /api/fx/fee should handle base currency conversion properly', async () => {
      const res = await request(app)
        .get('/api/fx/fee')
        .query({ amount: 10000, currency: 'KRW' })
        .expect(200);

      expect(res.body.usdEquivalent).to.be.a('number');
    });

    it('GET /api/fx/history should enforce auth', async () => {
      await request(app)
        .get('/api/fx/history')
        .expect(401);
    });

    it('GET /api/fx/analytics should enforce auth', async () => {
      await request(app)
        .get('/api/fx/analytics')
        .expect(401);
    });
  });

  describe('Wallet Controller Coverage Extensions', () => {
    it('POST /api/wallet/credit should reject invalid currencies', async () => {
      await request(app)
        .post('/api/wallet/credit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'INVALID', amount: 50 })
        .expect(400);
    });

    it('POST /api/wallet/credit should reject zero or negative amount', async () => {
      await request(app)
        .post('/api/wallet/credit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: -5 })
        .expect(400);
    });

    it('POST /api/wallet/debit should validate balance sufficiency', async () => {
      await request(app)
        .post('/api/wallet/debit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 9999999 })
        .expect(400);
    });

    it('POST /api/wallet/debit should reject invalid currency or negative amounts', async () => {
      await request(app)
        .post('/api/wallet/debit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'INVALID', amount: 50 })
        .expect(400);

      await request(app)
        .post('/api/wallet/debit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: -50 })
        .expect(400);
    });

    it('POST /api/wallet/lock should validate sufficiency', async () => {
      await request(app)
        .post('/api/wallet/lock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 9999999 })
        .expect(400);
    });

    it('POST /api/wallet/lock should validate input currency and positive amount', async () => {
      await request(app)
        .post('/api/wallet/lock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'INVALID', amount: 10 })
        .expect(400);

      await request(app)
        .post('/api/wallet/lock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: -10 })
        .expect(400);
    });

    it('POST /api/wallet/unlock should validate locked balance sufficiency', async () => {
      await request(app)
        .post('/api/wallet/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 9999999 })
        .expect(400);
    });

    it('POST /api/wallet/unlock should validate inputs', async () => {
      await request(app)
        .post('/api/wallet/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'INVALID', amount: 10 })
        .expect(400);

      await request(app)
        .post('/api/wallet/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: -10 })
        .expect(400);
    });

    it('POST /api/wallet/settle should validate locked balance sufficiency', async () => {
      await request(app)
        .post('/api/wallet/settle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 9999999 })
        .expect(400);
    });

    it('POST /api/wallet/settle should validate inputs', async () => {
      await request(app)
        .post('/api/wallet/settle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'INVALID', amount: 10 })
        .expect(400);

      await request(app)
        .post('/api/wallet/settle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: -10 })
        .expect(400);
    });

    it('GET /api/wallet/ledger should return paginated list of entries', async () => {
      const res = await request(app)
        .get('/api/wallet/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ currency: 'USD', limit: 10, offset: 0 })
        .expect(200);

      expect(res.body.entries).to.be.an('array');
    });
  });

  describe('Compliance Controller Coverage Extensions', () => {
    it('GET /api/compliance/passport should enforce auth', async () => {
      await request(app)
        .get('/api/compliance/passport')
        .expect(401);
    });

    it('POST /api/compliance/profile/update should enforce auth', async () => {
      await request(app)
        .post('/api/compliance/profile/update')
        .expect(401);
    });

    it('POST /api/compliance/profile/update should update profile settings', async () => {
      const res = await request(app)
        .post('/api/compliance/profile/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          riskLevel: 'Medium',
          kycEnforced: false,
          dailyLimitUSD: 10000,
          singleTxLimitUSD: 5000,
          suspiciousThresholdUSD: 2000
        })
        .expect(200);

      expect(res.body.profile.riskLevel).to.equal('Medium');
    });

    it('POST /api/compliance/rules/toggle should reject missing code', async () => {
      await request(app)
        .post('/api/compliance/rules/toggle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true })
        .expect(400);
    });

    it('POST /api/compliance/rules/toggle should toggle rule status', async () => {
      const res = await request(app)
        .post('/api/compliance/rules/toggle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'TX_MAX_USD', isActive: false, value: 3000 })
        .expect(200);

      expect(res.body.rule.isActive).to.be.false;
      expect(res.body.rule.value).to.equal(3000);
    });

    it('GET /api/compliance/logs should support filtering', async () => {
      const res = await request(app)
        .get('/api/compliance/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ all: 'true' })
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('POST /api/compliance/reports/generate should create a report', async () => {
      const res = await request(app)
        .post('/api/compliance/reports/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'DAILY', days: 10 })
        .expect(200);

      expect(res.body.report).to.not.be.undefined;
      testReportId = res.body.report.id;
    });

    it('GET /api/compliance/reports should return a list of reports', async () => {
      const res = await request(app)
        .get('/api/compliance/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('GET /api/compliance/reports/:id should get details', async () => {
      const res = await request(app)
        .get(`/api/compliance/reports/${testReportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).to.equal(testReportId);
    });

    it('GET /api/compliance/reports/:id should return 404 if not found', async () => {
      await request(app)
        .get('/api/compliance/reports/non-existent-report-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Admin Controller Access & Operations', () => {
    it('GET /api/admin/users should deny access to non-admin user', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('GET /api/admin/users should return all users to admin', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'Jane', role: 'ADMIN', status: 'active', limit: 10 })
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('POST /api/admin/users/:id/suspend should suspend a user account', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${regularUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ suspended: true })
        .expect(200);

      expect(res.body.user.suspended).to.be.true;
    });

    it('POST /api/admin/users/:id/suspend should check parameter existence', async () => {
      await request(app)
        .post(`/api/admin/users/${regularUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('POST /api/admin/users/:id/role should change a user role', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      expect(res.body.user.role).to.equal('ADMIN');
    });

    it('POST /api/admin/users/:id/role should reject invalid roles', async () => {
      await request(app)
        .post(`/api/admin/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'INVALID_ROLE' })
        .expect(400);
    });

    it('GET /api/admin/wallets should return list of wallets', async () => {
      const res = await request(app)
        .get('/api/admin/wallets')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'Jane', limit: 10 })
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('GET /api/admin/transactions should return transactions list', async () => {
      const res = await request(app)
        .get('/api/admin/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'Jane', type: 'send', status: 'Success', limit: 10 })
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('GET /api/admin/settlements should return settlements list', async () => {
      const res = await request(app)
        .get('/api/admin/settlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: '0x', status: 'Pending', limit: 10 })
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('GET /api/admin/kyc should return KYC requests list', async () => {
      const res = await request(app)
        .get('/api/admin/kyc')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status: 'Pending', limit: 10 })
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('POST /api/admin/kyc/:id/review should review kyc request', async () => {
      // Find a pending KYC
      const kyc = await prisma.kyc.findFirst({ where: { status: 'PENDING' } });
      if (kyc) {
        const res = await request(app)
          .post(`/api/admin/kyc/${kyc.id}/review`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'Verified' })
          .expect(200);

        expect(res.body.kyc.status).to.equal('Verified');
      }
    });

    it('POST /api/admin/kyc/:id/review should reject invalid status', async () => {
      const kyc = await prisma.kyc.findFirst();
      if (kyc) {
        await request(app)
          .post(`/api/admin/kyc/${kyc.id}/review`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'INVALID_STATUS' })
          .expect(400);
      }
    });

    it('GET /api/admin/compliance should return logs and rules', async () => {
      const res = await request(app)
        .get('/api/admin/compliance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.logs).to.be.an('array');
      expect(res.body.rules).to.be.an('array');
    });

    it('GET /api/admin/attestations should list all attestations', async () => {
      const res = await request(app)
        .get('/api/admin/attestations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: '0x', schema: 'Identity', limit: 10 })
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('POST /api/admin/attestations/issue should manually issue an EAS attestation', async () => {
      const res = await request(app)
        .post('/api/admin/attestations/issue')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subjectWallet: '0x2222333344445555666677778888999900001111',
          schema: 'Business',
          details: { kycPassed: true }
        })
        .expect(200);

      expect(res.body.attestation).to.not.be.undefined;
    });

    it('POST /api/admin/attestations/issue should reject if required fields are missing', async () => {
      await request(app)
        .post('/api/admin/attestations/issue')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ schema: 'Business' })
        .expect(400);
    });

    it('POST /api/admin/attestations/:id/revoke should revoke EAS attestation', async () => {
      const att = await prisma.attestation.findFirst({ where: { status: 'Active' } });
      if (att) {
        const res = await request(app)
          .post(`/api/admin/attestations/${att.id}/revoke`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.attestation.status).to.equal('Revoked');
      }
    });

    it('GET /api/admin/health should retrieve administrative health details', async () => {
      const res = await request(app)
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.rpc).to.not.be.undefined;
      expect(res.body.database.status).to.equal('Healthy');
    });

    it('GET /api/admin/audit-logs should return history of operations', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('GET /api/admin/analytics should return analytic stats', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.users).to.not.be.undefined;
      expect(res.body.compliance).to.not.be.undefined;
    });
  });

  describe('Successful Ledger and Wallet Operations', () => {
    it('should successfully debit, lock, unlock, and settle balances', async () => {
      // 1. Credit USD available
      await request(app)
        .post('/api/wallet/credit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 100.00, description: 'Seeding test' })
        .expect(200);

      // 2. Successful Debit
      const debitRes = await request(app)
        .post('/api/wallet/debit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 10.00, description: 'Valid debit' })
        .expect(200);
      expect(debitRes.body.success).to.be.true;

      // 3. Successful Lock
      const lockRes = await request(app)
        .post('/api/wallet/lock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 20.00, description: 'Locking funds' })
        .expect(200);
      expect(lockRes.body.success).to.be.true;

      // 4. Successful Unlock
      const unlockRes = await request(app)
        .post('/api/wallet/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 5.00, description: 'Unlocking a portion' })
        .expect(200);
      expect(unlockRes.body.success).to.be.true;

      // 5. Successful Settle
      const settleRes = await request(app)
        .post('/api/wallet/settle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 10.00, description: 'Settling locked portion' })
        .expect(200);
      expect(settleRes.body.success).to.be.true;
    });
  });

  describe('FX Controller Recording and History Extensions', () => {
    it('POST /api/fx/convert with authorization should record conversion to history', async () => {
      const res = await request(app)
        .post('/api/fx/convert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 100.00, fromCurrency: 'USD', toAsset: 'MockKRW' })
        .expect(200);
      
      expect(res.body.input.amount).to.equal(100.00);
    });

    it('GET /api/fx/history should retrieve conversion history list', async () => {
      const res = await request(app)
        .get('/api/fx/history')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(res.body.records).to.be.an('array');
      expect(res.body.records.length).to.be.greaterThan(0);
    });

    it('GET /api/fx/analytics should retrieve conversion analytics summary', async () => {
      const res = await request(app)
        .get('/api/fx/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ days: 30 })
        .expect(200);

      expect(res.body.totalConversions).to.be.greaterThan(0);
    });

    it('GET /api/fx/rates should return 500 when fetchLiveRates throws', async () => {
      fxOverrides.fetchLiveRates = () => { throw new Error("Mocked rates failure"); };
      try {
        await request(app)
          .get('/api/fx/rates')
          .expect(500);
      } finally {
        fxOverrides.fetchLiveRates = null;
      }
    });

    it('POST /api/fx/convert should return 400 when convertFX throws', async () => {
      fxOverrides.convertFX = () => { throw new Error("Mocked conversion failure"); };
      try {
        await request(app)
          .post('/api/fx/convert')
          .send({ amount: 10, fromCurrency: 'USD', toAsset: 'USDC' })
          .expect(400);
      } finally {
        fxOverrides.convertFX = null;
      }
    });

    it('POST /api/fx/quote should return 400 when convertFX throws', async () => {
      fxOverrides.convertFX = () => { throw new Error("Mocked quote failure"); };
      try {
        await request(app)
          .post('/api/fx/quote')
          .send({ amount: 10, fromCurrency: 'USD', toAsset: 'USDC' })
          .expect(400);
      } finally {
        fxOverrides.convertFX = null;
      }
    });

    it('GET /api/fx/history should return 500 when getFXHistory throws', async () => {
      fxOverrides.getFXHistory = () => { throw new Error("Mocked history failure"); };
      try {
        await request(app)
          .get('/api/fx/history')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(500);
      } finally {
        fxOverrides.getFXHistory = null;
      }
    });

    it('GET /api/fx/analytics should return 500 when getFXAnalytics throws', async () => {
      fxOverrides.getFXAnalytics = () => { throw new Error("Mocked analytics failure"); };
      try {
        await request(app)
          .get('/api/fx/analytics')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(500);
      } finally {
        fxOverrides.getFXAnalytics = null;
      }
    });

    it('GET /api/fx/fee should return 500 when fetchLiveRates throws', async () => {
      fxOverrides.fetchLiveRates = () => { throw new Error("Mocked fee rates failure"); };
      try {
        await request(app)
          .get('/api/fx/fee')
          .query({ amount: 10, currency: 'USD' })
          .expect(500);
      } finally {
        fxOverrides.fetchLiveRates = null;
      }
    });

    it('POST /api/fx/convert should handle recordFXConversion failure gracefully', async () => {
      // The /api/fx route uses session-based auth (not JWT), so we need a
      // demo-login token that populates the sessions Map for req.userId to be set
      const loginRes = await request(app)
        .post('/api/auth/demo')
        .send({ email: 'jane.doe@korri.pay', password: 'anyPassword' })
        .expect(200);
      const sessionToken = loginRes.body.token;

      // Stub convertFX to return a valid shape so we reach the history branch
      fxOverrides.convertFX = async () => ({
        from: 'USD', to: 'MockKRW', inputAmount: 100,
        output: { grossAmount: 153600, fee: 1536, netAmount: 152064 },
        rate: 1536.009715,
        input: { amount: 100 }
      });
      fxOverrides.recordFXConversion = () => Promise.reject(new Error("Mocked record history failure"));
      try {
        await request(app)
          .post('/api/fx/convert')
          .set('Authorization', `Bearer ${sessionToken}`)
          .send({ amount: 100.00, fromCurrency: 'USD', toAsset: 'MockKRW' })
          .expect(200);
      } finally {
        fxOverrides.convertFX = null;
        fxOverrides.recordFXConversion = null;
      }
    });
  });

  describe('API V1 Corporate Organization and Approvals Endpoints', () => {
    let orgOwnerToken;
    let orgOwnerUserId;
    let orgId;
    let memberUserEmail = `member-${Date.now()}@korri.pay`;
    let memberUserId;
    let approvalId;

    before(async () => {
      // 1. Create owner user
      const ownerEmail = `org-owner-${Date.now()}@korri.pay`;
      const ownerRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: ownerEmail,
          password: 'securePassword123',
          name: 'Org Owner User'
        })
        .expect(200);

      orgOwnerToken = ownerRes.body.token;
      orgOwnerUserId = ownerRes.body.userId;

      // 2. Create member user
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: memberUserEmail,
          password: 'securePassword123',
          name: 'Org Member User'
        })
        .expect(200);
      memberUserId = res.body.userId;
    });

    it('POST /api/v1/organizations should initialize a corporate organization', async () => {
      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({
          name: 'Acme Corporate Inc',
          taxId: 'TX-99887766'
        })
        .expect(200);

      expect(res.body.success).to.be.true;
      orgId = res.body.organization.id;
    });

    it('GET /api/v1/organizations/my-org should return active organization info', async () => {
      const res = await request(app)
        .get('/api/v1/organizations/my-org')
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.organization.name).to.equal('Acme Corporate Inc');
    });

    it('POST /api/v1/organizations/members should register a new member', async () => {
      const res = await request(app)
        .post('/api/v1/organizations/members')
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({
          email: memberUserEmail,
          role: 'ADMIN',
          dailyLimit: 5000.00
        })
        .expect(200);

      expect(res.body.success).to.be.true;
    });

    it('PUT /api/v1/organizations/members/:userId should update membership attributes', async () => {
      const res = await request(app)
        .put(`/api/v1/organizations/members/${memberUserId}`)
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({
          role: 'FINANCE',
          dailyLimit: 2500.00
        })
        .expect(200);

      expect(res.body.success).to.be.true;
    });

    it('POST /api/v1/organizations/settlements should directly execute when under limit', async () => {
      const res = await request(app)
        .post('/api/v1/organizations/settlements')
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({
          fromToken: 'USD',
          toToken: '0x0000000000000000000000000000000000000000',
          amount: '100.00',
          recipientDetails: '0x1111222233334444555566667777888899990000'
        })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.status).to.equal('EXECUTED');
    });

    it('POST /api/v1/organizations/settlements should queue for approval when exceeding limit', async () => {
      // 1. Temporarily lower OWNER's daily limit to $1.00
      await prisma.orgMember.update({
        where: { orgId_userId: { orgId, userId: orgOwnerUserId } },
        data: { dailySettlementLimit: 1.00 }
      });

      // 2. Post settlement request above limit ($100.00)
      const res = await request(app)
        .post('/api/v1/organizations/settlements')
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({
          fromToken: 'USD',
          toToken: '0x0000000000000000000000000000000000000000',
          amount: '100.00',
          recipientDetails: '0x1111222233334444555566667777888899990000'
        })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.status).to.equal('PENDING_APPROVAL');
      expect(res.body.approvalId).to.not.be.undefined;
      approvalId = res.body.approvalId;
    });

    it('POST /api/v1/organizations/approvals/:approvalId should decide approval (APPROVED)', async () => {
      const res = await request(app)
        .post(`/api/v1/organizations/approvals/${approvalId}`)
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.settlementId).to.not.be.undefined;
    });

    it('POST /api/v1/organizations/approvals/:approvalId should decide approval (REJECTED)', async () => {
      // 1. Trigger another approval
      const settleRes = await request(app)
        .post('/api/v1/organizations/settlements')
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({
          fromToken: 'USD',
          toToken: '0x0000000000000000000000000000000000000000',
          amount: '50.00',
          recipientDetails: '0x1111222233334444555566667777888899990000'
        })
        .expect(200);

      const nextApprovalId = settleRes.body.approvalId;

      // 2. Reject it
      const res = await request(app)
        .post(`/api/v1/organizations/approvals/${nextApprovalId}`)
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({ status: 'REJECTED' })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.status).to.equal('REJECTED');
    });

    it('DELETE /api/v1/organizations/members/:userId should remove member from corporate organization', async () => {
      const res = await request(app)
        .delete(`/api/v1/organizations/members/${memberUserId}`)
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .expect(200);

      expect(res.body.success).to.be.true;
    });
  });

  describe('Compliance Service & Reports Unit Boosters', () => {
    it('should convert KRW & NGN via live rates', async () => {
      const krwUSD = await convertToUSDEquivalent(10000, 'KRW');
      const ngnUSD = await convertToUSDEquivalent(10000, 'NGN');
      expect(krwUSD).to.be.a('number');
      expect(ngnUSD).to.be.a('number');
    });

    it('should calculate historical trust score trends when history is empty', async () => {
      const randWallet = '0x' + crypto.randomBytes(20).toString('hex');
      const trend = await trustScoreEngine.getScoreHistory(randWallet);
      expect(trend).to.be.an('array');
      expect(trend.length).to.equal(7);
    });

    it('should screen transactions against various compliance rules and risk level bounds', async () => {
      const regularUser = await prisma.user.findFirst({
        where: { email: { startsWith: 'test-user-' } }
      });
      if (regularUser) {
        // Set kycEnforced to false so KYC rules don't mask other rule evaluations
        await prisma.complianceProfile.upsert({
          where: { userId: regularUser.id },
          update: { kycEnforced: false },
          create: { userId: regularUser.id, kycEnforced: false, riskLevel: 'Low' }
        });

        // Exceed single limit
        const limitRes = await screenTransaction(regularUser.id, 10000.0, 'USD', 'send', 'Large transfer');
        expect(limitRes.result).to.equal('Blocked');
        expect(limitRes.rulesTriggered).to.include('VELOCITY_SINGLE_TX');

        // Exceed suspicious limit
        const suspRes = await screenTransaction(regularUser.id, 1500.0, 'USD', 'send', 'Suspicious amount');
        expect(suspRes.result).to.equal('Flagged');
        expect(suspRes.rulesTriggered).to.include('SUSPICIOUS_TX');

        // High risk modifier
        await prisma.complianceProfile.upsert({
          where: { userId: regularUser.id },
          update: { riskLevel: 'High' },
          create: { userId: regularUser.id, riskLevel: 'High' }
        });
        const highRiskRes = await screenTransaction(regularUser.id, 250.0, 'USD', 'send', 'Regular transfer');
        expect(highRiskRes.rulesTriggered).to.include('HIGH_RISK_USER_MODIFIER');

        // Elevating to Medium check
        await logComplianceCheck(regularUser.id, null, 100.0, 'USD', {
          riskScore: 50,
          riskLevel: 'Medium',
          result: 'Flagged',
          rulesTriggered: ['SUSPICIOUS_TX'],
          details: 'Moderate warning'
        });
      }
    });

    it('GET /api/compliance/logs should support filtering without all parameter', async () => {
      const res = await request(app)
        .get('/api/compliance/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('GET /api/compliance/profile should retrieve the compliance profile', async () => {
      const res = await request(app)
        .get('/api/compliance/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.profile).to.not.be.undefined;
    });

    it('GET /api/compliance/passport should display elevated tiers and merchant status details', async () => {
      const regularUser = await prisma.user.findFirst({
        where: { email: { startsWith: 'test-user-' } }
      });
      if (regularUser) {
        // Set user to merchant, high daily limit, high risk, and NOT suspended
        await prisma.user.update({
          where: { id: regularUser.id },
          data: { role: 'MERCHANT', suspended: false }
        });
        await prisma.complianceProfile.upsert({
          where: { userId: regularUser.id },
          update: { riskLevel: 'High', dailyLimitUSD: 60000.0 },
          create: { userId: regularUser.id, riskLevel: 'High', dailyLimitUSD: 60000.0 }
        });

        // Sign in to get token
        const authRes = await request(app)
          .post('/api/auth/demo')
          .send({ email: regularUser.email, password: 'password' })
          .expect(200);

        let res = await request(app)
          .get('/api/compliance/passport')
          .set('Authorization', `Bearer ${authRes.body.token}`)
          .expect(200);

        expect(res.body.merchantStatus).to.equal('Verified');
        expect(res.body.complianceLevel).to.equal('Tier 3');
        expect(res.body.riskScore).to.equal(80);

        // Update compliance profile to test Tier 2 and Medium risk logic
        await prisma.complianceProfile.update({
          where: { userId: regularUser.id },
          data: { riskLevel: 'Medium', dailyLimitUSD: 10000.0 }
        });

        res = await request(app)
          .get('/api/compliance/passport')
          .set('Authorization', `Bearer ${authRes.body.token}`)
          .expect(200);

        expect(res.body.complianceLevel).to.equal('Tier 2');
        expect(res.body.riskScore).to.equal(45);
      }
    });

    it('GET /api/compliance/passport should handle KYC and Attestation branches & lazy profile creation', async () => {
      // 1. Create a new user with a random wallet address
      const email = `att-user-${Date.now()}@korri.pay`;
      const randomAddress = ethers.Wallet.createRandom().address.toLowerCase();
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email, password: 'securePassword123', name: 'Attestation User' })
        .expect(200);

      const userId = res.body.userId;
      const token = res.body.token;

      await prisma.user.update({
        where: { id: userId },
        data: { walletAddress: randomAddress }
      });

      // Initially, they should be Unverified / Pending Verification
      let passRes = await request(app)
        .get('/api/compliance/passport')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(passRes.body.identityStatus).to.equal('Unverified');
      expect(passRes.body.merchantStatus).to.equal('Unverified');
      expect(passRes.body.travelRuleStatus).to.equal('Pending Verification');

      // Test KYC status Pending
      await prisma.kyc.create({
        data: { userId, status: 'Pending' }
      });
      passRes = await request(app)
        .get('/api/compliance/passport')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(passRes.body.identityStatus).to.equal('Pending');

      // Test KYC status Verified
      await prisma.kyc.updateMany({
        where: { userId },
        data: { status: 'Verified' }
      });
      passRes = await request(app)
        .get('/api/compliance/passport')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(passRes.body.identityStatus).to.equal('Verified');
      expect(passRes.body.travelRuleStatus).to.equal('Compliant'); // Since identityStatus is Verified

      // Test Attestation status (Identity, Merchant, Business, Compliance)
      await prisma.attestation.createMany({
        data: [
          { id: crypto.randomUUID(), subjectWallet: randomAddress, schema: 'Identity', status: 'Active', issuer: '0x1', details: '{}' },
          { id: crypto.randomUUID(), subjectWallet: randomAddress, schema: 'Merchant', status: 'Active', issuer: '0x1', details: '{}' },
          { id: crypto.randomUUID(), subjectWallet: randomAddress, schema: 'Business', status: 'Active', issuer: '0x1', details: '{}' },
          { id: crypto.randomUUID(), subjectWallet: randomAddress, schema: 'Compliance', status: 'Active', issuer: '0x1', details: '{}' }
        ]
      });

      passRes = await request(app)
        .get('/api/compliance/passport')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(passRes.body.identityStatus).to.equal('Verified');
      expect(passRes.body.merchantStatus).to.equal('Verified');
      expect(passRes.body.businessStatus).to.equal('Verified');
      expect(passRes.body.travelRuleStatus).to.equal('Compliant');
    });

    it('GET /api/compliance/passport should handle errors', async () => {
      const original = complianceDb.user.findUnique;
      complianceDb.user.findUnique = () => { throw new Error("Mocked passport error"); };
      try {
        await request(app)
          .get('/api/compliance/passport')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(500);
      } finally {
        complianceDb.user.findUnique = original;
      }
    });

    it('GET /api/compliance/profile should handle errors', async () => {
      const original = complianceDb.complianceProfile.findUnique;
      complianceDb.complianceProfile.findUnique = () => { throw new Error("Mocked profile error"); };
      try {
        await request(app)
          .get('/api/compliance/profile')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(500);
      } finally {
        complianceDb.complianceProfile.findUnique = original;
      }
    });

    it('POST /api/compliance/profile/update should handle errors', async () => {
      const original = complianceDb.complianceProfile.update;
      complianceDb.complianceProfile.update = () => { throw new Error("Mocked update error"); };
      try {
        await request(app)
          .post('/api/compliance/profile/update')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ riskLevel: 'Low' })
          .expect(500);
      } finally {
        complianceDb.complianceProfile.update = original;
      }
    });

    it('GET /api/compliance/rules should handle errors', async () => {
      const original = complianceDb.complianceRule.findMany;
      complianceDb.complianceRule.findMany = () => { throw new Error("Mocked rules error"); };
      try {
        await request(app)
          .get('/api/compliance/rules')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(500);
      } finally {
        complianceDb.complianceRule.findMany = original;
      }
    });

    it('POST /api/compliance/rules/toggle should handle errors', async () => {
      const original = complianceDb.complianceRule.update;
      complianceDb.complianceRule.update = () => { throw new Error("Mocked rules toggle error"); };
      try {
        await request(app)
          .post('/api/compliance/rules/toggle')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ code: 'VELOCITY_SINGLE_TX', isActive: false })
          .expect(500);
      } finally {
        complianceDb.complianceRule.update = original;
      }
    });

    it('GET /api/compliance/logs should handle errors', async () => {
      const original = complianceDb.complianceLog.findMany;
      complianceDb.complianceLog.findMany = () => { throw new Error("Mocked logs error"); };
      try {
        await request(app)
          .get('/api/compliance/logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(500);
      } finally {
        complianceDb.complianceLog.findMany = original;
      }
    });

    it('POST /api/compliance/reports/generate should handle errors', async () => {
      complianceOverrides.generateComplianceReport = () => { throw new Error("Mocked report creation error"); };
      try {
        await request(app)
          .post('/api/compliance/reports/generate')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ type: 'DAILY' })
          .expect(500);
      } finally {
        complianceOverrides.generateComplianceReport = null;
      }
    });

    it('GET /api/compliance/reports should handle errors', async () => {
      const original = complianceDb.complianceReport.findMany;
      complianceDb.complianceReport.findMany = () => { throw new Error("Mocked reports list error"); };
      try {
        await request(app)
          .get('/api/compliance/reports')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(500);
      } finally {
        complianceDb.complianceReport.findMany = original;
      }
    });

    it('GET /api/compliance/reports/:id should handle errors', async () => {
      const original = complianceDb.complianceReport.findUnique;
      complianceDb.complianceReport.findUnique = () => { throw new Error("Mocked report detail error"); };
      try {
        await request(app)
          .get('/api/compliance/reports/some-id')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(500);
      } finally {
        complianceDb.complianceReport.findUnique = original;
      }
    });

    it('GET /api/compliance/profile should trigger lazy profile creation', async () => {
      const email = `lazy-user-${Date.now()}@korri.pay`;
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email, password: 'securePassword123', name: 'Lazy User' })
        .expect(200);

      const token = res.body.token;

      // Request /profile on this new user; profile is not created yet, so it lazy creates
      const profileRes = await request(app)
        .get('/api/compliance/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileRes.body.profile).to.not.be.undefined;
      expect(profileRes.body.profile.riskLevel).to.equal('Low');
    });
  });
});
