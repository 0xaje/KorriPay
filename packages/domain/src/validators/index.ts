import { ValidationError } from "@korripay/errors";
import type { SupportedCurrency } from "@korripay/shared";

const SUPPORTED_CURRENCIES: Set<SupportedCurrency> = new Set(["USD", "EUR", "GBP", "XOF", "NGN"]);

export class SettlementValidator {
  static validateCurrency(currency: string): asserts currency is SupportedCurrency {
    if (!SUPPORTED_CURRENCIES.has(currency as SupportedCurrency)) {
      throw new ValidationError(`Unsupported currency: ${currency}`);
    }
  }

  static validateAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError(`Settlement amount must be a positive number, got: ${amount}`);
    }
  }

  static validateOrganizationId(orgId: string): void {
    if (!orgId?.trim()) {
      throw new ValidationError("Organization ID is required");
    }
  }
}

export class TreasuryValidator {
  static validateSufficientFunds(available: number, required: number): void {
    if (available < required) {
      throw new ValidationError(`Insufficient funds: required ${required}, available ${available}`);
    }
  }

  static validatePositiveAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError(`Amount must be positive, got: ${amount}`);
    }
  }
}

export class ComplianceValidator {
  static validateScore(score: number): void {
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      throw new ValidationError(
        `Compliance score must be an integer between 0 and 100, got: ${score}`
      );
    }
  }

  static validateCountryCode(code: string): void {
    if (!/^[A-Z]{2}$/.test(code)) {
      throw new ValidationError(`Country code must be ISO 3166-1 alpha-2, got: ${code}`);
    }
  }
}
