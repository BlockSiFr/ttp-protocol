# Repository Access Controls

How we invite collaborators safely before full public launch.

## Roles

- **Reader**: read-only access.
- **Contributor**: fork + PR workflow, no direct writes.
- **Maintainer**: merge rights with protected-branch workflow.
- **Security owner**: admin-level settings, release integrity, incident response.

## Required controls

- Protected default branch (PR required, approvals required, status checks required).
- CODEOWNERS review on critical paths.
- 2FA required for org members/collaborators.
- Secret scanning + push protection.
- Protected release tags.

## PR handling by risk

- **Low risk**: docs/examples only -> maintainer review.
- **Medium risk**: SDK/middleware/admin UX -> maintainer + domain owner.
- **High risk**: protocol semantics, crypto, token verification, authz -> mandatory security-owner review.

## Invite process

1. Start everyone at read-only.
2. Move trusted contributors to fork+PR.
3. Grant write only after sustained high-quality contributions.
4. Remove elevated access immediately if risk posture changes.

## Audit cadence

- Weekly: collaborator/role review.
- Per release: branch protection + CODEOWNERS validation.
- Quarterly: permission and secret-rotation audit.
