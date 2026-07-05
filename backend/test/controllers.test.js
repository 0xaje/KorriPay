process.env.PORT = 5098; // Separate port for controller testing
import request from 'supertest';
import { app } from '../server.js';
import { expect } from 'chai';
import { PrismaClient } from '@prisma/client';
import { networkIntelligence } from '../src/services/networkIntelligenceService.js';

const prisma = new PrismaClient();

describe('KorriPay Controller Route Tests', () => {
  let defaultUser;
  let defaultWallet;
  let testKyc;
  let testReport;
  let adminToken;

  before(async () => {
    // Retrieve seeded admin user and wallet
    defaultUser = await prisma.user.findFirst({ where: { email: 'jane.doe@korri.pay' } });
    if (!defaultUser) {
      defaultUser = await prisma.user.create({
        data: {
          name: "Jane Doe",
          email: "jane.doe@korri.pay",
          role: "ADMIN"
        }
      });
    }

    // Ensure the admin user is not suspended and has ADMIN role
    await prisma.user.update({
      where: { id: defaultUser.id },
      data: { role: 'ADMIN', suspended: false }
    });

    // Obtain a real JWT token for the admin user via demo login
    const authRes = await request(app)
      .post('/api/auth/demo')
      .send({ email: defaultUser.email, password: 'password' });
    adminToken = authRes.body.token;

    defaultWallet = await prisma.wallet.findFirst({ where: { userId: defaultUser.id } });
    if (!defaultWallet) {
      defaultWallet = await prisma.wallet.create({
        data: {
          userId: defaultUser.id,
          usdAvailable: 10000.00
        }
      });
    }

    // Seed compliance rules if not present
    const ruleCount = await prisma.complianceRule.count();
    if (ruleCount === 0) {
      await prisma.complianceRule.create({
        data: {
          code: 'TX_MAX_USD',
          name: 'Single Transaction Max USD Limit',
          isActive: true,
          value: 2000.0
        }
      });
    }

    // Seed a KYC record
    testKyc = await prisma.kyc.create({
      data: {
        userId: defaultUser.id,
        status: "PENDING"
      }
    });
  });

  after(async () => {
    if (testKyc) {
      await prisma.kyc.delete({ where: { id: testKyc.id } }).catch(() => {});
    }
    if (testReport) {
      await prisma.complianceReport.delete({ where: { id: testReport.id } }).catch(() => {});
    }
    networkIntelligence.stopSnapshotLoop();
    await prisma.$disconnect();
  });

  describe('GIWA Controller', () => {
    it('GET /api/giwa/status should return status details', async () => {
      const res = await request(app)
        .get('/api/giwa/status')
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.network).to.not.be.undefined;
      expect(res.body.sequencer).to.not.be.undefined;
    });
  });

  describe('FX Controller', () => {
    it('GET /api/fx/rates should return base exchange rates', async () => {
      const res = await request(app)
        .get('/api/fx/rates')
        .expect(200);

      expect(res.body.base).to.equal('USD');
      expect(res.body.rates).to.have.property('USD');
    });

    it('POST /api/fx/convert should calculate simple conversions', async () => {
      const res = await request(app)
        .post('/api/fx/convert')
        .send({ fromCurrency: 'USD', toAsset: 'MockKRW', amount: 100 })
        .expect(200);

      expect(res.body.output.netAmount).to.be.a('number');
    });

    it('POST /api/fx/quote should generate valid FX quotes', async () => {
      const res = await request(app)
        .post('/api/fx/quote')
        .send({ fromCurrency: 'USD', toAsset: 'MockKRW', amount: 100 })
        .expect(200);

      expect(res.body.output.netAmount).to.be.a('number');
    });

    it('GET /api/fx/fee should return current pricing configs', async () => {
      const res = await request(app)
        .get('/api/fx/fee')
        .expect(200);

      expect(res.body.feeRatePercent).to.be.a('string');
    });
  });

  describe('Wallet Controller', () => {
    it('GET /api/wallet should return current user wallet', async () => {
      const res = await request(app)
        .get('/api/wallet')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.currencies).to.not.be.undefined;
    });

    it('POST /api/wallet/credit should credit available balance', async () => {
      const res = await request(app)
        .post('/api/wallet/credit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 50 })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.wallet.currencies.USD.available).to.be.a('number');
    });

    it('POST /api/wallet/lock should move available funds to locked', async () => {
      const res = await request(app)
        .post('/api/wallet/lock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 20 })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.wallet.currencies.USD.locked).to.be.a('number');
    });

    it('POST /api/wallet/unlock should return locked funds to available', async () => {
      const res = await request(app)
        .post('/api/wallet/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'USD', amount: 10 })
        .expect(200);

      expect(res.body.success).to.be.true;
    });

    it('GET /api/wallet/summary should return balance aggregations', async () => {
      const res = await request(app)
        .get('/api/wallet/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.usd.available).to.be.a('number');
    });
  });

  describe('Compliance Controller', () => {
    it('GET /api/compliance/passport should load client credentials', async () => {
      const res = await request(app)
        .get('/api/compliance/passport')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.riskScore).to.be.a('number');
    });

    it('GET /api/compliance/rules should load screening parameters', async () => {
      const res = await request(app)
        .get('/api/compliance/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('POST /api/compliance/reports/generate should trigger compilation', async () => {
      const res = await request(app)
        .post('/api/compliance/reports/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'DAILY', days: 7 })
        .expect(200);

      expect(res.body.message).to.contain("success");
      testReport = res.body.report;
    });
  });

  describe('Admin Controller', () => {
    it('GET /api/admin/users should list all users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).to.be.an('array');
    });

    it('GET /api/admin/health should display system status indicators', async () => {
      const res = await request(app)
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.database).to.not.be.undefined;
      expect(res.body.rpc).to.not.be.undefined;
    });

    it('GET /api/admin/analytics should retrieve transaction volume reports', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.users).to.not.be.undefined;
      expect(res.body.transactions).to.not.be.undefined;
    });

    it('should manage users role and suspension', async () => {
      // Create a temporary user to avoid modifying the admin's own role/suspension state
      const tempUser = await prisma.user.create({
        data: {
          email: `temp-admin-test-${Date.now()}@example.com`,
          name: "Temporary Test User",
          role: "USER"
        }
      });

      // Suspend
      let res = await request(app)
        .post(`/api/admin/users/${tempUser.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ suspended: true })
        .expect(200);
      expect(res.body.user.suspended).to.be.true;

      // Unsuspend
      res = await request(app)
        .post(`/api/admin/users/${tempUser.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ suspended: false })
        .expect(200);
      expect(res.body.user.suspended).to.be.false;

      // Update role
      res = await request(app)
        .post(`/api/admin/users/${tempUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ADMIN' })
        .expect(200);
      expect(res.body.user.role).to.equal('ADMIN');

      // Clean up temp user
      await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => {});
    });

    it('GET /api/admin/wallets should list all wallets', async () => {
      const res = await request(app)
        .get('/api/admin/wallets')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body).to.be.an('array');
    });

    it('GET /api/admin/transactions should list all transactions', async () => {
      const res = await request(app)
        .get('/api/admin/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body).to.be.an('array');
    });

    it('GET /api/admin/settlements should list all settlements', async () => {
      const res = await request(app)
        .get('/api/admin/settlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body).to.be.an('array');
    });

    it('should manage KYC applications reviews', async () => {
      // Get KYC list
      let res = await request(app)
        .get('/api/admin/kyc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body).to.be.an('array');

      // Review KYC application
      res = await request(app)
        .post(`/api/admin/kyc/${testKyc.id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Verified' })
        .expect(200);
      expect(res.body.kyc.status).to.equal('Verified');
    });

    it('GET /api/admin/compliance should list all compliance check history logs', async () => {
      const res = await request(app)
        .get('/api/admin/compliance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.logs).to.be.an('array');
    });

    it('should manage attestations through admin operations', async () => {
      // Issue
      let res = await request(app)
        .post('/api/admin/attestations/issue')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subjectWallet: '0x0000000000000000000000000000000000000123',
          schema: 'payroll',
          details: { role: 'ADMIN', verified: true }
        })
        .expect(200);
      expect(res.body.attestation).to.not.be.undefined;
      const attId = res.body.attestation.id;

      // Get list
      res = await request(app)
        .get('/api/admin/attestations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body).to.be.an('array');

      // Revoke
      res = await request(app)
        .post(`/api/admin/attestations/${attId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.attestation.status).to.equal('Revoked');
    });

    it('GET /api/admin/audit-logs should return corporate audit logs list', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body).to.be.an('array');
    });
  });
});
