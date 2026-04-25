# Documentation Center

This repository is documented for two primary audiences:

1. **Users / Integrators** (application teams, platform engineers, developer tooling owners)
2. **Administrators / Governance Owners** (security, compliance, identity, and operations)

## Start here

- **User documentation:** [`docs/user-guide.md`](./user-guide.md)
- **Administrator documentation:** [`docs/admin-guide.md`](./admin-guide.md)
- **Repository completeness assessment:** [`docs/repo-completeness-assessment.md`](./repo-completeness-assessment.md)
- **Protocol specifications:** [`specs/README.md`](../specs/README.md)
- **Examples:** [`examples/README.md`](../examples/README.md)

## Documentation standards

All production documentation in this repository follows these principles:

- **Trust-before-execution first:** no governed action proceeds without runtime authorization.
- **Clear contract boundaries:** TTP expresses trust context; SCIM-RE/RAP enforce runtime authority.
- **Auditability:** every decision creates an `ExecutionReceipt`.
- **Enterprise readability:** concise, deterministic language suitable for architecture, security, and audit review.

## Canonical terms

- **TTP** — Trust Expression Layer
- **SCIM-RE** — Runtime Execution Governance Protocol
- **RAP** — Runtime Authority Protocol
- **FrontDesk** — Runtime Authority Gate
