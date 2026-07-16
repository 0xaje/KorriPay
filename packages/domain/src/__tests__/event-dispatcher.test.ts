import { describe, it, expect, vi } from "vitest";
import { InMemoryEventDispatcher } from "../events/event-dispatcher.js";
import { createDomainEvent } from "../events/domain-event.js";
import { makeCorrelationId } from "../value-objects/identifiers.js";

describe("InMemoryEventDispatcher", () => {
  it("dispatches events to subscribed handlers", async () => {
    const dispatcher = new InMemoryEventDispatcher();
    const handler = vi.fn();

    dispatcher.subscribe("TestEvent", handler);
    const event = createDomainEvent(
      "TestEvent",
      "agg-1",
      "TestAggregate",
      makeCorrelationId("550e8400-e29b-41d4-a716-446655440000"),
      { data: "hello" }
    );
    await dispatcher.dispatch(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("does not call handler for unrelated event type", async () => {
    const dispatcher = new InMemoryEventDispatcher();
    const handler = vi.fn();

    dispatcher.subscribe("OtherEvent", handler);
    const event = createDomainEvent(
      "TestEvent",
      "agg-1",
      "TestAggregate",
      makeCorrelationId("550e8400-e29b-41d4-a716-446655440000"),
      {}
    );
    await dispatcher.dispatch(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("allows unsubscribing handlers", async () => {
    const dispatcher = new InMemoryEventDispatcher();
    const handler = vi.fn();

    dispatcher.subscribe("TestEvent", handler);
    dispatcher.unsubscribe("TestEvent", handler);
    const event = createDomainEvent(
      "TestEvent",
      "agg-1",
      "TestAggregate",
      makeCorrelationId("550e8400-e29b-41d4-a716-446655440000"),
      {}
    );
    await dispatcher.dispatch(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("logs dispatched events to eventLog", async () => {
    const dispatcher = new InMemoryEventDispatcher();
    const event = createDomainEvent(
      "TestEvent",
      "agg-1",
      "TestAggregate",
      makeCorrelationId("550e8400-e29b-41d4-a716-446655440000"),
      {}
    );
    await dispatcher.dispatch(event);

    expect(dispatcher.getEventLog()).toHaveLength(1);
    expect(dispatcher.getEventLog()[0]?.eventType).toBe("TestEvent");
  });

  it("clears event log", async () => {
    const dispatcher = new InMemoryEventDispatcher();
    const event = createDomainEvent(
      "TestEvent",
      "agg-1",
      "TestAggregate",
      makeCorrelationId("550e8400-e29b-41d4-a716-446655440000"),
      {}
    );
    await dispatcher.dispatch(event);
    dispatcher.clearEventLog();

    expect(dispatcher.getEventLog()).toHaveLength(0);
  });

  it("dispatches to multiple handlers for the same event type", async () => {
    const dispatcher = new InMemoryEventDispatcher();
    const h1 = vi.fn();
    const h2 = vi.fn();

    dispatcher.subscribe("TestEvent", h1);
    dispatcher.subscribe("TestEvent", h2);
    const event = createDomainEvent(
      "TestEvent",
      "agg-1",
      "TestAggregate",
      makeCorrelationId("550e8400-e29b-41d4-a716-446655440000"),
      {}
    );
    await dispatcher.dispatch(event);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });
});
