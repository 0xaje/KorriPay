import type { SupportedCurrency } from "@korripay/shared";

/**
 * Money value object — immutable, currency-aware, arithmetic-safe.
 * Amounts are stored as integers (minor units) to avoid floating-point drift.
 */
export class Money {
  private readonly _amount: number; // stored in minor units (cents)
  private readonly _currency: SupportedCurrency;

  private constructor(amount: number, currency: SupportedCurrency) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }
    this._amount = Math.round(amount * 100); // store as cents
    this._currency = currency;
  }

  static of(amount: number, currency: SupportedCurrency): Money {
    return new Money(amount, currency);
  }

  static zero(currency: SupportedCurrency): Money {
    return new Money(0, currency);
  }

  get amount(): number {
    return this._amount / 100;
  }

  get amountMinorUnits(): number {
    return this._amount;
  }

  get currency(): SupportedCurrency {
    return this._currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money((this._amount + other._amount) / 100, this._currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this._amount - other._amount;
    if (result < 0) throw new Error("Money subtraction would result in negative value");
    return new Money(result / 100, this._currency);
  }

  multiply(factor: number): Money {
    return new Money((this._amount * factor) / 100, this._currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount > other._amount;
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount < other._amount;
  }

  equals(other: Money): boolean {
    return this._currency === other._currency && this._amount === other._amount;
  }

  isZero(): boolean {
    return this._amount === 0;
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this._currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(`Currency mismatch: ${this._currency} vs ${other._currency}`);
    }
  }
}
