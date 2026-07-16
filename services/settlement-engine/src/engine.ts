import { SettlementStatus } from "@korripay/shared";
import {
  SettlementStateMachine,
  SettlementValidator,
  InMemoryEventDispatcher,
  DomainMetrics,
  noopMetrics,
  makeCorrelationId,
  makeSettlementId,
  InvalidSettlementStateError,
  settlementRequestedEvent,
} from "@korripay/domain";
import type { IEventDispatcher } from "@korripay/domain";
import type { SettlementRepository } from "@korripay/database";
import type { AuditRepository } from "@korripay/database";

export interface CreateSettlementCommand {
  organizationId: string;
  amount: number;
  currency: string;
  correlationId: string;
}

export class SettlementEngine {
  constructor(
    private readonly settlementRepo: SettlementRepository,
    private readonly auditRepo: AuditRepository,
    private readonly eventDispatcher: IEventDispatcher = new InMemoryEventDispatcher(),
    private readonly metrics: DomainMetrics = noopMetrics
  ) {}

  async createSettlement(cmd: CreateSettlementCommand): Promise<string> {
    return this.metrics.time("settlement.create", { org: cmd.organizationId }, async () => {
      SettlementValidator.validateAmount(cmd.amount);
      SettlementValidator.validateCurrency(cmd.currency);
      SettlementValidator.validateOrganizationId(cmd.organizationId);

      const correlationId = makeCorrelationId(cmd.correlationId);

      const record = await this.settlementRepo.createSettlement(
        cmd.organizationId,
        cmd.amount,
        cmd.currency
      );

      const settlementId = makeSettlementId(record.id);

      await this.auditRepo.log(
        "SETTLEMENT_CREATED",
        "Settlement",
        record.id,
        null,
        cmd.organizationId,
        correlationId,
        null,
        null,
        { status: SettlementStatus.Requested, amount: cmd.amount, currency: cmd.currency }
      );

      await this.eventDispatcher.dispatch(
        settlementRequestedEvent(
          {
            settlementId,
            organizationId: cmd.organizationId as any,
            amount: cmd.amount,
            currency: cmd.currency,
          },
          correlationId
        )
      );

      this.metrics.increment("settlement.created", { currency: cmd.currency });
      return record.id;
    });
  }

  async progressSettlement(
    settlementId: string,
    nextStatus: SettlementStatus,
    description: string,
    correlationId: string
  ): Promise<void> {
    return this.metrics.time("settlement.progress", { status: nextStatus }, async () => {
      const existing = await this.settlementRepo.findSettlementById(settlementId);
      if (!existing) throw new InvalidSettlementStateError("NOT_FOUND", nextStatus);

      // Enforce state machine transition
      SettlementStateMachine.transition(existing.status as SettlementStatus, nextStatus);

      await this.settlementRepo.updateSettlementStatus(settlementId, nextStatus, description);

      await this.auditRepo.log(
        "SETTLEMENT_STATUS_CHANGED",
        "Settlement",
        settlementId,
        null,
        existing.organizationId,
        makeCorrelationId(correlationId),
        null,
        { status: existing.status },
        { status: nextStatus }
      );

      this.metrics.increment("settlement.transition", {
        from: existing.status,
        to: nextStatus,
      });
    });
  }

  async cancelSettlement(
    settlementId: string,
    correlationId: string,
    reason: string
  ): Promise<void> {
    return this.progressSettlement(settlementId, SettlementStatus.Cancelled, reason, correlationId);
  }

  async failSettlement(settlementId: string, correlationId: string, reason: string): Promise<void> {
    return this.progressSettlement(settlementId, SettlementStatus.Failed, reason, correlationId);
  }

  async completeSettlement(settlementId: string, correlationId: string): Promise<void> {
    return this.progressSettlement(
      settlementId,
      SettlementStatus.Completed,
      "Settlement protocol completed",
      correlationId
    );
  }

  async validateSettlement(
    settlementId: string
  ): Promise<{ valid: boolean; status: SettlementStatus; nextStates: SettlementStatus[] }> {
    const settlement = await this.settlementRepo.findSettlementById(settlementId);
    if (!settlement) return { valid: false, status: SettlementStatus.Failed, nextStates: [] };

    const status = settlement.status as SettlementStatus;
    return {
      valid: !SettlementStateMachine.isTerminal(status),
      status,
      nextStates: SettlementStateMachine.allowedTransitions(status),
    };
  }
}
