# CFAV Security Acceptance: TTP / PCTR

**Assessment date:** November 2, 2026. **Source:** PR #77. **Status:** bounded source verification and automated regression testing, not a third-party penetration test or production sign-off.

## Control-theorem matrix

| Proof obligation | Remediation | Acceptance evidence | External dependency |
| --- | --- | --- | --- |
| Trusted issuer cannot be spoofed by a claimed key ID | Execution authority and receipt verification derive key identities from the actual public key; high-risk authorization requires independent pinned trust | `cfav-security.test.mjs`: forged key ID denied | Production key registry, HSM/KMS policy |
| Sensitive actions cannot be mislabeled as reads | Security-sensitive names, even read verbs, are classified as SECRET_EXPOSED; declared consequence/severity can raise but not lower risk | JS/Python parity and downgrade regression cases | Broader adapter-specific consequence inventory |
| No false successful execution receipt | Await completion of asynchronous effect callback; rejected effect recorded as FAILED | Async resolve/reject regression cases | External target-side outcome verification |
| No live high-risk action based only on declared trust | HIGH/CRITICAL effect callbacks require fresh, valid receipts verified against pinned signer key | Missing/unsigned evidence denies; signed positive fixture | Enterprise issuer enrollment and revocation |
| Malformed replay state must not silently reset | Corrupt local replay ledger rejects initialization; atomic persistence before allow | Corrupt/restart replay tests | Multi-node transactional store and load/failover testing |
| Attestation provenance is verified | Signed mode is default, with issuer-pinned Ed25519 verification and explicit cleartext-dev mode | Forged issuer, altered claim, expired and future negative tests | Verified issuer enrollment, key rotation, revocation feeds |
| STEP_UP requires new authority | GitHub workflow requires a non-author protected-environment reviewer from GitHub API, then a new bound receipt | Static workflow tests and source checks | Actual secrets and approved GitHub environment |
| Runtime authority rejects untrusted caller/claims | Constant-time bearer token verification, externally provisioned scoped grants and trust state, no hard-coded signing key | Strict TS typecheck and policy regression | Credential provisioning, live valid/invalid HTTP test, trusted measurement system |
| Protocol conformance | JS/Python parity runs in CI; Go kernel may be developed separately | CI run reference | Independent implementer and interoperability review |
| IP and patent continuity | Legal issue documented, no unilateral modification to Apache-2.0 LICENSE/NOTICE | See PATENT_ALIGNMENT_REVIEW.md | Interrupt21 / BlockSiFr counsel signoff |

## Honest capability boundaries

A source counterexample and unit regression prove a *specific modeled behavior*, not that every possible bypass is absent. A signature is not trustworthy merely because it verifies cryptographically against an embedded public key. A run receipt does not demonstrate independent physical effect verification.

The GitHub Governed Execution workflow is intentionally **fail closed** when trusted credentials, grants, fresh attestations, independent approvals, or a valid reauthorization receipt are absent. A red governance check is not successful protected execution. **Do not disable or bypass it just to obtain a green badge**.

**Required before production:** independent penetration testing, live HTTPS authenticated invocation with valid and invalid grant fixtures, HSM/KMS-backed key management, durable multi-node replay store, revocation feeds, direct target-side outcome verification, trusted GitHub environment reviewers and approved branch rules, release attestations, and independent interoperability review.

There is no government ATO, formal TTP standard ratification, or third-party security certification.
