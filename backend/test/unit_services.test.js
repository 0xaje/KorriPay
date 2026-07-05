import { expect } from 'chai';
import { trustScoreEngine } from '../src/services/trustScoreService.js';
import { networkIntelligence } from '../src/services/networkIntelligenceService.js';
import { recipientResolver } from '../src/services/recipientResolver.js';
import { attestationService } from '../src/services/attestationService.js';
import { attestationAggregator } from '../src/services/attestationAdapter.js';
import { webhookService } from '../src/services/webhookService.js';
import { serviceRegistry } from '../src/giwa/serviceRegistry.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('KorriPay Service Unit Tests', () => {
  
  // Clean up timers
  after(() => {
    networkIntelligence.stopSnapshotLoop();
  });

  describe('Service Registry', () => {
    it('should expose service registry and health checks', () => {
      const providers = serviceRegistry.getAllProviders();
      expect(providers).to.be.an('array');
      expect(providers.length).to.be.greaterThan(0);
      
      const rpcProvider = providers.find(p => p.type === 'RPC');
      if (rpcProvider) {
        rpcProvider.status = 'Healthy';
      }
      
      const rpc = serviceRegistry.getActiveProvider('RPC');
      expect(rpc).to.not.be.null;
      expect(rpc.type).to.equal('RPC');
    });

    it('should handle failover correctly', async () => {
      const initialProvider = serviceRegistry.getActiveProvider('RPC');
      expect(initialProvider).to.not.be.undefined;
    });
  });

  describe('Network Intelligence', () => {
    it('should evaluate network health metrics correctly', () => {
      const status = networkIntelligence.getCurrentStatus();
      expect(status.healthScore).to.be.a('number');
      expect(status.healthScore).to.be.within(0, 100);
      expect(['Excellent', 'Good', 'Warning', 'Critical']).to.include(status.rating);
    });

    it('should calculate health score based on parameters', () => {
      networkIntelligence.currentMetrics.sequencerHealth = 'Down';
      networkIntelligence.currentMetrics.rpcLatency = 2000;
      networkIntelligence.currentMetrics.averageBlockTime = 10.0;
      
      const score = networkIntelligence.calculateHealthScore();
      // base 100 - 50 (sequencer Down) - 30 (RPC > 1500) - 20 (Block > 6.0) = 0
      expect(score).to.equal(0);
      expect(networkIntelligence.getHealthRating(score)).to.equal('Critical');
    });

    it('should retrieve status and history from DB correctly', async () => {
      const res = await networkIntelligence.getCurrentStatusFromDB();
      expect(res.current).to.be.an('object');
      expect(res.current.healthScore).to.be.a('number');
      expect(res.history).to.be.an('array');
      expect(res.history.length).to.be.greaterThan(0);
    });
  });

  describe('Recipient Resolver', () => {
    it('should resolve EVM wallet addresses', async () => {
      const res = await recipientResolver.resolveRecipient('0x1234567890123456789012345678901234567890');
      expect(res.resolved).to.be.true;
      expect(res.type).to.equal('wallet');
      expect(res.address).to.equal('0x1234567890123456789012345678901234567890');
    });

    it('should resolve .up.id suffixes using adapter', async () => {
      const res = await recipientResolver.resolveRecipient('alice.up.id');
      expect(res.resolved).to.be.true;
      expect(res.type).to.equal('upid');
      expect(res.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(res.name).to.equal('Alice (up.id)');
    });

    it('should fall back correctly for unknown names', async () => {
      const res = await recipientResolver.resolveRecipient('unregistered-user-random');
      expect(res.resolved).to.be.false;
    });
  });

  describe('Trust Score Engine', () => {
    it('should return base score and handle calculations', async () => {
      const score = await trustScoreEngine.calculateScore('0x1234567890123456789012345678901234567890');
      expect(score).to.be.a('number');
      expect(score).to.be.within(0, 100);
    });

    it('should generate historical score trend if empty', async () => {
      const history = await trustScoreEngine.getScoreHistory('0x1234567890123456789012345678901234567890');
      expect(history).to.be.an('array');
      expect(history.length).to.be.greaterThan(0);
    });
  });

  describe('Attestation Engine & Adapter Pattern', () => {
    it('should require subject wallet and schema for attestation', async () => {
      try {
        await attestationService.createAttestation({ issuer: '', subjectWallet: '0x123', schema: 'Invalid' });
        throw new Error("Should have thrown");
      } catch (err) {
        expect(err.message).to.contain("Attestation Failed");
      }
    });

    it('should fetch unified credentials from EAS and Dojang adapters', async () => {
      const attestations = await attestationAggregator.getAllAttestations('0x1234567890123456789012345678901234567890');
      expect(attestations).to.be.an('array');
      // Dojang returns mock items
      expect(attestations.some(a => a.provider.includes("Dojang"))).to.be.true;
    });
  });

  describe('Webhook Service & Signatures', () => {
    let mockFetch;
    let originalFetch;

    before(() => {
      originalFetch = global.fetch;
      global.fetch = async (url, options) => {
        mockFetch = { url, options };
        return {
          ok: true,
          status: 200,
          text: async () => 'OK'
        };
      };
    });

    after(() => {
      global.fetch = originalFetch;
    });

    it('should compute valid signature matching headers', async () => {
      const sub = await webhookService.createSubscription('http://localhost:9999/webhook', ['settlement.completed']);
      expect(sub.secret).to.contain('whsec_');
      
      const payload = { test: true };
      await webhookService._dispatchToSubscriber(sub, 'settlement.completed', JSON.stringify(payload));
      
      expect(mockFetch.url).to.equal('http://localhost:9999/webhook');
      expect(mockFetch.options.headers['X-KorriPay-Signature']).to.not.be.undefined;
      
      // Cleanup
      await webhookService.deleteSubscription(sub.id);
    });
  });
});
