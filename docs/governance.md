# TTP Governance Model

## Overview

TTP is an open protocol. Its evolution is governed by a lightweight, specification-first process designed to keep the protocol stable, interoperable, and vendor-neutral.

---

## Principles

**Protocol stability over feature velocity.** Breaking changes are expensive for all implementers. We prefer measured, deliberate evolution over rapid iteration.

**Interoperability over completeness.** A smaller protocol that all implementations agree on is more valuable than a comprehensive protocol that spawns incompatible variants.

**Community input over unilateral decisions.** Significant changes go through an RFC process with public comment.

**Vendor neutrality.** No single company controls the protocol. BlockSiFr initiates changes but cannot unilaterally override community consensus for normative changes.

---

## Change Classification

| Type | Examples | Process |
|------|----------|---------|
| **Editorial** | Typo fixes, clarifications, examples | PR, maintainer review |
| **Additive** | New optional fields, new error codes, new endpoints | RFC (lightweight), 14-day comment |
| **Behavioral** | Changes to validation rules, aggregation algorithm | RFC (full), 30-day comment, multiple implementer review |
| **Breaking** | Removing fields, changing required semantics | RFC (full), new major version, 90-day deprecation notice |

---

## RFC Process

### Submitting an RFC

1. Open an issue in the GitHub repository titled `[RFC] Your Proposal Title`.
2. Describe: the problem being solved, proposed change, impact on existing implementations, alternatives considered.
3. Link to any existing implementations or prototypes.

### Review Period

- **Lightweight RFC:** 14 days open for comment.
- **Full RFC:** 30 days open for comment.

During the review period, anyone may comment, raise objections, or propose amendments.

### Acceptance

An RFC is accepted when:
- The comment period has elapsed.
- No unresolved blocking objections exist.
- At least one independent implementation has validated the change (for behavioral/breaking changes).
- Maintainers merge the RFC.

### Rejection

An RFC is rejected when:
- A blocking security concern is raised and not resolved.
- The change conflicts with a core design principle.
- Insufficient community support after the comment period.

---

## Versioning Policy

TTP uses semantic versioning at the protocol level.

**Patch (1.0.x):** Non-normative changes only. No implementation changes required.

**Minor (1.x.0):** Backwards-compatible additions. Old verifiers continue to function. New fields are optional. Old implementations may ignore them.

**Major (x.0.0):** Breaking changes. New `ttp_version` value in receipts and tokens. Implementations must explicitly opt in. A deprecation notice of at least 90 days precedes a major version bump.

---

## Maintainers

Current maintainers:

- **BlockSiFr** (initiating organization) — responsible for specification stewardship during v1.x
- Additional maintainers from the community added as the ecosystem matures

Maintainers review PRs, moderate RFCs, and publish new spec versions. They do not have unilateral authority over behavioral changes.

---

## Becoming a Maintainer

Regular contributors who demonstrate understanding of the protocol's goals and a pattern of high-quality contributions may be invited to become maintainers. The current maintainers make this decision by consensus.

---

## Independent Implementations

TTP explicitly encourages independent implementations. An implementation that passes the conformance test vectors is a conformant implementation, regardless of who built it.

Independent implementations strengthen the protocol by:
- Validating that the spec is implementable
- Providing competition and choice
- Surfacing spec ambiguities
- Building ecosystem confidence

If you have a conformant implementation, open a PR to add it to the [implementations list](../README.md).

---

## Security Governance

Security vulnerabilities bypass the RFC process. They are handled through responsible disclosure directly to the security team (see [SECURITY.md](../SECURITY.md)).

Security fixes that require spec changes will be fast-tracked through an abbreviated RFC process with the relevant change classified and published after the fix is deployed.
