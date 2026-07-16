import { describe, it, expect } from "vitest";
import { Money } from "../value-objects/money.js";

describe("Money", () => {
  it("creates a Money instance with correct amount and currency", () => {
    const m = Money.of(100.5, "USD");
    expect(m.amount).toBe(100.5);
    expect(m.currency).toBe("USD");
  });

  it("stores amounts as minor units to avoid floating-point drift", () => {
    const m = Money.of(10.1, "USD");
    expect(m.amountMinorUnits).toBe(1010);
  });

  it("adds two Money values of the same currency", () => {
    const a = Money.of(10, "USD");
    const b = Money.of(5.5, "USD");
    expect(a.add(b).amount).toBe(15.5);
  });

  it("subtracts two Money values", () => {
    const a = Money.of(20, "USD");
    const b = Money.of(5, "USD");
    expect(a.subtract(b).amount).toBe(15);
  });

  it("throws on subtraction that would result in negative", () => {
    const a = Money.of(5, "USD");
    const b = Money.of(10, "USD");
    expect(() => a.subtract(b)).toThrow();
  });

  it("multiplies by a factor", () => {
    const m = Money.of(100, "USD");
    expect(m.multiply(0.1).amount).toBeCloseTo(10, 2);
  });

  it("throws on cross-currency operations", () => {
    const usd = Money.of(100, "USD");
    const eur = Money.of(90, "EUR");
    expect(() => usd.add(eur)).toThrow("Currency mismatch");
  });

  it("correctly identifies zero", () => {
    expect(Money.zero("USD").isZero()).toBe(true);
    expect(Money.of(1, "USD").isZero()).toBe(false);
  });

  it("compares amounts correctly", () => {
    const a = Money.of(100, "USD");
    const b = Money.of(50, "USD");
    expect(a.isGreaterThan(b)).toBe(true);
    expect(b.isLessThan(a)).toBe(true);
  });

  it("formats to string correctly", () => {
    expect(Money.of(1234.5, "NGN").toString()).toBe("1234.50 NGN");
  });

  it("throws on negative amount", () => {
    expect(() => Money.of(-1, "USD")).toThrow("Invalid amount");
  });
});
