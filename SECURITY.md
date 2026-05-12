# Security Policy

TTP is security-sensitive protocol work. The current repository contains a draft specification, examples, and a reference implementation scaffold. It is not recommended for production enforcement.

## Supported Versions

| Version / Branch | Security Support |
| --- | --- |
| `main` | Best-effort security review during active development |
| Released packages | Not yet available |
| Pre-MVP examples | Documentation and test fixture support only |

## Reporting Vulnerabilities

Please do not open public GitHub issues for vulnerabilities.

Report privately to: **maurice@blocksifr.com**

Include:

- Affected component or path.
- Reproduction steps or proof of concept.
- Expected and actual behavior.
- Security impact and exploit conditions.
- Suggested mitigation, if available.

We aim to acknowledge reports within 48 hours and coordinate remediation before public disclosure.

## Security Expectations

Contributors should assume adversarial inputs and hostile runtime environments. Changes that affect parsing, trust scoring, expiration, issuer handling, proof modes, delegation, receipt handling, or runtime integration require extra review.

Security-sensitive changes should include tests for failure paths, malformed input, expired trust, insufficient thresholds, and unsafe defaults.

## Cryptographic Caution

The MVP uses `cleartext-dev` proof evaluation. This mode is intended for local development, examples, and protocol review only.

Do not treat the current implementation as a cryptographic verifier. Signed claims, issuer registries, replay protection, key rotation, secure time, and advanced proof backends are future hardening work.

ZKP support is an advanced verification backend and is not required for the MVP.

## Production Readiness Disclaimer

TTP currently provides draft protocol semantics and a reference implementation in active development. It does not provide production-grade enforcement by itself.

Runtime enforcement must be implemented by RAP, Execution Exchange, FrontDesk-integrated gateways, API gateways, CI gates, or equivalent systems that fail closed when trust cannot be evaluated.

## Responsible Disclosure Process

1. Reporter submits a private report.
2. Maintainers acknowledge receipt.
3. Maintainers reproduce and classify impact.
4. A fix or mitigation is prepared privately.
5. Reporter validates where practical.
6. Public disclosure is coordinated after remediation.

## Out of Scope for the Current MVP

- Production ZKP verification.
- Distributed trust federation.
- Blockchain anchoring.
- Enterprise-grade issuer registry operation.
- Hosted governance control plane behavior.
- Full FrontDesk, VerifiedTrust, RAP, or Execution Exchange enforcement logic.
- Vulnerabilities in downstream deployments that modify or bypass the reference evaluator.
