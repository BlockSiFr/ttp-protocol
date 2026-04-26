# TTP ↔ SCIM-RE Alignment

This mapping clarifies how TTP protocol concepts align with SCIM-RE runtime authority schema concepts.

| TTP concept | SCIM-RE / Runtime concept | Role |
|---|---|---|
| `TrustSubject` | `WorkloadIdentity` | Identity of the actor or delegated principal |
| `TrustGrant` / Delegation | `AuthorityGrant` | Scoped, time-bounded authority envelope |
| `AttestationRef` | `Attestation` | Freshness and legitimacy proof |
| `ExecutionIntent` | `/re/authorize` request context | Runtime action intent payload |
| `TrustProof` | Runtime Authority evaluation input | Evidence used in decisioning |
| Outcome context | `ExecutionReceipt` | Cryptographic decision evidence |

## Boundary reminder

TTP expresses trust semantics and context.
Runtime Authority enforces execution and emits final decision outcomes.
