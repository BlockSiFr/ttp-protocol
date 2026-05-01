# Tenant-Bound Trust Route Profile

## Purpose

This profile defines how trust is routed from a user intent through FrontDesk mission context, agent pack, individual agents, connectors, and VerifiedTrust NHI evidence — all within a single tenant boundary.

**TTP answers:** "How is trust transferred, decayed, delegated, routed, and proven across a tenant-bound governed agent mission?"

## Trust Route

```
User Intent
  → Tenant Context (tenantId, tenantType, isolationMode)
  → FrontDesk Mission (missionId, businessContext, goal, selectedPackId)
  → Agent Pack (packId, riskTier, requiredConnectors, complianceMappings)
  → Governed Agent (agentId, category, allowedActions, requiredGrants)
  → Connector Identity (connectorId → VerifiedTrust NHI evaluation)
  → VerifiedTrust Context (nhiId, trustScore, lifecycleState, credentialFreshness, evidenceRef)
  → RAP Authorization Request (tenantId + environmentId + subject + action + resource + vtCtx)
  → RAP Decision (PERMIT | THROTTLE | STEP_UP | ESCALATE | DENY)
  → ExecutionReceipt (tenantId + environmentId + missionId + agentId + receiptHash + chainHash)
```

## Tenant Binding Requirements

Every node in the trust route MUST carry or inherit `tenantId`. A trust route is invalid if any node's `tenantId` does not match the mission's `tenantId`.

| Node | Required fields |
|---|---|
| Mission | tenantId, environmentId |
| Agent Pack | tenantId |
| Governed Agent | tenantId |
| Authority Grant | tenantId, environmentId |
| VerifiedTrust Context | tenantId |
| RAP Request | tenantId, environmentId |
| ExecutionReceipt | tenantId, environmentId |

## Failure Modes

| Failure | TTP proof result |
|---|---|
| Missing tenantId on any node | `proof_invalid: tenant_context_broken` |
| tenantId mismatch between nodes | `proof_invalid: trust_route_tenant_mismatch` |
| Missing environmentId on execution node | `proof_invalid: environment_context_missing` |
| VerifiedTrust tenantId mismatch | `proof_invalid: nhi_tenant_boundary_violation` |
| No approved CrossTenantDelegation | `proof_invalid: cross_tenant_access_denied` |
| Expired grant in route | `proof_invalid: authority_grant_expired` |
| Stale environment attestation | `proof_partial: environment_attestation_stale` |

## Proof Fields

A valid tenant-bound trust proof includes:
- `tenantId`
- `environmentId`
- `missionId`
- `agentId`
- `subjectId`
- `action`
- `resource`
- `trustScore`
- `decayApplied`
- `verifiedTrustEvidenceRef` (if NHI connector involved)
- `authorityGrantRef`
- `timestamp`
- `proofHash`
