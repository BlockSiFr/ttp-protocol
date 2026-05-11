# Trust Transfer Protocol

[![Protocol](https://img.shields.io/badge/protocol-draft-2f6fed)](SPECIFICATION.md)
[![Reference Implementation](https://img.shields.io/badge/reference%20implementation-active%20development-f59e0b)](MVP.md)
[![Node.js](https://img.shields.io/badge/runtime-Node.js%2020-339933)](package.json)
[![Security Model](https://img.shields.io/badge/security-model%20documented-7c3aed)](THREAT_MODEL.md)
[![Production Use](https://img.shields.io/badge/production%20use-not%20recommended-b91c1c)](SECURITY.md)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

TTP is an open protocol and declarative language for expressing verifiable trust, authority context, delegation, and decay before autonomous systems execute.

It is designed for AI agents, non-human identities, automation pipelines, service accounts, APIs, and cross-system workflows where static access is not enough.

TTP answers one question:

> Can this actor prove enough current trust to attempt this action now?

TTP does not replace IAM, SCIM, OPA, PAM, SPIFFE, OAuth, OIDC, API gateways, or policy engines. It provides the trust expression layer that runtime authority systems can evaluate before execution.

> **Status:** Protocol specification draft complete. Reference implementation in active development.  
> **Current milestone:** MVP parser + trust decay evaluator.  
> **Production use:** Not yet recommended.

---

## Why TTP Exists

Modern systems increasingly delegate meaningful work to agents, pipelines, service accounts, and autonomous workflows. These actors may hold valid credentials while their trust context is stale, overbroad, delegated too far, or no longer appropriate for the action they are about to attempt.

Identity systems prove who an actor is. Policy engines decide whether a rule allows an action. TTP fills the gap between those layers by expressing current, scoped, decaying trust that can be evaluated before execution.

TTP is useful when reviewers need to know:

| Question | TTP Contribution |
| --- | --- |
| Is this trust claim fresh enough? | Expiration and freshness requirements |
| Has trust decayed below the action threshold? | Time-aware trust decay evaluation |
| Who issued this trust, and for what scope? | Issuer, domain, scope, and evidence fields |
| Is delegated authority still bounded? | Delegation and authority context grammar |
| What result should a runtime authority system evaluate? | Structured trust context and evaluation output |

---

## What TTP Is

TTP is:

- A portable trust expression protocol.
- A declarative language for trust claims, proof requirements, authority context, delegation, expiration, and decay.
- A grammar runtime authority systems can evaluate before autonomous execution.
- A foundation for interoperability between agent runtimes, NHI governance systems, policy engines, gateways, and audit surfaces.
- A protocol layer beneath BlockSiFr runtime authority products and reference implementations.

---

## What TTP Is Not

TTP is not:

- A replacement for IAM, OAuth, OIDC, SAML, SCIM, SPIFFE, PAM, OPA, Cedar, API gateways, SIEM, or SOAR.
- A complete governance product or control plane.
- A runtime enforcement gateway by itself.
- A blockchain-dependent system.
- Production-ready cryptographic infrastructure in the current MVP.
- A claim that trust can be made permanent, universal, or risk-free.

Runtime enforcement belongs in systems such as RAP, Execution Exchange, and integrated gateways. TTP supplies the trust grammar those systems can evaluate.

---

## Core Concepts

| Concept | Meaning |
| --- | --- |
| Subject | Actor whose trust is being evaluated, such as an agent, service account, workload, API, or pipeline. |
| Trust claim | A scoped statement that a subject has a trust score issued by a trust issuer. |
| Trust issuer | Entity that issues or attests to a trust claim. Issuers must be validated by the evaluator or runtime authority layer. |
| Trust score | Numeric signal, usually `0.0` to `1.0`, representing current trust for a specific scope. |
| Trust decay | Time-based reduction of effective trust after issuance. |
| Delegation | Bounded transfer of authority from one subject or issuer context to another. |
| Authority context | Action, resource, proof, and runtime context required before execution. |
| Proof | Requirement that a subject must satisfy, including threshold, freshness, issuer, and proof mode. |
| Attestation | Evidence from an issuer, runtime, gateway, or governance system supporting a trust claim. |
| Threshold | Required trust score for a proof or authority context. |
| Expiration | Time after which a trust claim or proof must fail. |
| Evaluation result | Structured output showing effective score, required score, result, reason, proof mode, and evaluation time. |

---

## Simple Example

```ttp
subject "agent:invoice_reviewer" {
  type = "ai_agent"
  issuer = "blocksifr.local"
  domain = "finance"
}

trust "agent:invoice_reviewer" {
  issuer = "verifiedtrust:tenant_123"
  score = 0.86
  issued_at = "2026-05-11T12:00:00Z"
  expires_at = "2026-05-11T18:00:00Z"

  decay {
    model = "linear"
    half_life = "6h"
    minimum = 0.40
  }

  scope = [
    "invoice.read",
    "invoice.recommend"
  ]
}

proof "invoice_review_threshold" {
  subject = "agent:invoice_reviewer"
  required_score = 0.75
  mode = "cleartext-dev"
  freshness = "30m"
}

authority_context "invoice_review" {
  action = "invoice.recommend"
  resource = "invoice:*"
  requires = proof.invoice_review_threshold
}
```

More examples are in [`examples/`](examples/).

---

## CLI Preview

The current CLI is an MVP reference scaffold. It performs basic parsing, validation, linear trust decay, expiration checks, threshold checks, and JSON output.

```bash
npm run ttp -- check examples/01-basic-agent.ttp
npm run ttp -- eval examples/02-trust-decay.ttp --subject agent:invoice_reviewer --at now
npm run ttp -- version
```

Expected JSON shape:

```json
{
  "subject": "agent:invoice_reviewer",
  "effective_score": 0.84,
  "required_score": 0.75,
  "result": "TRUST_PROOF_VALID",
  "reason": "effective trust score meets threshold",
  "proof_mode": "cleartext-dev",
  "evaluated_at": "2026-05-11T12:30:00.000Z"
}
```

---

## BlockSiFr Stack Boundary

TTP is the protocol foundation beneath the BlockSiFr stack. It should remain narrow and portable.

| Layer | Responsibility |
| --- | --- |
| TTP | Trust expression, delegation, decay, proof semantics, authority context grammar. |
| SCIM-RE | Runtime execution resource model: `WorkloadIdentity`, `AuthorityGrant`, `Attestation`, `ExecutionRequest`, `ExecutionReceipt`. |
| RAP | Runtime Authority Protocol decision exchange: `PERMIT`, `STEP_UP`, `DENY`, `THROTTLE`, `ESCALATE`, `CONSTRAIN`. |
| Execution Exchange | Enforcement gateway, route, and runtime integration layer. |
| FrontDesk | Operator/customer UI, AI workforce command center, business approval, and evidence surface. |
| VerifiedTrust | Enterprise NHI posture, policy, lifecycle governance, and compliance control plane. |

See [`docs/ttp-vs-rap-vs-scim-re.md`](docs/ttp-vs-rap-vs-scim-re.md).

---

## Current Implementation Status

| Area | Status |
| --- | --- |
| Protocol specification | Draft complete, still open for review |
| `.ttp` examples | Initial examples added |
| Parser | MVP parser scaffold |
| AST | Initial object model |
| Trust decay evaluator | Linear decay implemented for MVP examples |
| Proof engine | Cleartext-dev threshold evaluation |
| ZKP support | Future/advanced backend, not required for MVP |
| Runtime enforcement | Out of scope for TTP core; belongs in RAP/Execution Exchange integrations |

---

## MVP Scope

The MVP focuses on a buildable, testable protocol kernel:

- Parse `.ttp` files.
- Validate required `subject`, `trust`, `proof`, and `authority_context` blocks.
- Build an AST-like object model.
- Evaluate static trust score.
- Evaluate linear trust decay over time.
- Evaluate threshold conditions.
- Emit JSON evaluation results.
- Support `cleartext-dev` proof mode.

See [`MVP.md`](MVP.md).

---

## Roadmap

| Phase | Focus |
| --- | --- |
| Phase 0 | Protocol cleanup, examples, threat model, stack boundaries |
| Phase 1 | MVP parser/evaluator, AST, decay evaluator, JSON output |
| Phase 2 | RAP request mapping, SCIM-RE resource mapping, SDK |
| Phase 3 | Signed claims, issuer registry, replay protection, ZKP backend prototype |
| Phase 4 | VSCode extension, formatter, conformance tests, reference gateway integration |

See [`ROADMAP.md`](ROADMAP.md).

---

## Security Model

TTP assumes trust is scoped, temporary, issuer-bound, and evaluated at execution time. Trust claims must expire. Proof freshness matters. Issuers must be validated. Runtime enforcement must fail closed when trust context cannot be evaluated.

TTP alone does not enforce execution. Enforcement happens through RAP, Execution Exchange, FrontDesk-integrated gateways, or equivalent runtime controls.

Read:

- [`THREAT_MODEL.md`](THREAT_MODEL.md)
- [`SECURITY.md`](SECURITY.md)
- [`docs/protocol-security-model.md`](docs/protocol-security-model.md)

---

## Contributing

Contributions are welcome when they improve protocol clarity, implementation correctness, examples, tests, security review, or interoperability.

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`GOVERNANCE.md`](GOVERNANCE.md).

---

## License

TTP is licensed under the [Apache License 2.0](LICENSE).
