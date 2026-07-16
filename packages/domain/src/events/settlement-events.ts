import type { SettlementStatus } from "@korripay/shared";
import type { DomainEvent } from "./domain-event.js";
import type { CorrelationId, SettlementId, OrganizationId } from "../value-objects/identifiers.js";
import { createDomainEvent } from "./domain-event.js";

// ─── Event Payload Types ───────────────────────────────────────────────────

export interface SettlementRequestedPayload {
  settlementId: SettlementId;
  organizationId: OrganizationId;
  amount: number;
  currency: string;
}

export interface StatusChangedPayload {
  settlementId: SettlementId;
  organizationId: OrganizationId;
  previousStatus: SettlementStatus;
  newStatus: SettlementStatus;
}

export interface FundsReservedPayload {
  settlementId: SettlementId;
  organizationId: OrganizationId;
  amount: number;
  currency: string;
  poolId: string;
}

export interface ProofGeneratedPayload {
  settlementId: SettlementId;
  proofId: string;
  hash: string;
}

// ─── Event Factories ──────────────────────────────────────────────────────

export function settlementRequestedEvent(
  payload: SettlementRequestedPayload,
  correlationId: CorrelationId
): DomainEvent<SettlementRequestedPayload> {
  return createDomainEvent(
    "SettlementRequested",
    payload.settlementId,
    "Settlement",
    correlationId,
    payload
  );
}

export function compliancePassedEvent(
  payload: StatusChangedPayload,
  correlationId: CorrelationId
): DomainEvent<StatusChangedPayload> {
  return createDomainEvent(
    "CompliancePassed",
    payload.settlementId,
    "Settlement",
    correlationId,
    payload
  );
}

export function fundsReservedEvent(
  payload: FundsReservedPayload,
  correlationId: CorrelationId
): DomainEvent<FundsReservedPayload> {
  return createDomainEvent(
    "FundsReserved",
    payload.settlementId,
    "Settlement",
    correlationId,
    payload
  );
}

export function settlementSubmittedEvent(
  payload: StatusChangedPayload,
  correlationId: CorrelationId
): DomainEvent<StatusChangedPayload> {
  return createDomainEvent(
    "SettlementSubmitted",
    payload.settlementId,
    "Settlement",
    correlationId,
    payload
  );
}

export function settlementFinalizedEvent(
  payload: StatusChangedPayload,
  correlationId: CorrelationId
): DomainEvent<StatusChangedPayload> {
  return createDomainEvent(
    "SettlementFinalized",
    payload.settlementId,
    "Settlement",
    correlationId,
    payload
  );
}

export function proofGeneratedEvent(
  payload: ProofGeneratedPayload,
  correlationId: CorrelationId
): DomainEvent<ProofGeneratedPayload> {
  return createDomainEvent(
    "ProofGenerated",
    payload.settlementId,
    "Settlement",
    correlationId,
    payload
  );
}

export function settlementCompletedEvent(
  payload: StatusChangedPayload,
  correlationId: CorrelationId
): DomainEvent<StatusChangedPayload> {
  return createDomainEvent(
    "SettlementCompleted",
    payload.settlementId,
    "Settlement",
    correlationId,
    payload
  );
}
