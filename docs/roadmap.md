# TTP Roadmap

This roadmap focuses on adoption, trust, and execution speed.

## What we optimize for

- Open, portable protocol semantics.
- Fast ecosystem execution across multiple contributor roles.
- Clear separation between open protocol assets and commercial operations.
- Documentation that stays aligned with what is actually implemented.

## Delivery tracks

- **Core protocol/runtime**: trust authority behavior, scoring correctness, token semantics.
- **Issuer ecosystem**: real adapters and stronger evidence coverage.
- **Verifier adoption**: policy adapters, middleware, deterministic enforcement defaults.
- **Agent/framework integration**: SDK ergonomics and runtime hooks.
- **Governance/security**: RFC process, conformance checks, threat updates.

## Phases

### Now (foundation)
- Stable spec + schemas
- Reference TA/issuer/verifier baseline
- Role-based docs and operator onboarding
- Initial CI and baseline tests

### Next (ecosystem expansion)
- More issuer adapters (tool/runtime/cloud telemetry)
- More verifier integrations (policy engines/frameworks)
- Conformance coverage and repeatable interop checks
- Better ops metrics and runbooks

### Later (enterprise + standardization)
- Multi-tenant operational controls
- Compliance/audit workflow maturity
- Institutional standardization track (CNCF and/or IETF)

## Near-term priorities from assessment

1. Increase test coverage for verification, authz routes, and failure modes.
2. Ship Python SDK parity for the agent ecosystem.
3. Replace stub issuers with practical adapters.
4. Publish one measurable real-world case study.
5. Add maintainer depth and strengthen external credibility.

## Public release guardrails

- Keep protocol-critical semantics and conformance assets public.
- Run open-source boundary audits before each release.
- Keep `ttp-language.md` and security/integration docs synchronized with implementation changes.
