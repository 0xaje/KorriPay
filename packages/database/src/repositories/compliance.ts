import { BaseRepository } from "./base.js";
import { ComplianceStatus } from "@korripay/shared";

export class ComplianceRepository extends BaseRepository {
  async createAssessment(
    organizationId: string,
    settlementId: string,
    score: number,
    details: any,
    status: ComplianceStatus
  ) {
    return this.prisma.complianceAssessment.create({
      data: { organizationId, settlementId, score, details, status },
    });
  }

  async findAssessmentsBySettlementId(settlementId: string) {
    return this.prisma.complianceAssessment.findMany({
      where: { settlementId },
    });
  }

  async createRule(organizationId: string, name: string, description: string, parameters: any) {
    return this.prisma.complianceRule.create({
      data: { organizationId, name, description, parameters },
    });
  }

  async getActiveRules(organizationId: string) {
    return this.prisma.complianceRule.findMany({
      where: { organizationId, isActive: true },
    });
  }

  async createRiskAssessment(
    organizationId: string,
    targetId: string,
    targetType: string,
    score: number,
    details: any
  ) {
    return this.prisma.riskAssessment.create({
      data: { organizationId, targetId, targetType, score, details },
    });
  }

  async saveSanctionResult(
    organizationId: string,
    query: string,
    hits: any,
    details: any,
    status: ComplianceStatus
  ) {
    return this.prisma.sanctionResult.create({
      data: { organizationId, query, hits, details, status },
    });
  }

  async upsertCountryPolicy(countryCode: string, blocked: boolean, rules: any) {
    return this.prisma.countryPolicy.upsert({
      where: { countryCode },
      update: { blocked, rules },
      create: { countryCode, blocked, rules },
    });
  }

  async getCountryPolicy(countryCode: string) {
    return this.prisma.countryPolicy.findUnique({
      where: { countryCode },
    });
  }
}
