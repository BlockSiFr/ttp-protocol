# Trust Transfer Protocol Specification

**Status:** Draft  
**Current milestone:** MVP parser + trust decay evaluator  
**Production use:** Not recommended  
**License:** Apache 2.0

## Protocol Purpose

Trust Transfer Protocol (TTP) is an open protocol and declarative language for expressing verifiable trust, authority context, delegation, and decay before autonomous systems execute.

TTP answers:

> Can this actor prove enough current trust to attempt this action now?

TTP does not enforce actions by itself. It produces trust context and evaluation results that runtime systems such as RAP, Execution Exchange, API gateways, CI gates, and FrontDesk-integrated control surfaces can use before execution.

## Design Principles

- **Narrow scope:** TTP expresses trust context; it is not a complete governance product.
- **Execution-time evaluation:** Trust must be evaluated near the time of action.
- **Scoped trust:** Trust claims must apply to explicit subjects, domains, scopes, and resources.
- **Freshness:** Trust claims must expire and proofs may require tighter freshness windows.
- **Decay:** Trust is not permanent. Effective trust may decline over time.
- **Issuer accountability:** Trust claims must identify the issuer.
- **Proof portability:** The grammar must support cleartext development mode and future signed or zero-knowledge proof backends.
- **Fail-closed integration:** Runtime enforcement layers must reject execution when trust context cannot be evaluated.

## Syntax Model

The draft `.ttp` syntax is block-oriented:

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

Blocks in the MVP:

| Block | Purpose |
| --- | --- |
| `subject` | Defines the actor whose trust is evaluated. |
| `trust` | Defines issuer, score, lifetime, decay, scope, and evidence. |
| `proof` | Defines required score, proof mode, freshness, and subject. |
| `authority_context` | Defines action/resource context requiring a proof. |
| `delegation` | Defines bounded transfer of trust or authority context. |

## Trust Object Model

### Subject

- `id`: Stable subject identifier.
- `type`: Actor type, such as `ai_agent`, `workload`, `service_account`, `pipeline`, or `api`.
- `issuer`: Entity that introduced or registered the subject.
- `domain`: Operational trust domain.
- `metadata`: Optional structured metadata.

### TrustClaim

- `subject`: Subject identifier.
- `issuer`: Trust issuer.
- `score`: Numeric trust score, typically `0.0` to `1.0`.
- `issued_at`: Claim issuance time.
- `expires_at`: Claim expiration time.
- `decay`: Decay configuration.
- `scope`: List of scoped capabilities.
- `evidence`: Optional attestations, receipt hashes, or external references.

### TrustPolicy

- `required_score`: Minimum effective score.
- `allowed_issuers`: Issuers accepted for the proof.
- `required_freshness`: Maximum age of claim or proof.
- `constraints`: Additional context constraints.
- `proof_mode`: Proof backend, such as `cleartext-dev`, `signed-claim`, or future `zkp`.

### EvaluationResult

- `subject`: Evaluated subject identifier.
- `effective_score`: Score after decay and validity checks.
- `required_score`: Required threshold.
- `result`: Evaluation outcome.
- `reason`: Human-readable reason.
- `expires_at`: Expiration time of the governing claim.
- `proof_mode`: Proof backend used.
- `receipt_hash_optional`: Optional receipt hash or external evidence reference.

## Evaluation Model

An evaluator SHOULD:

1. Parse the `.ttp` document.
2. Validate required blocks and references.
3. Select the requested subject.
4. Locate a trust claim for that subject.
5. Check claim expiration.
6. Check proof freshness.
7. Apply trust decay.
8. Compare effective score to the proof threshold.
9. Return an `EvaluationResult`.

Outcomes:

| Result | Meaning |
| --- | --- |
| `TRUST_PROOF_VALID` | Effective score meets or exceeds threshold. |
| `TRUST_PROOF_INSUFFICIENT` | Effective score is below threshold. |
| `TRUST_PROOF_EXPIRED` | Claim or proof is expired. |
| `TRUST_PROOF_INVALID` | Syntax, reference, issuer, or proof validation failed. |

## Trust Decay Model

The MVP supports linear decay:

```ttp
decay {
  model = "linear"
  half_life = "6h"
  minimum = 0.40
}
```

For MVP evaluation:

- `score` starts at the claim score at `issued_at`.
- One `half_life` reduces the score by 50 percent of its distance from `minimum`.
- Effective score MUST NOT fall below `minimum` before expiration.
- Expired claims fail even if their minimum remains above threshold.

Future versions may define exponential, stepped, risk-event, and issuer-specific decay.

## Proof Model

Proof mode declares how the evaluator verifies a trust statement.

| Mode | Status | Meaning |
| --- | --- | --- |
| `cleartext-dev` | MVP | Development mode using explicit scores and timestamps in the `.ttp` file. |
| `signed-claim` | Future | Trust claim is signed by an issuer and verified by key registry. |
| `zkp` | Future | Zero-knowledge proof backend for selective disclosure. |

The first implementation may use `cleartext-dev` proof evaluation. ZKP support is future/advanced and must not be presented as an MVP requirement.

## Delegation Model

Delegation expresses bounded trust transfer:

```ttp
delegation "review_to_payment_exception" {
  from = "agent:invoice_reviewer"
  to = "agent:payment_exception_reviewer"
  issuer = "verifiedtrust:tenant_123"
  scope = ["invoice.exception.review"]
  max_score = 0.72
  expires_at = "2026-05-11T16:00:00Z"
}
```

Delegation MUST be:

- Explicit.
- Scoped.
- Time bounded.
- Issuer-bound.
- No stronger than the originating trust context unless policy explicitly allows otherwise.

## Expiration and Freshness Model

TTP distinguishes expiration from freshness.

- `expires_at` defines when the trust claim must fail.
- `freshness` defines the maximum acceptable age for a proof or claim relative to evaluation time.

Example: a claim may expire in six hours, but a high-risk action may require proof freshness of 30 minutes.

## Output Model

MVP JSON output:

```json
{
  "subject": "agent:invoice_reviewer",
  "effective_score": 0.84,
  "required_score": 0.75,
  "result": "TRUST_PROOF_VALID",
  "reason": "effective trust score meets threshold",
  "proof_mode": "cleartext-dev",
  "evaluated_at": "2026-05-11T12:30:00.000Z",
  "expires_at": "2026-05-11T18:00:00.000Z",
  "receipt_hash_optional": null
}
```

## Error Model

Errors SHOULD be structured and useful:

| Code | Meaning |
| --- | --- |
| `FILE_NOT_FOUND` | Input file cannot be read. |
| `SYNTAX_ERROR` | `.ttp` syntax cannot be parsed. |
| `MISSING_SUBJECT` | No subject block exists or requested subject is absent. |
| `MISSING_TRUST` | No trust claim exists for the subject. |
| `MISSING_PROOF` | Required proof is absent. |
| `INVALID_REFERENCE` | A block references an unknown proof or subject. |
| `EXPIRED_TRUST` | Trust claim expired before evaluation. |
| `UNSUPPORTED_DECAY_MODEL` | Evaluator does not support the configured decay model. |
| `UNSUPPORTED_PROOF_MODE` | Evaluator does not support the proof mode. |

## Security Considerations

- TTP does not authenticate subjects by itself.
- TTP does not enforce runtime decisions by itself.
- Runtime enforcement must fail closed.
- Issuers must be validated before their claims are accepted.
- Clocks must be trustworthy enough for expiration and freshness checks.
- Overbroad delegation can create unsafe authority paths.
- `cleartext-dev` is not a production proof mode.
- Future signed and ZKP modes require careful key, nonce, replay, and issuer registry design.

See [`THREAT_MODEL.md`](THREAT_MODEL.md) and [`docs/protocol-security-model.md`](docs/protocol-security-model.md).

## Versioning

TTP uses semantic versioning for implementation packages and explicit protocol versions for grammar compatibility.

Draft files SHOULD declare a version once the grammar stabilizes:

```ttp
ttp_version = "0.1"
```

Backward-incompatible grammar changes require a protocol version change and migration notes.
