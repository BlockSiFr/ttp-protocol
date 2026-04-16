# TTP Roadmap

This roadmap aligns technical delivery with a role-based collaboration model so the ecosystem can scale quickly without central bottlenecks.

## Guiding outcomes

1. Keep protocol trust semantics open and interoperable.
2. Let different contributor/operator roles build in parallel.
3. Separate open standards from premium operational products.
4. Keep implementation language/semantics docs aligned with the actual protocol surface.

---

## Role Lanes for Fast Scaling

### Lane A — Trust Authority / Network Core

Focus:
- protocol-conformant trust scoring and token issuance
- high-availability deployment patterns
- operator controls (registration, quarantine, incident response)

Scale impact:
- creates stable trust infrastructure others can build on
- enables shared enterprise or sector-wide deployments

### Lane B — Issuer Ecosystem

Focus:
- adapters for API gateways, runtimes, security monitors, network telemetry
- receipt quality and event taxonomies
- anti-collusion deployment guidance

Scale impact:
- grows evidence coverage quickly across tools/vendors
- improves trust quality without changing protocol core

### Lane C — Verifier Adoption

Focus:
- service middleware, policy-engine adapters, SDK helpers
- deterministic allow/deny patterns by domain
- low-latency verification and resilient fallback policies

Scale impact:
- turns protocol adoption into direct production enforcement
- reduces time-to-value for application teams

### Lane D — Agent & Framework Integration

Focus:
- token lifecycle UX in agent frameworks
- default-safe runtime integration
- observability hooks for trust feedback loops

Scale impact:
- increases developer reach and day-1 usability
- makes trust-aware behavior the default in agent tooling

### Lane E — Governance, Security, and Adoption

Focus:
- RFC governance, conformance tests, threat-model updates
- docs, runbooks, and implementation examples
- ecosystem coordination across vendors and enterprises

Scale impact:
- keeps multi-implementation trust high
- prevents fragmentation while adoption accelerates

---

## Collaboration Model

To move quickly, we collaborate via:

- **Spec track:** RFC issues + conformance vectors.
- **Implementation track:** reference components and adapter repos.
- **Operator track:** runbooks, incident drills, SLO templates.
- **Ecosystem track:** partner-maintained adapters and verifier modules.

This model allows independent teams to ship in parallel while preserving a stable core protocol.

---

## Phased Delivery

### Phase 1 — Foundation (Now)
- Stable spec + schemas
- Reference Trust Authority and issuer implementations
- Basic verifier middleware patterns
- Role-based docs and operator onboarding

### Phase 2 — Ecosystem Expansion
- More issuer adapters (gateway/runtime/network)
- More verifier integrations (policy engines, service frameworks)
- Conformance suite publication for independent implementations
- Baseline operational dashboards and metrics definitions

### Phase 3 — Enterprise Scale
- Multi-tenant operational controls
- Audit/compliance packaging
- Advanced reliability and disaster-recovery patterns
- Mature operator playbooks and incident automation

### Phase 4 — Standardization
- Formal standardization track
- Cross-vendor interop certifications
- Large-scale ecosystem governance model

---

## Open Stewardship and Commercialization Decision Framework

To avoid reactive or ad-hoc packaging decisions, use a repeatable framework:

### 1) Protocol Integrity Test

A capability should stay in the open protocol commons if removing it would:
- break independent interoperability,
- weaken auditability of trust semantics, or
- create vendor lock-in around trust decisions.

### 2) Operational Differentiation Test

A capability may be commercialized if value is primarily from:
- reliability and scale operations,
- enterprise process depth (governance/workflow),
- support commitments, or
- convenience acceleration that does not alter protocol semantics.

### 3) Portability Test

For any paid feature, ensure customers can still:
- export evidence and policy-relevant artifacts,
- migrate to another compliant implementation,
- preserve continuity of trust semantics and verification outcomes.

### 4) Ecosystem Fairness Test

Before launch, check whether the feature:
- suppresses third-party adapter ecosystem growth,
- creates asymmetric access to safety-critical primitives,
- conflicts with neutral governance goals.

### 5) Governance Review Gate

Run new packaging decisions through a governance checkpoint:
- publish rationale,
- document boundary assumptions,
- gather community feedback,
- re-evaluate after adoption telemetry.

Outcome: commercialization remains aligned with ecosystem trust, while open stewardship protects interoperability at scale.

---

## Success Metrics

Track scale and health with:

- Number of active issuers per deployment/domain
- Verifier-enforced protected actions/day
- Time-to-onboard for new teams
- Mean time to quarantine / mitigate risky agents
- Number of independent conformant implementations
- % production deployments using multi-issuer evidence

---

## Documentation Accuracy Milestone

To prevent drift between aspirational concepts and implemented behavior:

- maintain `ttp-language.md` as a semantics document tied to current protocol artifacts,
- require doc updates when endpoint/claim semantics change,
- include doc-accuracy checks in release readiness review.

## Public Release Boundary Milestone

To keep the public repository open and interoperable while allowing commercial offerings outside the repo:

- enforce the boundary rules in `docs/open-source-boundary.md`,
- add release-time audits for accidental premium artifact inclusion,
- keep protocol-critical semantics and conformance artifacts in public scope.

## Assessment-Driven Execution Priorities (Near-Term)

To convert protocol promise into adoption momentum, prioritize:

1. **Credibility foundations**
   - expand automated tests (aggregation, verification, route authz paths)
   - maintain CI-required checks for build + tests on every PR
2. **Adoption surface**
   - ship Python SDK parity for agent-framework ecosystems
   - publish real issuer adapters beyond stubs (tool-call, callback, cloud telemetry)
3. **Proof of value**
   - publish one measured production-style case study with outcomes
   - document integration time and policy-violation prevention metrics
4. **Ecosystem trust**
   - add at least one additional maintainer/reviewer
   - progress an institutional standardization lane (CNCF sandbox and/or IETF draft)
5. **Protocol confidence**
   - keep aggregation and verifier behavior rigorously specified and test-backed
   - preserve deterministic enforcement guidance to avoid silent failure modes
