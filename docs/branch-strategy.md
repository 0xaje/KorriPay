# Branch Strategy

KorriPay follows a GitFlow-inspired branching strategy to ensure a clean codebase and reliable deployments.

## Branch Types

1. **`main`**:
   - Production-ready branch. Holds current, deployed code.
   - Accepts commits only via Pull Requests from `develop` or `hotfix/*` branches.

2. **`develop`**:
   - Integration branch. Holds the next release development state.
   - Acceptance criteria require passing CI/CD tests.

3. **`feature/*`**:
   - Created from `develop` for active milestone features.
   - Named: `feature/milestone-feature-name` (e.g. `feature/m1-bootstrap`).

4. **`release/*`**:
   - Created from `develop` when planning stable tag releases.
   - Only bugfixes and documentation changes are permitted.

5. **`hotfix/*`**:
   - Created from `main` to address immediate production critical issues.
   - Merged back into both `main` and `develop` upon completion.
