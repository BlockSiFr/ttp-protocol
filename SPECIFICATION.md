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

## Chain Trust Model

TTP is the open protocol for **machine chain trust**: proving whether the chain behind an
AI agent, copilot, workflow, pipeline, API, service account, or non-human identity is
trustworthy enough to be relied on, before downstream authority and execution decisions
occur.

The name is deliberate. An *isnad* is a chain of transmission — who received what from
whom, and whether each link in that chain is sound. An autonomous action has the same
shape: a model acted on a prompt, handed to a tool, invoked through a workflow, carrying
authority delegated from a person who is no longer in the room. TTP evaluates that chain.

### Layering

```text
TTP                = machine isnad / chain-trust protocol
SCIM-RE            = runtime identity + authority schema
RAP                = authority decision engine
Execution Exchange = downstream enforcement / customer control plane
CortexTrace        = evidence + trace capture
ExecutionReceipts  = cryptographic proof objects
```

TTP establishes **chain trust**. SCIM-RE structures runtime identity, authority grants,
attestations and receipts. RAP makes runtime authority decisions. Execution Exchange
enforces them. CortexTrace captures execution evidence. ExecutionReceipts preserve
cryptographic proof.

### Chain Primitives

| Primitive | Meaning |
| --- | --- |
| `TrustChain` | Verifiable chain behind an autonomous action. |
| `ChainActor` | Human, agent, model, tool, workflow, pipeline, service account, API, or workload in the chain. |
| `TransmissionLink` | Handoff between actors, prompts, tools, workflows, systems, or authority contexts. |
| `ReliabilityProfile` | Historical and current reliability state for a chain actor. |
| `EvidenceReference` | Pointer to telemetry, receipts, approvals, runtime state, token state, code state, or external evidence. |
| `Attestation` | Verifiable proof-of-state for an actor, workflow, token, code artifact, model, tool, or environment. |
| `TrustVerifier` | Verifies signatures, issuers, proof modes, freshness, and evidence integrity. |
| `TrustValidator` | Applies decay, thresholds, scope, reliability, delegation, chain continuity, and constraints. |
| `CorroborationSet` | Multiple evidence routes supporting or contradicting the chain. |
| `LatentDefect` | Hidden defect: stale authority, concealed delegation, prompt or tool drift, policy bypass, approval bypass, missing link. |
| `TrustClassification` | Graded trust result. Not binary trust. |
| `TrustTransfer` | Bounded transfer of trust or authority context. |
| `TrustReceipt` | TTP-level proof that chain trust was evaluated. |

`verify_isnad_chain` in the reference implementation evaluates a `TrustChain`: continuity
(every link's issuer is the prior link's subject), rooting at a trusted authority, per-link
validity, and attenuation — trust MUST NOT amplify along a chain.

### Trust Roles

| Role | Purpose |
| --- | --- |
| `EvidenceObserver` | Captures raw evidence from tools, workflows, runtimes, identity systems, APIs, pipelines, or agents. |
| `AttestationIssuer` | Converts evidence into signed, verifiable attestations. |
| `TrustVerifier` | Verifies attestations, signatures, issuers, proof mode, evidence integrity, and freshness. |
| `TrustValidator` | Applies trust decay, reliability history, thresholds, scope, chain continuity, delegation, and constraints. |
| `CorroborationEngine` | Compares evidence paths and detects agreement, contradiction, missing links, or latent defects. |
| `RuntimeAuthority` | Downstream role that converts validated trust into allow, deny, step-up, escalate, throttle, or constrain. |
| `ReceiptNotary` | Signs and chain-links trust validation results, runtime decisions, and execution outcomes. |
| `GovernanceReviewer` | Reviews chains, receipts, defects, and corroboration for audit, compliance, incident response, or oversight. |

The separation is normative, and it is the point of the protocol:

> The `TrustVerifier` MUST NOT make final execution decisions unless it is explicitly also
> acting as a downstream `RuntimeAuthority`.
>
> The `TrustValidator` MUST NOT execute protected actions. It determines whether trust
> conditions are satisfied.
>
> TTP establishes whether a chain deserves reliance. Downstream authority systems decide
> whether execution may proceed.

### Verification Levels

A deployment states the level it operates at. Higher levels are not merely "more secure" —
they describe how many independent parties must agree before a chain is relied upon.

| Level | Name | Description |
| --- | --- | --- |
| `L0_LOCAL` | Local evaluator | Cleartext local parsing and evaluation, for development. |
| `L1_SINGLE_VERIFIER` | Single verifier | One verifier validates attestation, proof, issuer and freshness. |
| `L2_VERIFIER_VALIDATOR` | Verifier + validator | Verifier checks evidence; validator applies decay, thresholds, scope, reliability and policy constraints. |
| `L3_CORROBORATED_CHAIN` | Corroborated chain | Evidence references, receipts, attestations or approval records are checked for agreement and contradiction. |
| `L4_VERIFIER_SET` | Distributed verifier set | Multiple verifiers independently verify evidence and produce a quorum or weighted result. |
| `L5_VALIDATOR_QUORUM` | Validator quorum + runtime authority | Multiple validators produce a quorum-backed classification consumed by runtime authority. |
| `L6_PRIVACY_PRESERVING` | ZK / selective disclosure | Trust conditions proven without exposing raw scores, sensitive evidence, internal policies or customer data. |

### Trust Classification

Chain trust is graded, not binary. Each classification implies a downstream posture, which
a `RuntimeAuthority` converts into an execution response.

| Classification | Downstream posture |
| --- | --- |
| `TRUST_ACCEPTED` | allow |
| `TRUST_ACCEPTED_WITH_CONTROLS` | constrain or throttle |
| `TRUST_REVIEW_RECOMMENDED` | step_up |
| `TRUST_CONTRADICTED` | escalate |
| `TRUST_DEFECTIVE` | escalate or deny |
| `TRUST_REJECTED` | deny |
| `TRUST_UNKNOWN` | deny or escalate |

`TRUST_UNKNOWN` is not a neutral result. A chain nobody has evaluated is not a trustworthy
chain, and it MUST NOT be treated as one.

### Chain Continuity

| State | Meaning |
| --- | --- |
| `CHAIN_CONTINUOUS` | Every link is present and each link's issuer is the prior link's subject. |
| `CHAIN_MISSING_LINK` | One handoff in the chain has no evidence behind it. |
| `CHAIN_MULTI_MISSING_LINK` | More than one handoff is unevidenced. |
| `CHAIN_SUSPENDED` | A link was valid and has been suspended or revoked. |
| `CHAIN_AMBIGUOUS` | Evidence supports more than one reading of the chain. |
| `CHAIN_INFERRED` | Continuity is inferred from context rather than evidenced. |
| `CHAIN_UNKNOWN` | Continuity has not been established. |

### Latent Defects

A latent defect is a fault the chain does not surface on its own. Detecting one does not
by itself deny an action; it changes the classification, and the downstream authority
decides.

`prompt_injection_suspected` · `approval_bypass` · `stale_authority` ·
`unowned_identity` · `unexpected_tool_use` · `context_loss` ·
`policy_version_mismatch` · `scope_inflation` · `dependency_substitution` ·
`token_origin_unclear` · `chain_link_unproven`


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
