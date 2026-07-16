# Contributing Guide

Welcome to the KorriPay core repository! We enforce strict engineering standards to ensure high-quality, auditable financial code.

## Development Workflow

1. **Setup Workspace**:
   Install all dependencies and link packages using pnpm workspace:

   ```bash
   pnpm install
   ```

2. **Run Dev Mode**:
   Launch dependencies and development servers:

   ```bash
   docker compose -f docker-compose.dev.yml up -d
   pnpm dev
   ```

3. **Verify Code Changes**:
   Ensure linter rules, type checking, and tests pass before proposing updates:
   ```bash
   pnpm run lint
   pnpm run type-check
   pnpm run test
   ```

## Commit Standards

We strictly enforce **Conventional Commits**:

- Format: `<type>(<scope>): <description>`
- Examples:
  - `feat(api): add authorization middleware`
  - `fix(settlement): correct precision rounding error`
  - `chore(deps): update prisma client`

All commit messages are validated before commit execution by Husky and `commitlint`.
