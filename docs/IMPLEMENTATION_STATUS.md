# Implementation Status and Security Boundaries

This page distinguishes reference-implementation behavior from deployment guarantees. It is a documentation map, **not an independent security audit or certification**. Status can change; verify the code, tests, and release notes for the exact version you deploy.

## Status labels

- **Implemented in reference code** — code paths and/or tests exist in this repository. This does not by itself establish production suitability.
- **Partial / bounded** — basic behavior exists, but the documented threat model identifies meaningful gaps.
- **External deployment requirement** — safety depends on infrastructure or controls outside this repository's protocol primitives.
- **Future hardening / not established** — the repository documents this as out of MVP, incomplete, or future work.

## Capability matrix

| Capability | Current documented status | Boundary to understand |
|---|---|---|
| Trust thresholds and composite trust proofs | Implemented in the reference implementation | A proof is only as reliable as its evidence, issuer validation, and trust policy. |
| Attestation freshness, expiry, and claim checks | Basic checks implemented | A production issuer registry, key lifecycle, and signed-claim trust model must be established. |
| Trust decay | Reference behavior implemented | Evaluation time and clock integrity must be trustworthy in deployment. |
| Bounded delegation, trust transfer, and multi-hop trust routes | Reference primitives implemented | Cross-domain issuer policy and complete scope enforcement need validation for the target deployment. |
| Deterministic canonicalization and hashing | Reference primitives implemented | Every signer and verifier must use the same canonical representation and schema version. |
| Cross-language aggregation | Normative aggregation specification and JavaScript/Python parity tests are documented | Re-run the current parity gate against the exact revision; conformance is version-sensitive. |
| Execution authority bound to action parameters | Reference behavior documented and exercised by examples | Do not assume the protocol library alone is a mandatory enforcement point. The target effect boundary must verify the exact signed binding. |
| Ed25519 receipt signing and verification | Receipt-signing and verification capabilities are documented in the PCTR/reference tooling | A verifier must pin a trusted signer independently; self-supplied keys prove consistency, not signer identity. |
| Replay prevention | Some freshness/nonce semantics are documented; the threat model identifies replay caches and runtime receipt binding as hardening gaps | Do not claim universal, atomic one-time execution protection unless the deployed effect boundary maintains durable replay state and tests concurrent duplicate requests. |
| Fail-closed effect boundary | PCTR documents a separate-process boundary that denies when unavailable | Verify this behavior for the exact deployment, including verifier outage, persistence failure, and concurrency. |
| Production key management | External deployment requirement / future hardening | The documented key-on-disk model is not a substitute for a KMS/HSM, rotation, access controls, and incident response. |
| TLS and network exposure | External deployment requirement | The documented local HTTP service requires TLS and deployment hardening before exposure beyond localhost. |
| Issuer compromise, Sybil resistance, and trust farming | Documented risks; additional controls required | These are governance and evidence-network problems, not solved merely by cryptographic signatures. |
| Runtime bypass prevention | External enforcement requirement | Every path to the protected effect must pass through a mandatory gateway, API, CI, or equivalent enforcement point. |

## What TTP does—and does not—guarantee

TTP provides primitives and reference behavior for representing, evaluating, transferring, and proving trust. It does **not**, by itself, guarantee that a downstream action cannot execute. Enforcement depends on a correctly placed effect boundary and the infrastructure behind it.

A valid signature proves that a particular key signed a particular representation. It does not automatically prove that the key's owner is trusted, that the underlying claim is true, that the evidence is current, or that an action was actually executed.

A hash-chained receipt can reveal changes to a recorded chain. It is not, by itself, proof that the recorded events are complete or that a protected system could not be bypassed.

## Minimum deployment review

Before using this software to protect real actions, verify all of the following in the intended environment:

- [ ] Production proof mode is used; cleartext-dev is rejected.
- [ ] Issuers and signer keys are pinned through a trusted, controlled registry.
- [ ] Signing keys have access controls, rotation, backup, and revocation procedures.
- [ ] Material action parameters, target, policy version, validity window, and nonce are cryptographically bound.
- [ ] Replay state is durable and duplicate spends are rejected atomically, including concurrent requests.
- [ ] Every path to the protected effect passes through the enforcement boundary.
- [ ] The boundary fails closed on verifier, storage, signer, and policy-service failure.
- [ ] Network-exposed services use TLS and authenticated transport.
- [ ] Receipt verification uses an independently trusted public key and checks the full chain.
- [ ] The current test suite, cross-language parity checks, and threat-specific integration tests pass for the exact release.
- [ ] The deployment has an operational process for policy changes, evidence freshness, key compromise, and incident response.

See [SECURITY.md](../SECURITY.md), [THREAT_MODEL.md](../THREAT_MODEL.md), and [SPECIFICATION.md](../SPECIFICATION.md). Report vulnerabilities privately according to the security policy rather than posting exploit details in a public issue.
