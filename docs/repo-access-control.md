# Repository Access Control Model

This document defines how to safely invite users before full public release.

## Goals

- Enable collaboration without exposing security-critical control paths.
- Preserve release integrity of protocol and reference implementations.
- Reduce insider and supply-chain risk during pre-public phase.

---

## Permission Tiers

### Tier 0 — Public/Invited Readers
- Access: read-only
- Use cases: evaluators, early adopters, documentation review

### Tier 1 — Contributors
- Access: fork + PR only (no direct write)
- Use cases: docs, examples, non-critical tooling

### Tier 2 — Maintainers
- Access: write/maintain with protected-branch workflow
- Use cases: merge reviewed PRs, manage milestones/issues

### Tier 3 — Core Security Owners
- Access: admin for protected settings/releases only
- Use cases: branch protection, secrets settings, security response, release signing

---

## Required Repo Controls

1. **Branch protections** on default branch
   - require PR
   - require status checks
   - require approvals
   - block force-push and deletion
2. **CODEOWNERS** for critical paths
   - protocol, security docs, trust authority runtime
3. **2FA enforcement** for org members/collaborators
4. **Secret scanning + push protection**
5. **Tag/release protection** for official versions

---

## PR Risk Routing

### Low risk
- docs/examples, no protocol or authz changes
- standard maintainer review

### Medium risk
- SDK behavior, middleware, admin endpoint UX
- maintainer + domain owner review

### High risk
- protocol semantics, token verification, authz gates, crypto, trust scoring
- mandatory security owner review + regression checks

---

## Invite Workflow (Pre-Public)

1. Invite as read-only by default.
2. After contribution quality review, allow fork+PR collaboration.
3. Grant write only when sustained trusted contribution is demonstrated.
4. Revoke elevated access quickly if risk posture changes.

---

## Audit Cadence

- Weekly: collaborator list + role review.
- Per release: CODEOWNERS coverage and branch protection validation.
- Quarterly: full permission and secret rotation audit.
