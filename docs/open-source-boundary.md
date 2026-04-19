# Open-Source Boundary (Public Release)

This repository is the **open protocol commons** for TTP.

## Public Repo Scope (Open Source)

The public repository includes:

- protocol specification and schemas
- reference implementations (baseline Trust Authority / issuer / verifier)
- SDK foundations and integration examples
- security model, governance process, and onboarding documentation
- conformance-oriented artifacts and developer tooling

These assets must remain portable and interoperable across independent implementations.

---

## Out-of-Scope for Public Repo (Commercial/Premium)

The following are intentionally **not** shipped in this public repository:

- compliance workflow products (audit automation, managed evidence pipelines)
- enterprise risk/compliance dashboards with paid support entitlements
- premium connectors requiring commercial contracts
- SLA-backed managed operations and incident response services
- paid policy simulation/assurance products tied to enterprise support

---

## Guardrails

Before each public release, verify:

1. No proprietary compliance/risk modules are included in repo paths.
2. Public APIs do not require paid entitlements to preserve protocol interoperability.
3. Docs do not imply vendor lock-in for core trust semantics.
4. Premium offering language is described as optional operational add-ons.
5. Security and governance docs remain neutral and implementation-portable.

---

## Decision Rule

If removing a feature would break interoperability, protocol auditability, or independent implementation viability, it belongs in the open-source repo.

If a feature's value is primarily operational service depth, managed reliability, or enterprise workflow convenience, it may be offered commercially outside this repo.
