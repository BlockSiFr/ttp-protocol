# TTP Threat Model

TTP expresses trust context. TTP alone does not enforce execution. Enforcement happens through RAP, Execution Exchange, FrontDesk-integrated gateways, API gateways, CI gates, or equivalent runtime controls.

| Threat | Description | Impact | Mitigation | MVP Status | Future Hardening |
| --- | --- | --- | --- | --- | --- |
| Forged trust claims | Attacker creates a fake trust claim or edits score/timestamps. | Unauthorized action may appear trusted. | Validate issuers, signatures, schema, and immutable evidence references. | Cleartext-dev only; not production safe. | Signed claims, issuer registry, canonical signing, key rotation. |
| Stale trust proofs | Old proof is reused after trust context has changed. | Actions proceed on outdated trust. | Expiration, freshness windows, short TTLs. | Expiration and freshness semantics documented; basic checks implemented. | Nonces, replay caches, runtime receipts. |
| Replay attacks | Previously valid proof or receipt is replayed. | Unauthorized repeated execution. | Bind proof to action, resource, time, and nonce. | Out of MVP. | Nonce registry, receipt hash binding, RAP request binding. |
| Issuer compromise | Valid issuer signs false claims. | Trust model can be corrupted. | Least privilege issuers, issuer reputation, revocation, independent issuers. | Documented risk. | Issuer registry, quorum rules, revocation feeds. |
| Malicious agent self-attestation | Agent issues trust about itself. | Inflated trust. | Disallow self-attestation unless explicitly marked and low weight. | Not enforced beyond examples. | Issuer policy constraints and signed issuer metadata. |
| Trust farming | Actor performs low-risk behavior to build trust for high-risk actions. | Inappropriate trust transfer. | Scope trust by action/domain/resource; use high-risk thresholds. | Scope syntax exists. | Risk-weighted decay, action-specific scoring. |
| Sybil attacks | Many fake subjects or issuers inflate trust. | Trust graph manipulation. | Issuer validation, subject registration, governance controls. | Out of MVP. | Identity binding, issuer reputation, abuse detection. |
| Proof expiration bypass | Runtime ignores expiration or clock is wrong. | Expired trust accepted. | Fail closed, reliable clocks, skew limits. | Expiration checks implemented in reference CLI. | Secure time, signed timestamps, RAP enforcement tests. |
| Policy downgrade attacks | Lower proof mode or lower threshold is substituted. | Weaker evaluation than intended. | Pin proof requirements in authority context and runtime policy. | Basic proof references parsed. | Policy signatures and version pinning. |
| Cross-domain trust abuse | Trust from one domain is reused in another. | Scope escape. | Domain and scope checks. | Domain captured; limited enforcement. | Domain-specific issuer policies and RAP mapping. |
| Runtime gate bypass | Actor calls target system without RAP or gateway enforcement. | TTP evaluation is skipped. | Place enforcement at mandatory control points. | Out of TTP core. | Execution Exchange, service mesh, CI and API gateway adapters. |
| Receipt tampering | Evidence or receipt is modified after creation. | Audit and proof integrity loss. | Sign receipts and hash evidence references. | Output supports optional receipt hash. | Canonical receipt schema and transparency log support. |
| Clock manipulation | Actor or runtime shifts time to avoid decay or expiration. | Trust remains valid too long or decays incorrectly. | Trusted server-side evaluation time and skew limits. | CLI uses evaluator time input. | Secure time source and signed evaluation receipts. |
| Misconfigured trust thresholds | Thresholds are too low or too broad. | Weak authority control. | Defaults, linting, review, risk-tier guidance. | Examples use explicit thresholds. | Policy linter and conformance tests. |
| Overbroad delegation | Delegation transfers too much authority or lasts too long. | Privilege expansion. | Bound delegation by scope, max score, issuer, expiration. | Delegation syntax example only. | Delegation evaluator and cycle detection. |
| Trust issuer impersonation | Attacker claims to be a trusted issuer. | Fake claims accepted. | Issuer identity verification and signature checks. | Out of MVP proof mode. | Issuer registry, JWKS/DID/PKI integrations. |
| Dependency compromise | Parser or runtime dependency is compromised. | Supply-chain compromise. | Minimal dependencies, lockfiles, CI checks. | CLI uses only Node standard library. | SLSA provenance, signed releases, dependency scanning. |

## Security Boundary

TTP is a protocol and language for trust expression. It must be integrated with runtime enforcement to have security effect. If a system can bypass the RAP or gateway decision point, TTP cannot prevent execution.
