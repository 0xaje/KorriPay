import type { DomainEvent } from "./domain-event.js";

export type EventHandler<T = Record<string, unknown>> = (
  event: DomainEvent<T>
) => Promise<void> | void;

/** Pluggable event dispatcher interface — infrastructure will implement this */
export interface IEventDispatcher {
  dispatch<T>(event: DomainEvent<T>): Promise<void>;
  subscribe<T>(eventType: string, handler: EventHandler<T>): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}

/**
 * In-memory event dispatcher for domain use.
 * Infrastructure layers (Kafka, Redis Streams, etc.) can replace this at the composition root.
 */
export class InMemoryEventDispatcher implements IEventDispatcher {
  private readonly handlers = new Map<string, Set<EventHandler<any>>>();
  private readonly eventLog: DomainEvent<any>[] = [];

  async dispatch<T>(event: DomainEvent<T>): Promise<void> {
    this.eventLog.push(event);
    const handlers = this.handlers.get(event.eventType);
    if (!handlers) return;
    for (const handler of handlers) {
      await handler(event);
    }
  }

  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler<any>);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler as EventHandler<any>);
  }

  /** Returns a copy of all dispatched events (useful for testing) */
  getEventLog(): ReadonlyArray<DomainEvent<any>> {
    return [...this.eventLog];
  }

  /** Clear event log (useful between test cases) */
  clearEventLog(): void {
    this.eventLog.length = 0;
  }
}
