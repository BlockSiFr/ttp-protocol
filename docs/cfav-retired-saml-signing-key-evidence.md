# CFAV: Retired SAML Signing Key Trust-Edge Evidence (Issue #90)

## Scope

This is a **non-production synthetic acceptance fixture** for existing TrustDecay / SCIM-RE / RAP / Execution Exchange. It is **not a SAML XML signature implementation, live SAML relying-party test, post-quantum cryptanalysis, or production certification**.

It uses actual RSA-2048/SHA-256 test-only signatures over a JSON assertion analog, two simulated relying parties with different pinned keys, the existing TTP `resolveTrustRoute()` on a revoked trust path, and independently pinned Ed25519 observer signatures over test observations. Keys are ephemeral and never committed.

Run: `node --test packages/trust-routing-engine/tests/retired-key-assurance.test.mjs` or `npm run test:trust-routing`.

## Evidence semantics

- `NATIVE_REJECTED`: a host-pinned test observer signed an observation that the synthetic target rejected K1. This does not prove a real vendor SAML SP rejected XML.
- `NATIVE_ACCEPTANCE_UNCONTROLLED`: an inventoried SP accepted a K1-signed test assertion; no blocked effect was observed. Do not claim it is governed.
- `RESIDUAL_TRUST_BLOCKED_AT_EFFECT`: simulated native SP accepted K1, and the **same assertion challenge** was blocked at the protected effect by a test call through existing TrustRoute. Residual native trust remains and must be disclosed.
- `UNPROTECTED_EFFECT`: signed observation that the protected consequence executed; negative counterexample to safety.
- `UNKNOWN`: no appropriately scoped signed and fresh observation. Never silently treat unknown as safe.

Receipts prove what a verifier reported, not independently that a real SP behaved as reported. A caller cannot earn verification by setting a `verified: true` boolean. The assessment requires a host-pinned observer key. The trusted host must independently control both observation collection and key trust. Synthetic signing material and `pinnedObserverKeys` shown in test code are **not** production key custody.

## Next controlled integration gate

1. Inventory actual `(issuer ID, signing-key SHA-256 SPKI fingerprint, relying-party ID, owner, configuration source)` trust edges, including manual pins and unobserved applications; do not treat inventory completeness as assumed.
2. Deploy two isolated, approved SAML XML service-provider test environments with synthetic users, test-only certificates and a properly configured assertion validator.
3. Produce independent native SP evidence for active K2 acceptance, K1 rejection in dynamic SP, K1 acceptance at deliberately pinned SP, and positive/negative audience, destination, InResponseTo, Conditions, subject confirmation, replay and issuer tests.
4. Protect a specific downstream action with the actual non-demo BlockSiFr authority path. Test native bypass routes and side effects with target-side audit instrumentation. Record genuine DENY and physical effect outcome separately.
5. Ensure signed observer evidence is rooted in an enrolled, rotated and revocable production trust registry. Test stale, missing, tampered, wrong-tenant, replayed, and revoked observer evidence.
6. Produce a report of `N` known edges, `R` native rejections, `B` residual native accepts with protected downstream blocks, `E` observed executions, and `U` unknowns. Never claim full coverage when `U > 0` or discovery is incomplete.

**Acceptance claim allowed today:** Source-verified test harness demonstrating the difference between key retirement, native relying-party trust, and protected downstream execution. **Not allowed:** “Every relying party rejects a retired SAML key.”
