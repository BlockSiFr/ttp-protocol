# TTP Architecture

TTP is the protocol layer for trustworthiness establishment before downstream authority and execution decisions. It is intentionally narrower than the runtime systems that evaluate authority, enforce decisions, and record evidence.

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
 TrustProof result JSON
   |
 SCIM-RE / RAP / Execution Exchange / API gateway / CI gate
```

## Protocol Layer

The protocol layer defines the grammar and object model:

- Subject.
- TrustClaim.
- TrustIssuer.
- AuthorityGrant.
- Attestation.
- TrustDecay.
- Delegation.
- TrustProof.
- RuntimeDecision context.
- ExecutionReceipt reference semantics.

This layer should remain portable and implementation-neutral.

## Parser

The parser reads `.ttp` files and produces a structured object model. The MVP parser supports block-oriented syntax for `subject`, `trust`, `proof`, `authority_context`, and `delegation`.

Future parser work should add formal grammar tests, better diagnostics, formatting, and conformance fixtures.

## Evaluator

The evaluator applies subject lookup, trust claim selection, expiration checks, freshness checks, decay calculation, threshold comparison, and result construction.

The evaluator does not decide runtime enforcement actions such as `allow` or `deny`. Those are downstream RAP and enforcement concerns.

## Decay Engine

The MVP supports linear decay. It computes an effective score at evaluation time and enforces a configured minimum before expiration.

Future engines may support exponential decay, event-driven decay, issuer-weighted decay, and risk-tier-specific decay.

## Proof Engine

The MVP proof engine supports `cleartext-dev` mode. This mode is useful for examples, local development, and protocol review. Do not use it in production.

Future proof engines may support signed claims, issuer registries, replay protection, and receipt hash binding. ZKP-compatible verification is a future research direction, not an implemented backend in this repository.

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

## Integration With SCIM-RE, RAP, and Execution Exchange

TTP establishes trustworthiness. SCIM-RE structures runtime trust context. RAP evaluates authority. Execution Exchange enforces downstream runtime decisions in production. CortexTrace records evidence and receipts.
