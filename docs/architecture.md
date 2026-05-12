# TTP Architecture

TTP is the protocol layer for trust expression before autonomous execution. It is intentionally narrower than the runtime systems that enforce authority decisions.

## MVP Pipeline

```text
.ttp file
   |
 parser
   |
 AST
   |
 validator
   |
 trust decay evaluator
   |
 proof evaluator
   |
 evaluation result JSON
   |
 RAP / SCIM-RE / FrontDesk integration
```

## Protocol Layer

The protocol layer defines the grammar and object model:

- Subjects.
- Trust claims.
- Proof requirements.
- Trust decay.
- Delegation.
- Authority context.
- Evaluation result shape.

This layer should remain portable and implementation-neutral.

## Parser

The parser reads `.ttp` files and produces a structured object model. The MVP parser supports block-oriented syntax for `subject`, `trust`, `proof`, `authority_context`, and `delegation`.

Future parser work should add formal grammar tests, better diagnostics, formatting, and conformance fixtures.

## AST

The AST represents:

- Subject definitions.
- Trust claims indexed by subject.
- Proof definitions indexed by proof name.
- Authority contexts referencing proofs.
- Delegations with bounded scope and expiration.

## Evaluator

The evaluator applies:

- Subject lookup.
- Trust claim selection.
- Expiration checks.
- Freshness checks.
- Decay calculation.
- Threshold comparison.
- Result construction.

The evaluator does not decide runtime enforcement actions such as `PERMIT` or `DENY`. Those are RAP concerns.

## Decay Engine

The MVP supports linear decay. It computes an effective score at evaluation time and enforces a configured minimum before expiration.

Future engines may support exponential decay, event-driven decay, issuer-weighted decay, and risk-tier-specific decay.

## Proof Engine

The MVP proof engine supports `cleartext-dev` mode. This mode is useful for examples, local development, and protocol review.

Future proof engines may support signed claims, issuer registries, replay protection, receipt hash binding, and ZKP-compatible verification.

## Output Result

The output is JSON designed to be consumed by runtime authority systems:

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

## Integration With RAP and SCIM-RE

SCIM-RE provides runtime execution resource models such as `WorkloadIdentity`, `AuthorityGrant`, `Attestation`, `ExecutionRequest`, and `ExecutionReceipt`.

RAP evaluates runtime authority decisions such as `PERMIT`, `STEP_UP`, `DENY`, `THROTTLE`, `ESCALATE`, and `CONSTRAIN`.

TTP provides the trust context that can feed those systems.

## Future ZKP Backend

ZKP support is a future proof backend. It should allow selective disclosure of trust satisfaction without exposing raw trust scores or evidence. It is not required for the MVP.
