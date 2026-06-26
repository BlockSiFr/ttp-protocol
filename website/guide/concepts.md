# Protocol Concepts

TTP is built from a small set of primitives that compose into a verifiable
trust decision.

<p align="center">
  <img src="/diagrams/protocol-loop.svg" alt="Protocol loop" style="width:100%;border:1px solid #1e2430;border-radius:12px" />
</p>

## Primitives

| Primitive | Meaning |
| --- | --- |
| **Subject** | The agent, service account, pipeline, API client, or workflow being evaluated. |
| **TrustClaim** | A scoped statement that a Subject holds a trust score, issued by a trust issuer. |
| **AuthorityGrant** | A bounded right relied on only when trust, freshness, and scope are satisfied. |
| **Attestation** | Fresh evidence that the subject or runtime context remains valid. |
| **TrustDecay** | Time-based weakening of trust when fresh evidence is absent. |
| **Delegation** | Bounded transfer of trust or authority from one subject to another. |
| **IsnadChain** | A verifiable chain of trust transmission from a rooted authority to the actor. |
| **TrustProof** | A structured proof that trust conditions were evaluated and satisfied. |
| **ExecutionReceipt** | A signed proof object recording the decision and its basis. |

::: authority AUTHORITY
An `AuthorityGrant` is never trusted on its own. It is only relied on when the
current trust score clears the policy threshold, the grant is in scope, and its
evidence is fresh.
:::

::: attestation ATTESTATION
An `Attestation` is fresh evidence — a signed claim that the subject, code,
workload, or runtime is still valid. Attestations recharge trust.
:::

::: decay DECAY
Trust is not permanent. Without new attestations it decays through
`active → degraded → warning → critical`. See [Trust Decay](/guide/decay).
:::

## How they compose

A request carries an identity. TTP gathers trust claims and attestations,
applies decay, and produces a `TrustProof`. A runtime authority gate combines
the proof with an `AuthorityGrant` and emits a decision plus an
`ExecutionReceipt`.
