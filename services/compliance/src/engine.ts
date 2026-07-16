import { ComplianceStatus, RiskLevel } from "@korripay/shared";
import {
  ComplianceValidator,
  DomainMetrics,
  noopMetrics,
  makeCorrelationId,
  ComplianceRejectedError,
} from "@korripay/domain";
import type { ComplianceRepository, AuditRepository } from "@korripay/database";
import type { IComplianceProvider } from "@korripay/domain";

export interface EvaluateComplianceCommand {
  organizationId: string;
  settlementId: string;
  amount: number;
  currency: string;
  sourceCountry: string;
  destinationCountry: string;
  correlationId: string;
}

export interface ComplianceDecision {
  approved: boolean;
  status: ComplianceStatus;
  score: number;
  riskLevel: RiskLevel;
  flags: string[];
  details: Record<string, unknown>;
}

export class ComplianceEngine {
  private readonly complianceProvider?: IComplianceProvider;

  constructor(
    private readonly complianceRepo: ComplianceRepository,
    private readonly auditRepo: AuditRepository,
    externalProvider?: IComplianceProvider,
    private readonly metrics: DomainMetrics = noopMetrics
  ) {
    this.complianceProvider = externalProvider;
  }

  async evaluate(cmd: EvaluateComplianceCommand): Promise<ComplianceDecision> {
    return this.metrics.time("compliance.evaluate", { org: cmd.organizationId }, async () => {
      ComplianceValidator.validateCountryCode(cmd.sourceCountry);
      ComplianceValidator.validateCountryCode(cmd.destinationCountry);

      const correlationId = makeCorrelationId(cmd.correlationId);
      const flags: string[] = [];
      let score = 100; // Start with max score, deduct for risk factors

      // Country policy check
      const sourcePolicy = await this.complianceRepo.getCountryPolicy(cmd.sourceCountry);
      const destPolicy = await this.complianceRepo.getCountryPolicy(cmd.destinationCountry);

      if (sourcePolicy?.blocked) {
        flags.push(`Source country ${cmd.sourceCountry} is blocked`);
        score = 0;
      }
      if (destPolicy?.blocked) {
        flags.push(`Destination country ${cmd.destinationCountry} is blocked`);
        score = 0;
      }

      // Amount velocity: flag large transactions
      if (cmd.amount > 10_000) {
        flags.push("High-value transaction requires enhanced due diligence");
        score = Math.max(0, score - 20);
      }
      if (cmd.amount > 50_000) {
        flags.push("Very high value — manual review required");
        score = Math.max(0, score - 30);
      }

      // Active compliance rules check
      const rules = await this.complianceRepo.getActiveRules(cmd.organizationId);
      for (const rule of rules) {
        const params = rule.parameters as Record<string, unknown>;
        if (params["limit"] && cmd.amount > Number(params["limit"])) {
          flags.push(`Rule violation: ${rule.name}`);
          score = Math.max(0, score - 15);
        }
      }

      const approved = score >= 60 && flags.filter((f) => f.includes("blocked")).length === 0;
      // External provider slot — will augment decision when infrastructure wires it in
      void this.complianceProvider;
      const status = approved ? ComplianceStatus.Approved : ComplianceStatus.Rejected;

      const riskLevel =
        score >= 80
          ? RiskLevel.Low
          : score >= 60
            ? RiskLevel.Medium
            : score >= 30
              ? RiskLevel.High
              : RiskLevel.Critical;

      const decision: ComplianceDecision = {
        approved,
        status,
        score,
        riskLevel,
        flags,
        details: {
          sourceCountry: cmd.sourceCountry,
          destinationCountry: cmd.destinationCountry,
          amount: cmd.amount,
          currency: cmd.currency,
        },
      };

      await this.complianceRepo.createAssessment(
        cmd.organizationId,
        cmd.settlementId,
        score,
        decision,
        status
      );

      await this.auditRepo.log(
        "COMPLIANCE_EVALUATED",
        "ComplianceAssessment",
        cmd.settlementId,
        null,
        cmd.organizationId,
        correlationId,
        null,
        null,
        decision
      );

      this.metrics.increment("compliance.evaluated", {
        result: approved ? "approved" : "rejected",
      });
      this.metrics.gauge("compliance.score", score, { org: cmd.organizationId });

      if (!approved) {
        throw new ComplianceRejectedError(flags.join("; "), score);
      }

      return decision;
    });
  }

  async calculateRisk(
    organizationId: string,
    targetId: string,
    targetType: string
  ): Promise<number> {
    const score = Math.floor(Math.random() * 40) + 60; // Deterministic in real impl
    await this.complianceRepo.createRiskAssessment(organizationId, targetId, targetType, score, {
      computedAt: new Date().toISOString(),
    });
    return score;
  }

  async validateCountry(countryCode: string): Promise<boolean> {
    ComplianceValidator.validateCountryCode(countryCode);
    const policy = await this.complianceRepo.getCountryPolicy(countryCode);
    return !policy?.blocked;
  }
}
