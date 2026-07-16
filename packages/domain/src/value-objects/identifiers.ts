/** Branded UUID types for domain identity safety */

declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type SettlementId = Brand<string, "SettlementId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type CorrelationId = Brand<string, "CorrelationId">;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid ${label}: "${value}" is not a valid UUID`);
  }
}

export function makeSettlementId(value: string): SettlementId {
  assertUuid(value, "SettlementId");
  return value as SettlementId;
}

export function makeOrganizationId(value: string): OrganizationId {
  assertUuid(value, "OrganizationId");
  return value as OrganizationId;
}

export function makeCorrelationId(value: string): CorrelationId {
  assertUuid(value, "CorrelationId");
  return value as CorrelationId;
}

/** Percentage value object — enforces 0–100 bounds */
export class Percentage {
  private readonly _value: number;

  private constructor(value: number) {
    if (value < 0 || value > 100) {
      throw new Error(`Percentage must be between 0 and 100, got: ${value}`);
    }
    this._value = value;
  }

  static of(value: number): Percentage {
    return new Percentage(value);
  }

  get value(): number {
    return this._value;
  }

  toDecimal(): number {
    return this._value / 100;
  }

  toString(): string {
    return `${this._value}%`;
  }
}
