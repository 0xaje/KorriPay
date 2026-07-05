process.env.PORT = 5099; // Use non-conflicting port for tests
import request from 'supertest';
import { app } from '../server.js';
import { expect } from 'chai';
import { networkIntelligence } from '../src/services/networkIntelligenceService.js';

describe('KorriPay REST API Tests', () => {

  after(() => {
    // Stop loops to let process exit
    networkIntelligence.stopSnapshotLoop();
  });

  describe('Service Registry Endpoint', () => {
    it('GET /api/v1/giwa/services should return all available providers', async () => {
      const res = await request(app)
        .get('/api/v1/giwa/services')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.services).to.be.an('array');
      expect(res.body.services.length).to.be.greaterThan(0);
      expect(res.body.services[0]).to.have.property('name');
      expect(res.body.services[0]).to.have.property('type');
    });
  });

  describe('Network Intelligence Endpoint', () => {
    it('GET /api/v1/network should return GIWA network metrics and historical snapshots', async () => {
      const res = await request(app)
        .get('/api/v1/network')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.current).to.be.an('object');
      expect(res.body.current.healthScore).to.be.a('number');
      expect(res.body.history).to.be.an('array');
    });
  });

  describe('Treasury Metrics Endpoint', () => {
    it('GET /api/v1/treasury/metrics should return all analytical indexes', async () => {
      const res = await request(app)
        .get('/api/v1/treasury/metrics')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.metrics).to.not.be.undefined;
      expect(res.body.metrics.onChainReservesUSD).to.equal(2500000);
      expect(res.body.metrics.historicalAnalytics).to.be.an('array');
    });
  });

  describe('Corporate Organization Protection Endpoints', () => {
    it('GET /api/v1/organizations/my-org should deny access without a valid session token', async () => {
      const res = await request(app)
        .get('/api/v1/organizations/my-org')
        .expect(401);

      expect(res.body.error).to.contain("Session token required");
    });

    it('POST /api/v1/organizations should deny access without a valid session token', async () => {
      const res = await request(app)
        .post('/api/v1/organizations')
        .send({ name: "Unauthenticated Corp", taxId: "123" })
        .expect(401);

      expect(res.body.error).to.contain("Session token required");
    });
  });

  describe('Comprehensive API V1 Operations', () => {
    let testSettlementId;
    let testWebhookId;

    it('GET /api/v1/settlements should return list of settlements', async () => {
      const res = await request(app)
        .get('/api/v1/settlements')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.settlements).to.be.an('array');
    });

    it('GET /api/v1/proofs should return list of proofs', async () => {
      const res = await request(app)
        .get('/api/v1/proofs')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.proofs).to.be.an('array');
    });

    it('GET /api/v1/wallets should return current user wallet', async () => {
      const res = await request(app)
        .get('/api/v1/wallets')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.wallet).to.not.be.undefined;
      expect(res.body.wallet.balances).to.not.be.undefined;
    });

    it('GET /api/v1/attestations should list attestations', async () => {
      const res = await request(app)
        .get('/api/v1/attestations')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.attestations).to.be.an('array');
    });

    it('GET /api/v1/trust/attestations should list trust credentials', async () => {
      const res = await request(app)
        .get('/api/v1/trust/attestations')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.attestations).to.be.an('array');
    });

    it('GET /api/v1/trust/score should retrieve trust engine score details', async () => {
      const res = await request(app)
        .get('/api/v1/trust/score')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.score).to.be.a('number');
    });

    it('POST /api/v1/identity/verify should update identity status', async () => {
      const res = await request(app)
        .post('/api/v1/identity/verify')
        .set('Authorization', 'Bearer session-demo-test')
        .send({ status: 'Verified' })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.kyc.status).to.equal('Verified');
    });

    it('POST /api/v1/settlements should create a new settlement request', async () => {
      // First ensure balance is high enough
      await request(app)
        .post('/api/wallet/credit')
        .set('Authorization', 'Bearer session-demo-test')
        .send({ currency: 'USD', amount: 1000 })
        .expect(200);

      const res = await request(app)
        .post('/api/v1/settlements')
        .set('Authorization', 'Bearer session-demo-test')
        .send({
          recipient: "Bob v1 Recipient",
          amount: 250,
          recipientAddress: "0xbobrecipientaddress"
        })
        .expect(201);

      expect(res.body.success).to.be.true;
      testSettlementId = res.body.settlementId;
    });

    it('GET /api/v1/settlements/:id should return single settlement details', async () => {
      const res = await request(app)
        .get(`/api/v1/settlements/${testSettlementId}`)
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.settlement.id).to.equal(testSettlementId);
    });

    it('GET /api/v1/recipients/resolve should resolve EVM / up.id names', async () => {
      const res = await request(app)
        .get('/api/v1/recipients/resolve?query=jane.up.id')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);

      expect(res.body.resolved).to.be.true;
    });

    it('should manage webhook subscription lifecycle through V1 endpoints', async () => {
      // 1. Create Webhook
      const createRes = await request(app)
        .post('/api/v1/webhooks')
        .set('Authorization', 'Bearer session-demo-test')
        .send({ url: 'http://localhost:1234/v1hook', events: ['settlement.completed'] })
        .expect(201);

      expect(createRes.body.success).to.be.true;
      testWebhookId = createRes.body.subscription.id;

      // 2. Get Webhooks
      const listRes = await request(app)
        .get('/api/v1/webhooks')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);
      expect(listRes.body.subscriptions).to.be.an('array');

      // 3. Test Webhook console
      const testRes = await request(app)
        .post('/api/v1/webhooks/test')
        .set('Authorization', 'Bearer session-demo-test')
        .send({ event: 'settlement.completed', payload: { test: true } })
        .expect(200);
      expect(testRes.body.success).to.be.true;

      // 4. Get Webhook Delivery Logs
      const logsRes = await request(app)
        .get('/api/v1/webhooks/logs')
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);
      expect(logsRes.body.logs).to.be.an('array');

      // 5. Rotate Secret
      const rotateRes = await request(app)
        .post(`/api/v1/webhooks/${testWebhookId}/rotate`)
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);
      expect(rotateRes.body.success).to.be.true;

      // 6. Delete Webhook
      const deleteRes = await request(app)
        .delete(`/api/v1/webhooks/${testWebhookId}`)
        .set('Authorization', 'Bearer session-demo-test')
        .expect(200);
      expect(deleteRes.body.success).to.be.true;
    });
  });
});

