import { Money } from "../value-objects/money.js";
import {
  makeSettlementId,
  makeOrganizationId,
  makeCorrelationId,
} from "../value-objects/identifiers.js";
import { PolicyViolationError } from "../errors/index.js";
import { SettlementPolicy } from "../policies/settlement-policy.js";
import type { SupportedCurrency } from "@korripay/shared";

export interface CreateSettlementInput {
  settlementId: string;
  organizationId: string;
  amount: number;
  currency: SupportedCurrency;
  correlationId: string;
}

export interface SettlementDomain {
  settlementId: ReturnType<typeof makeSettlementId>;
  organizationId: ReturnType<typeof makeOrganizationId>;
  amount: Money;
  correlationId: ReturnType<typeof makeCorrelationId>;
  createdAt: Date;
}

export class SettlementFactory {
  constructor(private readonly policy: SettlementPolicy = new SettlementPolicy()) {}

  create(input: CreateSettlementInput): SettlementDomain {
    const settlementId = makeSettlementId(input.settlementId);
    const organizationId = makeOrganizationId(input.organizationId);
    const correlationId = makeCorrelationId(input.correlationId);
    const amount = Money.of(input.amount, input.currency);

    if (!this.policy.isAmountWithinLimits(input.amount, input.currency)) {
      throw new PolicyViolationError(
        "SettlementAmountLimit",
        `Amount ${amount} exceeds policy limits for ${input.currency}`
      );
    }

    return { settlementId, organizationId, amount, correlationId, createdAt: new Date() };
  }
}

export class TreasuryFactory {
  static createLedgerRef(settlementId: string, operation: string): string {
    return `${operation}:${settlementId}:${Date.now()}`;
  }
}

export class ProofFactory {
  static createProofId(): string {
    return `proof_${crypto.randomUUID()}`;
  }

  static computeHash(data: string): string {
    // Simple deterministic hash — crypto primitives to be added in M4
    return Buffer.from(data).toString("base64url").substring(0, 64);
  }
}
