# Security Policy

This repository contains security-sensitive trust protocol and reference implementation code.

## Supported Scope

Security reports are accepted for:
- protocol semantics and verification logic
- reference Trust Authority, issuer, and verifier code
- cryptographic handling, token validation, and replay protections
- admin/authz controls in reference APIs

## Reporting a Vulnerability

Please **do not** open public GitHub issues for vulnerabilities.

Report privately to: **maurice@blocksifr.com**

Include:
1. affected component/path
2. reproduction steps / proof of concept
3. impact and exploit conditions
4. suggested mitigation (if available)

We aim to acknowledge reports within 48 hours.

## Repository Access Controls (Pre-Public Invite)

Before inviting external users/collaborators:

1. Enforce least privilege:
   - default role: Read
   - Write/Maintain only for trusted maintainers
   - Admin restricted to core owners
2. Require branch protection on default branch:
   - PR required (no direct pushes)
   - required review approvals
   - required status checks
   - dismiss stale approvals on new commits
3. Require CODEOWNERS review for protocol/security-critical paths.
4. Require 2FA for org members and outside collaborators.
5. Protect secrets:
   - enable secret scanning + push protection
   - no long-lived credentials in repo
   - rotate keys on any suspicion of exposure
6. Protect release integrity:
   - tag protection
   - signed release artifacts where possible

## Safe External Collaboration Model

- Use issue templates and scoped labels for newcomer tasks.
- Keep security-sensitive discussions private until patched.
- Prefer small, auditable PRs for protocol or authz changes.
- Require explicit security review for changes touching trust semantics.

## Additional References

- Security model: `docs/security.md`
- Public release checklist: `docs/public-readiness.md`
- Repo access model: `docs/repo-access-control.md`
