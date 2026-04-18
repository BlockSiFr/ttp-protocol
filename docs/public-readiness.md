# Public Release Readiness

Current status: **close, but not done**.

## Release checklist

### Engineering
- [x] Trust Authority builds locally.
- [x] CI workflow runs build/test on PRs (`.github/workflows/ci.yml`).
- [x] Baseline aggregation unit tests exist (`src/aggregation.test.ts`).
- [ ] Add smoke tests for key admin/token flows.

### Documentation
- [x] Onboarding docs are split by audience.
- [x] Integration and security docs are in place.
- [ ] Add a short first-time contributor quickstart issue template.

### Security and governance
- [x] `SECURITY.md` exists.
- [x] Access-control policy is documented (`docs/repo-access-control.md`).
- [x] CODEOWNERS covers critical paths.
- [ ] Enforce branch protections + required checks in repo settings.

### Open-source boundary
- [x] Boundary policy is documented (`docs/open-source-boundary.md`).
- [ ] Run a release-time audit to ensure no premium compliance/risk modules are included.
- [ ] Verify product language remains vendor-neutral for core protocol semantics.

## Before inviting broad public traffic

1. Expand CI to include docs checks and smoke tests.
2. Turn on required checks + branch protection in GitHub settings.
3. Cut an `rc` tag with changelog and known limitations.
4. Run boundary audit from `docs/open-source-boundary.md`.

If those are complete, the repo is ready for public release.
