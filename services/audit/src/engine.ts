import { DomainMetrics, noopMetrics } from "@korripay/domain";
import type { AuditRepository } from "@korripay/database";

export type AuditEventType =
  | "SETTLEMENT_CREATED"
  | "SETTLEMENT_STATUS_CHANGED"
  | "COMPLIANCE_EVALUATED"
  | "FUNDS_RESERVED"
  | "FUNDS_RELEASED"
  | "IDENTITY_VERIFIED"
  | "IDENTITY_REJECTED"
  | "PROOF_GENERATED"
  | "ORG_CREATED"
  | "MEMBER_INVITED"
  | "SYSTEM_ERROR"
  | "MANUAL_APPROVAL";

export interface RecordEventCommand {
  event: AuditEventType;
  entity: string;
  entityId: string;
  userId?: string;
  organizationId?: string;
  correlationId: string;
  ipAddress?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

export class AuditEngine {
  constructor(
    private readonly auditRepo: AuditRepository,
    private readonly metrics: DomainMetrics = noopMetrics
  ) {}

  async recordEvent(cmd: RecordEventCommand): Promise<void> {
    await this.auditRepo.log(
      cmd.event,
      cmd.entity,
      cmd.entityId,
      cmd.userId ?? null,
      cmd.organizationId ?? null,
      cmd.correlationId as any,
      cmd.ipAddress ?? null,
      cmd.beforeState ?? null,
      cmd.afterState ?? null
    );
    this.metrics.increment("audit.event", { type: cmd.event });
  }

  async recordFailure(
    entity: string,
    entityId: string,
    error: Error,
    correlationId: string,
    organizationId?: string
  ): Promise<void> {
    await this.auditRepo.log(
      "SYSTEM_ERROR",
      entity,
      entityId,
      null,
      organizationId ?? null,
      correlationId as any,
      null,
      null,
      { errorMessage: error.message, errorCode: (error as any).code }
    );
    this.metrics.increment("audit.failure", { entity });
  }

  async recordApproval(
    settlementId: string,
    approverId: string,
    organizationId: string,
    correlationId: string
  ): Promise<void> {
    await this.auditRepo.log(
      "MANUAL_APPROVAL",
      "Settlement",
      settlementId,
      approverId,
      organizationId,
      correlationId as any,
      null,
      null,
      { approvedBy: approverId, approvedAt: new Date().toISOString() }
    );
  }

  async recordCompliance(
    settlementId: string,
    decision: Record<string, unknown>,
    correlationId: string,
    organizationId: string
  ): Promise<void> {
    await this.auditRepo.log(
      "COMPLIANCE_EVALUATED",
      "ComplianceAssessment",
      settlementId,
      null,
      organizationId,
      correlationId as any,
      null,
      null,
      decision
    );
  }
}
