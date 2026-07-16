import type { CorrelationId } from "../value-objects/identifiers.js";

/** Base domain event — all protocol events extend this */
export interface DomainEvent<T = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly correlationId: CorrelationId;
  readonly occurredAt: Date;
  readonly version: number;
  readonly payload: T;
}

export function createDomainEvent<T>(
  eventType: string,
  aggregateId: string,
  aggregateType: string,
  correlationId: CorrelationId,
  payload: T,
  version = 1
): DomainEvent<T> {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    aggregateId,
    aggregateType,
    correlationId,
    occurredAt: new Date(),
    version,
    payload,
  };
}
