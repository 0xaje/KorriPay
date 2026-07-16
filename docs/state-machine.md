# Settlement Protocol State Machine

This document describes the formal state machine governing the KorriPay settlement lifecycle.

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> REQUESTED : createSettlement()

    REQUESTED --> IDENTITY_VERIFIED : identity check passes
    REQUESTED --> CANCELLED : cancelled by operator
    REQUESTED --> REJECTED : rejected at intake

    IDENTITY_VERIFIED --> COMPLIANCE_APPROVED : compliance evaluation passes
    IDENTITY_VERIFIED --> FAILED : identity check fails
    IDENTITY_VERIFIED --> REJECTED : rejected by compliance

    COMPLIANCE_APPROVED --> LIQUIDITY_RESERVED : funds reserved
    COMPLIANCE_APPROVED --> FAILED : liquidity unavailable

    LIQUIDITY_RESERVED --> ROUTE_SELECTED : settlement route found
    LIQUIDITY_RESERVED --> FAILED : route unavailable
    LIQUIDITY_RESERVED --> CANCELLED : cancelled by operator

    ROUTE_SELECTED --> READY : all pre-checks pass
    ROUTE_SELECTED --> FAILED : validation fails

    READY --> SUBMITTED : submitted to network
    READY --> CANCELLED : cancelled before submission

    SUBMITTED --> ACCEPTED : network accepted
    SUBMITTED --> FAILED : network rejected
    SUBMITTED --> REJECTED : compliance hold

    ACCEPTED --> FINALIZED : settlement finalized on network
    ACCEPTED --> FAILED : finalization failure

    FINALIZED --> ATTESTED : attestation recorded
    FINALIZED --> FAILED : attestation failure

    ATTESTED --> PROOF_GENERATED : ZK proof / hash generated
    ATTESTED --> FAILED : proof generation failure

    PROOF_GENERATED --> COMPLETED : all steps verified

    COMPLETED --> [*]
    FAILED --> [*]
    CANCELLED --> [*]
    REJECTED --> [*]
```

## Valid Transitions Table

| From                  | To (valid)                                   |
| --------------------- | -------------------------------------------- |
| `REQUESTED`           | `IDENTITY_VERIFIED`, `CANCELLED`, `REJECTED` |
| `IDENTITY_VERIFIED`   | `COMPLIANCE_APPROVED`, `FAILED`, `REJECTED`  |
| `COMPLIANCE_APPROVED` | `LIQUIDITY_RESERVED`, `FAILED`               |
| `LIQUIDITY_RESERVED`  | `ROUTE_SELECTED`, `FAILED`, `CANCELLED`      |
| `ROUTE_SELECTED`      | `READY`, `FAILED`                            |
| `READY`               | `SUBMITTED`, `CANCELLED`                     |
| `SUBMITTED`           | `ACCEPTED`, `FAILED`, `REJECTED`             |
| `ACCEPTED`            | `FINALIZED`, `FAILED`                        |
| `FINALIZED`           | `ATTESTED`, `FAILED`                         |
| `ATTESTED`            | `PROOF_GENERATED`, `FAILED`                  |
| `PROOF_GENERATED`     | `COMPLETED`                                  |
| `COMPLETED`           | _(terminal)_                                 |
| `FAILED`              | _(terminal)_                                 |
| `CANCELLED`           | _(terminal)_                                 |
| `REJECTED`            | _(terminal)_                                 |

## Rules

1. **All transitions enforce the state machine.** Attempting an invalid transition throws `InvalidSettlementStateError`.
2. **Only `SettlementEngine` may change settlement state.** No other service calls `updateSettlementStatus` directly.
3. **Terminal states are irreversible.** `COMPLETED`, `FAILED`, `CANCELLED`, `REJECTED` have no outbound transitions.
4. **Every transition produces a `SettlementEvent` record** in the database — an immutable timeline.

## Implementation

```typescript
// packages/domain/src/state-machine/settlement-state-machine.ts
SettlementStateMachine.transition(current, next); // throws on invalid
SettlementStateMachine.canTransition(current, next); // returns boolean
SettlementStateMachine.isTerminal(status); // true for terminal states
SettlementStateMachine.allowedTransitions(from); // returns valid next states
```
