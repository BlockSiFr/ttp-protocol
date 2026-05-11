# Governance

## Project Purpose

TTP exists to define a portable trust grammar for autonomous execution: trust claims, authority context, delegation, proof requirements, and decay. It should remain interoperable and independent from any single commercial control plane.

## Maintainer Model

Maintainers are responsible for protocol clarity, implementation quality, security review, release integrity, and contributor onboarding.

Security-sensitive areas require maintainer review:

- Parser and evaluator behavior.
- Trust scoring and decay.
- Proof modes.
- Delegation semantics.
- Runtime integration contracts.
- Cryptographic verification.

## RFC Process

Protocol changes should use an RFC when they alter grammar, object model, evaluation semantics, proof modes, or compatibility.

An RFC should include:

- Problem statement.
- Proposed change.
- Syntax or data model impact.
- Security considerations.
- Compatibility and migration notes.
- Alternatives considered.

## Versioning

Implementation packages use semantic versioning. Protocol grammar uses explicit protocol versions. Backward-incompatible grammar changes require migration notes and conformance fixture updates.

## Compatibility Policy

Draft versions may change. Once a stable version is declared, conforming evaluators should continue accepting compatible prior documents or provide clear migration errors.

## Security Review Process

Changes touching trust semantics should include tests for invalid input, expired trust, insufficient score, unsupported proof modes, and unsafe references. Cryptographic changes require dedicated review before release.

## Contribution Review Expectations

PRs should be focused, documented, and testable. Maintainers may ask for smaller changes when a PR mixes protocol semantics, implementation changes, and documentation updates.
