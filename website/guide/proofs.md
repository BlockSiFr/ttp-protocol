# Proofs

A `TrustProof` is the structured output of evaluating a subject's trust against
a requirement. It composes sub-proofs — threshold, attestations, delegation,
route, and decay — into a single verifiable envelope with a `proofHash`.

## Outcomes

| Outcome | Meaning |
| --- | --- |
| `trust_valid` | Current evidence satisfies the requirement. |
| `trust_insufficient` | Effective trust is below the threshold. |
| `trust_expired` | A claim or proof freshness window has elapsed. |
| `trust_invalid` | Issuer, evidence, reference, or validation failed. |
| `trust_unknown` | Trust cannot be established from available evidence. |

## Proof modes

`plain` · `signed` · `zk-placeholder` · `zk`. Production proofs must be `signed`
or `zk`; never rely on `cleartext-dev` outside local development.

::: receipt PROOF
A proof is the input to a runtime decision. The decision and its proof reference
are then recorded together in an [ExecutionReceipt](/guide/receipts).
:::
