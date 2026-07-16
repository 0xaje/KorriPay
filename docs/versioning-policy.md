# Versioning Policy

All workspace modules, packages, and smart contracts follow **Semantic Versioning (SemVer)** specifications.

## Version Format

Versions are formatted as: `MAJOR.MINOR.PATCH`

- **MAJOR**: Increment when you make incompatible API changes (e.g. database schema migrations breaking clients).
- **MINOR**: Increment when you add functionality in a backwards-compatible manner (e.g. adding new endpoints or helper packages).
- **PATCH**: Increment when you make backwards-compatible bug fixes.

## Smart Contract Deployments

- Smart contracts must maintain separate deployment versions matching active EVM address networks.
- Major releases of smart contracts trigger proxy upgrades or new contract proxy initializations, documented via ADRs.
