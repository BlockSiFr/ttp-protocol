# Public Repository Readiness

This checklist is used to decide whether TTP is ready for a public launch.

## Current Assessment

**Status:** Adoption-ready for early technical evaluators; not yet ready for a broad public launch.

The repo now has a dependency-free local demo that shows the central value proposition: a protected action can be permitted, stepped up, or denied with an execution receipt. The remaining launch gates are mostly packaging, CI, and production-readiness polish.

## Release Gates

### 1) Build & Test Reliability

- [x] Trust Authority TypeScript build compiles in local reference environment.
- [x] Automated CI workflow for build/test/docs checks on every PR.
- [x] Basic smoke tests for key admin/token endpoints.

### 2) Documentation Quality

- [x] Role-based onboarding docs are split by audience (`getting-started`, `operator-guide`, `ecosystem-integrations`).
- [x] Contributing guide is role-based and structured.
- [x] Integration guide includes AGT and network adapter patterns.
- [x] Add a concise "public quickstart" issue template for first-time contributors.

### 3) Security & Governance Baseline

- [x] Security model and threat docs exist.
- [x] Governance and RFC contribution process documented.
- [x] `SECURITY.md` entry-point exists for responsible disclosure and access controls.
- [x] Branch/access control policy is documented (`docs/repo-access-control.md`).

### 4) Operational Readiness (Reference Stack)

- [x] Agent registry listing endpoint exists (`GET /v1/admin/agents`).
- [x] Quarantine/block workflows documented and implemented.
- [x] Add persistent-storage guidance for production-like deployments in a dedicated operator runbook section.

### 5) Repo Hygiene

- [x] Core docs references resolve (roadmap, guides, contributing).
- [ ] Add CI badge/status in README once workflow is live and passing.
- [x] CODEOWNERS exists for protocol/security/runtime critical paths.

### 6) Open-Source Boundary Integrity

- [x] Public/open boundary is documented (`docs/open-source-boundary.md`).
- [ ] Perform a release-time audit to confirm no premium compliance/risk modules are included.
- [ ] Verify product language in docs keeps protocol semantics vendor-neutral and portable.

## Recommended Pre-Public Action Plan (Fast)

1. Publish or explicitly reserve the SDK package name used in docs.
2. Extend CI to build SDK/reference packages and run markdown/link checks.
3. Enforce branch protection + required checks in repository settings.
4. Add one smoke-test script for core Trust Authority endpoints.
5. Cut a tagged pre-release (`v1.0.0-rc1`) with changelog.
6. Run open-source boundary audit against `docs/open-source-boundary.md`.

## Packaging Notes

The root npm package is scoped to protocol runtime primitives, schemas, and release-critical documentation through the `files` allowlist in `package.json`. Reference implementations, broad documentation, tests, CI workflows, policies, and partner collateral remain in the repository but are not part of the root npm tarball.

Pre-release package names are aligned under the BlockSiFr npm scope:

- `@blocksifrdev/ttp-protocol`
- `@blocksifrdev/ttp-sdk`
- `@blocksifrdev/ttp-trust-authority`

If those are done, the repo is in strong shape for a broader public launch.
