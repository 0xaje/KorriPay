import { expect } from 'chai';
import { organizationService } from '../src/services/organizationService.js';
import { trustScoreEngine } from '../src/services/trustScoreService.js';
import { networkIntelligence } from '../src/services/networkIntelligenceService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('KorriPay Corporate E2E Workflow Tests', () => {
  let e2eUser;
  let e2eOrg;
  let e2eMemberUser;

  before(async () => {
    // 1. Setup E2E specific users
    e2eUser = await prisma.user.create({
      data: {
        name: "E2E Owner",
        email: `e2e_owner_${Date.now()}@korripay.com`,
        walletAddress: `0xe2e1${Math.random().toString(16).substring(2, 38)}`
      }
    });

    e2eMemberUser = await prisma.user.create({
      data: {
        name: "E2E Team Member",
        email: `e2e_member_${Date.now()}@korripay.com`,
        walletAddress: `0xe2e2${Math.random().toString(16).substring(2, 38)}`
      }
    });
  });

  after(async () => {
    // 2. Clean up data
    if (e2eOrg) {
      await prisma.organization.delete({ where: { id: e2eOrg.id } }).catch(() => {});
    }
    if (e2eUser) {
      await prisma.user.delete({ where: { id: e2eUser.id } }).catch(() => {});
    }
    if (e2eMemberUser) {
      await prisma.user.delete({ where: { id: e2eMemberUser.id } }).catch(() => {});
    }
    networkIntelligence.stopSnapshotLoop();
    await prisma.$disconnect();
  });

  it('should run a complete corporate remittance lifecycle with limits, escrow locks, approval and state machine execution', async () => {
    // Step 1: Initialize Workspace
    e2eOrg = await organizationService.createOrganization(
      "E2E Enterprise Testing LLC",
      "TAX-E2E-99",
      e2eUser.id
    );
    expect(e2eOrg.id).to.not.be.undefined;

    // Step 2: Add member with a small limit
    const member = await organizationService.addMember(
      e2eOrg.id,
      e2eMemberUser.id,
      'FINANCE',
      100.00, // $100 USD limit
      e2eUser.id
    );
    expect(member.dailySettlementLimit).to.equal(100.00);

    // Step 3: Check Treasury Wallets available balance
    let details = await organizationService.getOrganizationDetails(e2eOrg.id);
    const usdWallet = details.wallets.find(w => w.currency === 'USD');
    expect(usdWallet.available).to.equal(50000.00);

    // Step 4: Initiate transaction within limit ($50 USD)
    const directRes = await organizationService.initiateOrgSettlement(
      e2eOrg.id,
      e2eMemberUser.id,
      'USD',
      'USDT',
      '50',
      'direct-recipient-address'
    );
    expect(directRes.status).to.equal('EXECUTED');
    expect(directRes.settlementId).to.not.be.undefined;

    // Step 5: Initiate transaction exceeding limit ($150 USD)
    const pendingRes = await organizationService.initiateOrgSettlement(
      e2eOrg.id,
      e2eMemberUser.id,
      'USD',
      'USDT',
      '150',
      'high-value-recipient-address'
    );
    expect(pendingRes.status).to.equal('PENDING_APPROVAL');

    // Step 6: Verify escrow lock
    details = await organizationService.getOrganizationDetails(e2eOrg.id);
    const updatedUsdWallet = details.wallets.find(w => w.currency === 'USD');
    expect(updatedUsdWallet.locked).to.equal(150.00);
    expect(updatedUsdWallet.available).to.equal(50000.00 - 50.00 - 150.00);

    // Step 7: Resolve approval
    const approvalRes = await organizationService.decideApproval(
      e2eOrg.id,
      pendingRes.approvalId,
      e2eUser.id,
      'APPROVED'
    );
    expect(approvalRes.success).to.be.true;

    // Step 8: Verify escrow unlock and settlement emission
    details = await organizationService.getOrganizationDetails(e2eOrg.id);
    const finalUsdWallet = details.wallets.find(w => w.currency === 'USD');
    expect(finalUsdWallet.locked).to.equal(0);

    // Step 9: Verify Trust Score Updates
    const trustScore = await trustScoreEngine.calculateScore(e2eMemberUser.walletAddress);
    expect(trustScore).to.be.a('number');
    expect(trustScore).to.be.greaterThanOrEqual(0);
  });
});
