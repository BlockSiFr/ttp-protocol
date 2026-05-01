# TTP Token Claim Set

This document specifies the canonical claim set for TTP trust proofs — the data
structure produced by `generate_trust_proof()` and consumed by runtime-authority
and SCIM-RE before any action is allowed to proceed.

---

## TrustProof object

```jsonc
{
  "type": "TrustProof",           // always "TrustProof"
  "subject": "agent_007",         // identity requesting the action
  "action": "deploy",             // action being authorized
  "resource": "cluster/prod",     // target resource
  "valid": true,                   // true only if ALL evidence components pass
  "proofMode": "plain",           // "plain" | "signed" | "zk"
  "generatedAt": "2026-05-01T12:00:00Z",  // ISO 8601 UTC
  "proofHash": "sha256:...",      // hash of canonical JSON (see below)
  "evidence": {
    "trustThresholdProof": { ... },  // see TrustThresholdProof
    "attestationResults": [ ... ],   // array of AttestationResult
    "delegationResults": [ ... ],    // array of DelegationResult
    "routeResult": { ... }           // TrustRouteResult
  },
  "failureReasons": []             // populated when valid=false
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | yes | Always `"TrustProof"` |
| `subject` | string | yes | Unique identifier of the requesting identity |
| `action` | string | yes | Action class being authorized (e.g. `deploy`, `query`) |
| `resource` | string | yes | Target resource path or identifier |
| `valid` | boolean | yes | `true` only when all evidence components pass |
| `proofMode` | string | yes | `"plain"` (no sig), `"signed"` (HMAC/RSA/Ed25519), `"zk"` (future) |
| `generatedAt` | ISO 8601 | yes | When the proof was generated (UTC) |
| `proofHash` | string | yes | SHA-256 of the canonical serialisation |
| `evidence` | object | yes | Container for all sub-proofs |
| `failureReasons` | array | yes | Empty array when `valid=true`; list of `{code, message}` when false |

---

## TrustThresholdProof

Proves the subject's trust score meets the required minimum for the requested action.

```jsonc
{
  "type": "TrustThresholdProof",
  "subject": "agent_007",
  "dimension": "execution",        // "execution" | "access" | "data" | custom
  "requiredThreshold": 0.7,
  "trustScore": 0.876,
  "satisfied": true,
  "evaluatedAt": "2026-05-01T12:00:00Z",
  "proofMode": "plain",
  "evidenceRefs": [],              // attestation IDs supporting this score
  "proofHash": "sha256:...",
  "failureReasons": []
}
```

### Trust score semantics

| Range | Zone | Meaning |
|---|---|---|
| 0.80 – 1.00 | `active` | Full execution rights; no step-up required |
| 0.60 – 0.79 | `degraded` | Execution allowed with constraints; step-up for high-impact actions |
| 0.35 – 0.59 | `warning` | Step-up required for all production actions |
| 0.00 – 0.34 | `critical` | Execution blocked; must re-attest before any action |

### Trust decay formula

```
T(t) = T₀ × e^(-λ × Δt) + Σ(W(aᵢ) × R(aᵢ))
```

- `T₀` — trust score at last attestation
- `λ` — decay constant (per-identity, e.g. 0.0001 for low-risk, 0.01 for critical)
- `Δt` — elapsed seconds since last attestation
- `W(aᵢ)` — weight of activity signal `aᵢ`
- `R(aᵢ)` — risk multiplier for signal `aᵢ`

---

## AttestationResult

Each item in `evidence.attestationResults`:

```jsonc
{
  "valid": true,
  "subject": "agent_007",
  "attestationRef": "att_ref_001",  // opaque reference to raw attestation
  "issuer": "authority.example.com",
  "type": "signed_activity",         // attestation type
  "trustScoreDelta": 0.1,            // score contribution
  "verifiedAt": "2026-05-01T12:00:00Z",
  "failureReasons": []
}
```

### Attestation types (canonical)

| Type | Meaning |
|---|---|
| `signed_activity` | Signed proof of recent successful activity |
| `workload_posture` | SBOM + image signature + runtime posture scan |
| `artifact_signature` | Signed build artefact verification |
| `human_approval` | Human approval recorded in step-up queue |
| `vulnerability_scan` | Clean CVE scan result |
| `compliance_check` | Policy compliance assertion |

---

## ProofHash computation

The `proofHash` is a deterministic SHA-256 over the canonical JSON serialisation:

1. Take the proof object
2. Remove the `proofHash` field itself
3. Serialize with keys sorted alphabetically, no trailing whitespace
4. Hash the UTF-8 bytes: `sha256:` + hex digest

Example (Node.js):

```js
import { createHash } from 'node:crypto';

function computeProofHash(proof) {
  const { proofHash: _, ...rest } = proof;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  const hex = createHash('sha256').update(canonical).digest('hex');
  return `sha256:${hex}`;
}
```

---

## Issuer responsibility model

A **TTP issuer** is any system that calls `generate_trust_proof()` and presents
the result to a relying party (runtime-authority, SCIM-RE, API gateway).

### Issuer obligations

| Obligation | Description |
|---|---|
| Subject binding | Verify that the `subject` claim matches the presenting identity before issuing |
| Threshold enforcement | Never set `valid=true` when `trustScore < requiredThreshold` |
| Freshness | Include `generatedAt`; relying parties SHOULD reject proofs older than their `maxAge` policy |
| Attestation verification | Validate each attestation before including it in `attestationResults` |
| Revocation check | Check that the subject has not been revoked before issuing |
| ProofHash integrity | Always compute and include `proofHash`; relying parties MUST verify it |

### Relying party obligations

| Check | Description |
|---|---|
| `valid === true` | Reject any proof where `valid` is not exactly `true` |
| `proofHash` | Recompute hash and compare before trusting any field |
| `generatedAt` age | Reject proofs older than policy `maxAge` (default: 300 seconds) |
| `subject` binding | Verify `proof.subject` matches the identity making the request |
| `action` + `resource` | Verify claimed action/resource match the actual request |

---

## Multi-issuer routing

When a subject's trust is attested by multiple issuers:

1. Each issuer produces its own `TrustThresholdProof`
2. The relying party selects the **most restrictive** threshold that applies to the requested action
3. If any issuer's proof is `satisfied=false`, the overall proof is `valid=false`
4. `evidence.attestationResults` MUST include at least one result per required attestation type

Cross-issuer trust transfer uses `validate_transfer()` — see `src/transfer.mjs`.
