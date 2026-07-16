import { SettlementStatus } from "@korripay/shared";
import { InvalidSettlementStateError } from "../errors/index.js";

/**
 * Settlement Protocol State Machine
 *
 * Enforces the exact protocol transition rules defined in the KorriPay blueprint.
 * All transitions must pass through this machine. Invalid transitions throw immediately.
 */

// Allowed transitions: Map<FROM, Set<TO>>
const ALLOWED_TRANSITIONS = new Map<SettlementStatus, Set<SettlementStatus>>([
  [
    SettlementStatus.Requested,
    new Set([
      SettlementStatus.IdentityVerified,
      SettlementStatus.Cancelled,
      SettlementStatus.Rejected,
    ]),
  ],
  [
    SettlementStatus.IdentityVerified,
    new Set([
      SettlementStatus.ComplianceApproved,
      SettlementStatus.Failed,
      SettlementStatus.Rejected,
    ]),
  ],
  [
    SettlementStatus.ComplianceApproved,
    new Set([SettlementStatus.LiquidityReserved, SettlementStatus.Failed]),
  ],
  [
    SettlementStatus.LiquidityReserved,
    new Set([SettlementStatus.RouteSelected, SettlementStatus.Failed, SettlementStatus.Cancelled]),
  ],
  [SettlementStatus.RouteSelected, new Set([SettlementStatus.Ready, SettlementStatus.Failed])],
  [SettlementStatus.Ready, new Set([SettlementStatus.Submitted, SettlementStatus.Cancelled])],
  [
    SettlementStatus.Submitted,
    new Set([SettlementStatus.Accepted, SettlementStatus.Failed, SettlementStatus.Rejected]),
  ],
  [SettlementStatus.Accepted, new Set([SettlementStatus.Finalized, SettlementStatus.Failed])],
  [SettlementStatus.Finalized, new Set([SettlementStatus.Attested, SettlementStatus.Failed])],
  [SettlementStatus.Attested, new Set([SettlementStatus.ProofGenerated, SettlementStatus.Failed])],
  [SettlementStatus.ProofGenerated, new Set([SettlementStatus.Completed])],
  // Terminal states — no further transitions
  [SettlementStatus.Completed, new Set()],
  [SettlementStatus.Failed, new Set()],
  [SettlementStatus.Cancelled, new Set()],
  [SettlementStatus.Rejected, new Set()],
]);

export const TERMINAL_STATES = new Set<SettlementStatus>([
  SettlementStatus.Completed,
  SettlementStatus.Failed,
  SettlementStatus.Cancelled,
  SettlementStatus.Rejected,
]);

export class SettlementStateMachine {
  /**
   * Validate and execute a state transition.
   * Throws InvalidSettlementStateError if the transition is not allowed.
   */
  static transition(current: SettlementStatus, next: SettlementStatus): SettlementStatus {
    const allowed = ALLOWED_TRANSITIONS.get(current);

    if (!allowed) {
      throw new InvalidSettlementStateError(current, next);
    }

    if (!allowed.has(next)) {
      throw new InvalidSettlementStateError(current, next);
    }

    return next;
  }

  /**
   * Check if a transition is valid without throwing.
   */
  static canTransition(current: SettlementStatus, next: SettlementStatus): boolean {
    return ALLOWED_TRANSITIONS.get(current)?.has(next) ?? false;
  }

  /**
   * Return all valid next states from a given state.
   */
  static allowedTransitions(from: SettlementStatus): SettlementStatus[] {
    return Array.from(ALLOWED_TRANSITIONS.get(from) ?? []);
  }

  /**
   * Check if the settlement is in a terminal (non-recoverable) state.
   */
  static isTerminal(status: SettlementStatus): boolean {
    return TERMINAL_STATES.has(status);
  }
}
