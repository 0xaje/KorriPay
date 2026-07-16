import { BaseRepository } from "./base.js";
import { SettlementStatus } from "@korripay/shared";

export class SettlementRepository extends BaseRepository {
  async createSettlement(organizationId: string, amount: number, currency: string) {
    return this.prisma.settlement.create({
      data: {
        organizationId,
        amount,
        currency,
        status: SettlementStatus.Requested,
      },
    });
  }

  async findSettlementById(id: string) {
    return this.prisma.settlement.findUnique({
      where: { id },
      include: {
        instructions: true,
        routes: true,
        fees: true,
        events: true,
      },
    });
  }

  async updateSettlementStatus(id: string, status: SettlementStatus, description: string) {
    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.update({
        where: { id },
        data: { status },
      });

      await tx.settlementEvent.create({
        data: {
          organizationId: settlement.organizationId,
          settlementId: id,
          status,
          description,
        },
      });

      return settlement;
    });
  }

  async createInstruction(organizationId: string, settlementId: string, payload: any) {
    return this.prisma.settlementInstruction.create({
      data: { organizationId, settlementId, payload },
    });
  }

  async createRoute(
    organizationId: string,
    settlementId: string,
    providerId: string,
    type: string,
    details: any,
    cost: number
  ) {
    return this.prisma.settlementRoute.create({
      data: { organizationId, settlementId, providerId, type, details, cost },
    });
  }

  async addFee(
    organizationId: string,
    settlementId: string,
    amount: number,
    currency: string,
    description: string
  ) {
    return this.prisma.settlementFee.create({
      data: { organizationId, settlementId, amount, currency, description },
    });
  }
}
