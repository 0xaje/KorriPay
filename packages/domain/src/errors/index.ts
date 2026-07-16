import { DomainError } from "@korripay/errors";

export class InvalidSettlementStateError extends DomainError {
  constructor(from: string, to: string) {
    super(`Invalid settlement state transition: ${from} → ${to}`, "INVALID_SETTLEMENT_STATE", {
      from,
      to,
    });
  }
}

export class ComplianceRejectedError extends DomainError {
  constructor(reason: string, score?: number) {
    super(`Compliance check rejected: ${reason}`, "COMPLIANCE_REJECTED", { reason, score });
  }
}

export class LiquidityUnavailableError extends DomainError {
  constructor(required: string, available: string) {
    super(
      `Insufficient liquidity: required ${required}, available ${available}`,
      "LIQUIDITY_UNAVAILABLE",
      { required, available }
    );
  }
}

export class IdentityVerificationFailedError extends DomainError {
  constructor(reason: string) {
    super(`Identity verification failed: ${reason}`, "IDENTITY_VERIFICATION_FAILED", { reason });
  }
}

export class ProofGenerationError extends DomainError {
  constructor(reason: string) {
    super(`Proof generation failed: ${reason}`, "PROOF_GENERATION_FAILED", { reason });
  }
}

export class DuplicateSettlementError extends DomainError {
  constructor(settlementId: string) {
    super(`Duplicate settlement request: ${settlementId}`, "DUPLICATE_SETTLEMENT", {
      settlementId,
    });
  }
}

export class PolicyViolationError extends DomainError {
  constructor(policy: string, reason: string) {
    super(`Policy violation [${policy}]: ${reason}`, "POLICY_VIOLATION", { policy, reason });
  }
}
