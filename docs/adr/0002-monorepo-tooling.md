# ADR 2: Monorepo Tooling Choice

## Status

Accepted

## Context

We require a repository architecture capable of supporting multiple microservices, React web applications, shared library packages, and Solidity smart contract environments without incurring build bottlenecks.

## Decision

We select:

- **pnpm Workspaces**: For high-speed dependency linking, disk-space reuse, and isolation.
- **TurboRepo**: For pipeline scheduling, package cache reuse, and script orchestration.
- **Hardhat**: As the isolated compiler and runner framework for our Solidity smart contracts.

## Consequences

- Every new package or application must be placed under their designated workspace group (`apps/`, `packages/`, `services/`, `contracts/`).
- Shared task pipelines (like compile, build, lint) must be orchestrated through Turbo.
