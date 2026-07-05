import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { settlementService } from './settlementService.js';

const prisma = new PrismaClient();

export class OrganizationService {
  /**
   * Create a new corporate organization profile with an owner and base treasury wallets
   */
  async createOrganization(name, taxId, ownerUserId) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name,
          taxId,
          status: 'Verified'
        }
      });

      // 2. Add creator as Owner
      await tx.orgMember.create({
        data: {
          orgId: org.id,
          userId: ownerUserId,
          role: 'OWNER',
          dailySettlementLimit: 100000.00 // Owners start with a high threshold limit
        }
      });

      // 3. Provision main treasury wallets
      const currencies = ['USD', 'MockKRW', 'NGN'];
      for (const cur of currencies) {
        const mockAddress = '0x' + crypto.randomBytes(20).toString('hex');
        await tx.orgWallet.create({
          data: {
            orgId: org.id,
            currency: cur,
            address: mockAddress,
            available: cur === 'USD' ? 50000.00 : cur === 'MockKRW' ? 10000000.00 : 250000.00
          }
        });
      }

      // 4. Log creation
      await tx.orgAuditLog.create({
        data: {
          orgId: org.id,
          actorId: ownerUserId,
          action: 'ORG_CREATED',
          details: `Organization "${name}" successfully initialized by owner.`
        }
      });

      return org;
    });
  }

  /**
   * Get organization profile including members, wallets, approvals, and audit logs
   */
  async getOrganizationDetails(orgId) {
    return prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              select: { name: true, email: true, walletAddress: true }
            }
          }
        },
        wallets: true,
        approvalRequests: true,
        auditLogs: {
          orderBy: { timestamp: 'desc' },
          take: 50
        }
      }
    });
  }

  /**
   * Add a new member to the team
   */
  async addMember(orgId, userId, role, dailyLimit, actorUserId) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId } }
      });
      if (existing) throw new Error("User is already a member of this organization.");

      const newMember = await tx.orgMember.create({
        data: {
          orgId,
          userId,
          role,
          dailySettlementLimit: dailyLimit || 10000.00
        }
      });

      const userObj = await tx.user.findUnique({ where: { id: userId } });

      await tx.orgAuditLog.create({
        data: {
          orgId,
          actorId: actorUserId,
          action: 'MEMBER_ADDED',
          details: `Added user ${userObj?.email || userId} with role "${role}" and daily limit of $${dailyLimit || 10000.00}.`
        }
      });

      return newMember;
    });
  }

  /**
   * Update member roles and daily transaction limits
   */
  async updateMember(orgId, targetUserId, role, dailyLimit, actorUserId) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.orgMember.update({
        where: { orgId_userId: { orgId, userId: targetUserId } },
        data: {
          role,
          dailySettlementLimit: dailyLimit
        }
      });

      await tx.orgAuditLog.create({
        data: {
          orgId,
          actorId: actorUserId,
          action: 'MEMBER_UPDATED',
          details: `Updated user limit to $${dailyLimit} and role to "${role}".`
        }
      });

      return updated;
    });
  }

  /**
   * Remove member
   */
  async removeMember(orgId, targetUserId, actorUserId) {
    return prisma.$transaction(async (tx) => {
      const member = await tx.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId: targetUserId } }
      });
      if (!member) throw new Error("Member not found.");
      if (member.role === 'OWNER') throw new Error("Cannot remove the organization OWNER.");

      await tx.orgMember.delete({
        where: { orgId_userId: { orgId, userId: targetUserId } }
      });

      await tx.orgAuditLog.create({
        data: {
          orgId,
          actorId: actorUserId,
          action: 'MEMBER_REMOVED',
          details: `Removed user ${targetUserId} from team.`
        }
      });

      return { success: true };
    });
  }

  /**
   * Initiate settlement from Organization Treasury Wallet.
   * Enforces settlement limits and routes to Approval Workflows if limit is exceeded.
   */
  async initiateOrgSettlement(orgId, initiatorUserId, fromToken, toToken, amount, recipientDetails) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify initiator member status and limit
      const member = await tx.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId: initiatorUserId } }
      });
      if (!member) throw new Error("Access Denied: You are not a member of this organization.");
      
      if (['DEVELOPER', 'AUDITOR'].includes(member.role)) {
        throw new Error(`Role "${member.role}" is not authorized to initiate transactions.`);
      }

      // 2. Check treasury wallet balance
      const wallet = await tx.orgWallet.findUnique({
        where: { orgId_currency: { orgId, currency: fromToken } }
      });
      const numericAmount = parseFloat(amount);
      if (!wallet || wallet.available < numericAmount) {
        throw new Error(`Insufficient treasury reserves. Available: ${wallet?.available || 0} ${fromToken}`);
      }

      // Compute amount value in USD for limit validation
      let valueUSD = numericAmount;
      if (fromToken === 'MockKRW' || fromToken === 'KRW') {
        valueUSD = numericAmount * 0.00072;
      } else if (fromToken === 'NGN') {
        valueUSD = numericAmount * 0.00067;
      }

      // 3. Route to approval workflow if limit exceeded
      if (valueUSD > member.dailySettlementLimit) {
        // Exceeds limit -> lock the funds and create approval request
        await tx.orgWallet.update({
          where: { orgId_currency: { orgId, currency: fromToken } },
          data: {
            available: { decrement: numericAmount },
            locked: { increment: numericAmount }
          }
        });

        const reqDetails = JSON.stringify({ fromToken, toToken, amount, recipientDetails });
        const approval = await tx.approvalRequest.create({
          data: {
            orgId,
            initiatorId: initiatorUserId,
            type: 'SETTLEMENT',
            amount: valueUSD,
            currency: 'USD',
            payload: reqDetails,
            status: 'PENDING'
          }
        });

        await tx.orgAuditLog.create({
          data: {
            orgId,
            actorId: initiatorUserId,
            action: 'APPROVAL_REQUESTED',
            details: `Settlement request of ${amount} ${fromToken} exceeded daily limit ($${member.dailySettlementLimit.toFixed(2)} USD). Approval request #${approval.id} created.`
          }
        });

        return {
          status: 'PENDING_APPROVAL',
          approvalId: approval.id,
          message: `Daily settlement limit ($${member.dailySettlementLimit.toFixed(2)} USD) exceeded. Request sent to admins for approval.`
        };
      }

      // 4. Within limit -> Execute settlement directly
      // Deduct from corporate wallet
      await tx.orgWallet.update({
        where: { orgId_currency: { orgId, currency: fromToken } },
        data: { available: { decrement: numericAmount } }
      });

      // Invoke main settlement pipeline
      const settlement = await settlementService.createSettlementRequest({
        initiator: `org-${orgId}`,
        fromToken,
        toToken,
        amount,
        recipientDetails
      });

      await tx.orgAuditLog.create({
        data: {
          orgId,
          actorId: initiatorUserId,
          action: 'SETTLEMENT_EXECUTED',
          details: `Directly executed settlement ${settlement.id} for ${amount} ${fromToken}.`
        }
      });

      return {
        status: 'EXECUTED',
        settlementId: settlement.id
      };
    });
  }

  /**
   * Process approval workflow decision
   */
  async decideApproval(orgId, approvalId, approverUserId, status) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify approver rights
      const member = await tx.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId: approverUserId } }
      });
      if (!member || !['OWNER', 'ADMIN', 'FINANCE'].includes(member.role)) {
        throw new Error("Unauthorized: Only owners, admins, or finance roles can resolve approvals.");
      }

      const request = await tx.approvalRequest.findUnique({
        where: { id: approvalId }
      });
      if (!request || request.status !== 'PENDING') {
        throw new Error("Invalid or already resolved approval request.");
      }

      const payload = JSON.parse(request.payload);
      const amountNum = parseFloat(payload.amount);

      if (status === 'APPROVED') {
        // Unlock locked reserves and deduct permanently
        await tx.orgWallet.update({
          where: { orgId_currency: { orgId, currency: payload.fromToken } },
          data: { locked: { decrement: amountNum } }
        });

        // Trigger settlement engine
        const settlement = await settlementService.createSettlementRequest({
          initiator: `org-${orgId}`,
          fromToken: payload.fromToken,
          toToken: payload.toToken,
          amount: payload.amount,
          recipientDetails: payload.recipientDetails
        });

        await tx.approvalRequest.update({
          where: { id: approvalId },
          data: {
            status: 'APPROVED',
            approverId: approverUserId,
            decidedAt: new Date()
          }
        });

        await tx.orgAuditLog.create({
          data: {
            orgId,
            actorId: approverUserId,
            action: 'APPROVAL_APPROVED',
            details: `Approved transaction #${approvalId}. Settlement ${settlement.id} triggered.`
          }
        });

        return { success: true, settlementId: settlement.id };
      } else {
        // Rejected -> return locked funds back to available
        await tx.orgWallet.update({
          where: { orgId_currency: { orgId, currency: payload.fromToken } },
          data: {
            locked: { decrement: amountNum },
            available: { increment: amountNum }
          }
        });

        await tx.approvalRequest.update({
          where: { id: approvalId },
          data: {
            status: 'REJECTED',
            approverId: approverUserId,
            decidedAt: new Date()
          }
        });

        await tx.orgAuditLog.create({
          data: {
            orgId,
            actorId: approverUserId,
            action: 'APPROVAL_REJECTED',
            details: `Rejected transaction #${approvalId}. Reserves restored.`
          }
        });

        return { success: true, status: 'REJECTED' };
      }
    });
  }
}

export const organizationService = new OrganizationService();
