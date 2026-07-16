import type { SupportedCurrency } from "@korripay/shared";

/**
 * CTO Enhancement: Policy-based business rules.
 * Institutions customize behavior by configuring policies without code changes.
 */

export interface SettlementPolicyConfig {
  /** Maximum single settlement amount per currency */
  maxAmountByCurrency: Partial<Record<SupportedCurrency, number>>;
  /** Minimum settlement amount */
  minAmount: number;
  /** Supported source → destination currency corridors */
  supportedCorridors: Array<{ from: SupportedCurrency; to: SupportedCurrency }>;
  /** Maximum settlements per organization per hour */
  velocityLimitPerHour: number;
  /** Require manual approval above this amount (USD equivalent) */
  manualApprovalThreshold: number;
}

const DEFAULT_POLICY: SettlementPolicyConfig = {
  maxAmountByCurrency: {
    USD: 1_000_000,
    EUR: 900_000,
    GBP: 800_000,
    NGN: 500_000_000,
    XOF: 600_000_000,
  },
  minAmount: 1,
  supportedCorridors: [
    { from: "USD", to: "NGN" },
    { from: "USD", to: "XOF" },
    { from: "EUR", to: "NGN" },
    { from: "GBP", to: "NGN" },
    { from: "USD", to: "EUR" },
    { from: "EUR", to: "USD" },
  ],
  velocityLimitPerHour: 100,
  manualApprovalThreshold: 50_000,
};

export class SettlementPolicy {
  private readonly config: SettlementPolicyConfig;

  constructor(config: Partial<SettlementPolicyConfig> = {}) {
    this.config = { ...DEFAULT_POLICY, ...config };
  }

  isAmountWithinLimits(amount: number, currency: SupportedCurrency): boolean {
    if (amount < this.config.minAmount) return false;
    const max = this.config.maxAmountByCurrency[currency];
    if (max !== undefined && amount > max) return false;
    return true;
  }

  isCorridorSupported(from: SupportedCurrency, to: SupportedCurrency): boolean {
    return this.config.supportedCorridors.some((c) => c.from === from && c.to === to);
  }

  requiresManualApproval(amountUsd: number): boolean {
    return amountUsd >= this.config.manualApprovalThreshold;
  }

  get velocityLimitPerHour(): number {
    return this.config.velocityLimitPerHour;
  }
}
