import { describe, it, expect } from "vitest";
import { SettlementStateMachine } from "../state-machine/settlement-state-machine.js";
import { SettlementStatus } from "@korripay/shared";
import { InvalidSettlementStateError } from "../errors/index.js";

describe("SettlementStateMachine", () => {
  describe("transition()", () => {
    it("allows REQUESTED → IDENTITY_VERIFIED", () => {
      expect(
        SettlementStateMachine.transition(
          SettlementStatus.Requested,
          SettlementStatus.IdentityVerified
        )
      ).toBe(SettlementStatus.IdentityVerified);
    });

    it("allows full happy path", () => {
      const path = [
        [SettlementStatus.Requested, SettlementStatus.IdentityVerified],
        [SettlementStatus.IdentityVerified, SettlementStatus.ComplianceApproved],
        [SettlementStatus.ComplianceApproved, SettlementStatus.LiquidityReserved],
        [SettlementStatus.LiquidityReserved, SettlementStatus.RouteSelected],
        [SettlementStatus.RouteSelected, SettlementStatus.Ready],
        [SettlementStatus.Ready, SettlementStatus.Submitted],
        [SettlementStatus.Submitted, SettlementStatus.Accepted],
        [SettlementStatus.Accepted, SettlementStatus.Finalized],
        [SettlementStatus.Finalized, SettlementStatus.Attested],
        [SettlementStatus.Attested, SettlementStatus.ProofGenerated],
        [SettlementStatus.ProofGenerated, SettlementStatus.Completed],
      ] as [SettlementStatus, SettlementStatus][];

      for (const [from, to] of path) {
        expect(SettlementStateMachine.transition(from, to)).toBe(to);
      }
    });

    it("throws on invalid transition REQUESTED → COMPLETED", () => {
      expect(() =>
        SettlementStateMachine.transition(SettlementStatus.Requested, SettlementStatus.Completed)
      ).toThrow(InvalidSettlementStateError);
    });

    it("throws on backward transition COMPLETED → REQUESTED", () => {
      expect(() =>
        SettlementStateMachine.transition(SettlementStatus.Completed, SettlementStatus.Requested)
      ).toThrow(InvalidSettlementStateError);
    });

    it("throws when attempting to transition from FAILED", () => {
      expect(() =>
        SettlementStateMachine.transition(SettlementStatus.Failed, SettlementStatus.Requested)
      ).toThrow(InvalidSettlementStateError);
    });

    it("allows REQUESTED → CANCELLED", () => {
      expect(
        SettlementStateMachine.transition(SettlementStatus.Requested, SettlementStatus.Cancelled)
      ).toBe(SettlementStatus.Cancelled);
    });

    it("allows SUBMITTED → FAILED", () => {
      expect(
        SettlementStateMachine.transition(SettlementStatus.Submitted, SettlementStatus.Failed)
      ).toBe(SettlementStatus.Failed);
    });
  });

  describe("canTransition()", () => {
    it("returns true for valid transition", () => {
      expect(
        SettlementStateMachine.canTransition(
          SettlementStatus.Requested,
          SettlementStatus.IdentityVerified
        )
      ).toBe(true);
    });

    it("returns false for invalid transition", () => {
      expect(
        SettlementStateMachine.canTransition(SettlementStatus.Completed, SettlementStatus.Requested)
      ).toBe(false);
    });
  });

  describe("isTerminal()", () => {
    it("returns true for COMPLETED", () => {
      expect(SettlementStateMachine.isTerminal(SettlementStatus.Completed)).toBe(true);
    });

    it("returns true for FAILED, CANCELLED, REJECTED", () => {
      [SettlementStatus.Failed, SettlementStatus.Cancelled, SettlementStatus.Rejected].forEach(
        (s) => {
          expect(SettlementStateMachine.isTerminal(s)).toBe(true);
        }
      );
    });

    it("returns false for REQUESTED", () => {
      expect(SettlementStateMachine.isTerminal(SettlementStatus.Requested)).toBe(false);
    });
  });

  describe("allowedTransitions()", () => {
    it("returns valid next states from REQUESTED", () => {
      const next = SettlementStateMachine.allowedTransitions(SettlementStatus.Requested);
      expect(next).toContain(SettlementStatus.IdentityVerified);
      expect(next).toContain(SettlementStatus.Cancelled);
    });

    it("returns empty array from COMPLETED", () => {
      expect(SettlementStateMachine.allowedTransitions(SettlementStatus.Completed)).toEqual([]);
    });
  });
});
