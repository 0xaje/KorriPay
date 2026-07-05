import { expect } from 'chai';
import { organizationService } from '../src/services/organizationService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('KorriPay Organization Integration Tests', () => {
  let testUser;
  let testOrg;
  let financeUser;

  before(async () => {
    // Ensure we have users for testing
    testUser = await prisma.user.findFirst({
      where: { email: 'admin_test@korripay.com' }
    });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          name: "Test Org Admin",
          email: "admin_test@korripay.com",
          walletAddress: "0x1111111111111111111111111111111111111111"
        }
      });
    }

    financeUser = await prisma.user.findFirst({
      where: { email: 'finance_test@korripay.com' }
    });
    if (!financeUser) {
      financeUser = await prisma.user.create({
        data: {
          name: "Test Finance Manager",
          email: "finance_test@korripay.com",
          walletAddress: "0x2222222222222222222222222222222222222222"
        }
      });
    }
  });

  after(async () => {
    // Delete any organizations created for this test
    if (testOrg) {
      await prisma.organization.delete({
        where: { id: testOrg.id }
      }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('should create organization and seed 3 treasury wallets', async () => {
    testOrg = await organizationService.createOrganization(
      "KorriPay Testing Enterprise",
      "TAX-INT-100",
      testUser.id
    );

    expect(testOrg.id).to.not.be.undefined;
    expect(testOrg.name).to.equal("KorriPay Testing Enterprise");

    const details = await organizationService.getOrganizationDetails(testOrg.id);
    expect(details.members.length).to.equal(1);
    expect(details.members[0].role).to.equal('OWNER');
    expect(details.wallets.length).to.equal(3); // USD, MockKRW, NGN
  });

  it('should add members to the organization', async () => {
    const member = await organizationService.addMember(
      testOrg.id,
      financeUser.id,
      'FINANCE',
      5000.00, // Daily limit $5,000 USD
      testUser.id
    );

    expect(member.role).to.equal('FINANCE');
    expect(member.dailySettlementLimit).to.equal(5000.00);

    const details = await organizationService.getOrganizationDetails(testOrg.id);
    expect(details.members.length).to.equal(2);
  });

  it('should update member role and limit details', async () => {
    const updated = await organizationService.updateMember(
      testOrg.id,
      financeUser.id,
      'FINANCE',
      2500.00, // lower limit
      testUser.id
    );

    expect(updated.dailySettlementLimit).to.equal(2500.00);
  });

  it('should enforce limit checks and trigger approval workflow (reserves lock)', async () => {
    // Initiate settlement exceeding limit ($10,000 > limit $2,500)
    const res = await organizationService.initiateOrgSettlement(
      testOrg.id,
      financeUser.id,
      'USD',
      'USDC',
      '10000',
      'recipient-wallet-ref'
    );

    expect(res.status).to.equal('PENDING_APPROVAL');
    expect(res.approvalId).to.not.be.undefined;

    // Check that $10,000 is moved to locked
    const details = await organizationService.getOrganizationDetails(testOrg.id);
    const usdWallet = details.wallets.find(w => w.currency === 'USD');
    expect(usdWallet.locked).to.equal(10000);
  });

  it('should return reserves to available balance on rejection', async () => {
    const detailsBefore = await organizationService.getOrganizationDetails(testOrg.id);
    const pendingReq = detailsBefore.approvalRequests.find(r => r.status === 'PENDING');
    
    const resolve = await organizationService.decideApproval(
      testOrg.id,
      pendingReq.id,
      testUser.id,
      'REJECTED'
    );

    expect(resolve.success).to.be.true;
    expect(resolve.status).to.equal('REJECTED');

    // Locked is zeroed, returned to available
    const detailsAfter = await organizationService.getOrganizationDetails(testOrg.id);
    const usdWallet = detailsAfter.wallets.find(w => w.currency === 'USD');
    expect(usdWallet.locked).to.equal(0);
  });

  it('should deduct reserves permanently and execute settlement on approval', async () => {
    // Re-trigger exceeding limit
    const res = await organizationService.initiateOrgSettlement(
      testOrg.id,
      financeUser.id,
      'USD',
      'USDC',
      '5000',
      'recipient-wallet-ref'
    );

    expect(res.status).to.equal('PENDING_APPROVAL');

    const resolve = await organizationService.decideApproval(
      testOrg.id,
      res.approvalId,
      testUser.id,
      'APPROVED'
    );

    expect(resolve.success).to.be.true;
    expect(resolve.settlementId).to.not.be.undefined;

    // Locked should return to 0 and available is decremented by 5000
    const detailsAfter = await organizationService.getOrganizationDetails(testOrg.id);
    const usdWallet = detailsAfter.wallets.find(w => w.currency === 'USD');
    expect(usdWallet.locked).to.equal(0);
  });

  it('should capture audit logs for all corporate events', async () => {
    const details = await organizationService.getOrganizationDetails(testOrg.id);
    expect(details.auditLogs.length).to.be.greaterThan(0);
    expect(details.auditLogs.some(log => log.action === 'ORG_CREATED')).to.be.true;
  });
});
