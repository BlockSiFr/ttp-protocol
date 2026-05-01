# Agent Factory Trust Architecture

## Overview

FrontDesk is the governed Agent Factory. TTP defines how trust moves through the factory.

## The Governed Execution Loop

```
1. Onboard → Create/Select Tenant
2. Define Goal → Business Context (individual | small_business | enterprise)
3. Assign Agent Pack → Native + External agents assembled
4. Build Mission → Connectors, approvals, environment verified
5. Verify Authority → RAP pre-checks authority grants
6. Verify NHI Trust → VerifiedTrust context fetched if connector involved
7. Verify Tenant/Environment → tenantId + environmentId + attestation confirmed
8. Execute Governed Action → Agent acts within authorized scope
9. Generate Tenant-Bound Receipt → ExecutionReceipt with full proof chain
10. Measure Result → Revenue, time, cost, risk, compliance metrics
11. Recommend Next Mission → Based on results and trust history
```

## System Boundaries

| System | Responsibility |
|---|---|
| FrontDesk | Agent Factory, missions, approvals, receipts, results, onboarding |
| VerifiedTrust | NHI lifecycle, machine identities, connector credentials, secrets |
| RAP (runtime-authority) | Runtime authorization decisions, fail-closed enforcement |
| TTP | Trust proof, routing, delegation, decay expressions |
| SCIM-RE | Schema definitions for all governed runtime objects |

## Trust Proof Composition

A complete TTP trust proof for a governed mission action includes:

```json
{
  "tenantId": "tenant_smb_acme",
  "environmentId": "env_docker_acme_001",
  "missionId": "mission_revenue_q1",
  "agentId": "ag_fd_zoho_crm_001",
  "externalAgentId": "zoho_crm_followup_001",
  "platformId": "platform_zoho_acme",
  "action": "crm.contacts.update",
  "trustScore": 0.87,
  "decayApplied": 0.03,
  "verifiedTrustEvidenceRef": "vt_evidence_zoho_9921",
  "authorityGrantRef": "grant_smb_crm_write",
  "timestamp": "2025-05-01T14:32:00Z",
  "proofHash": "sha256:proof_hash_abc",
  "proofValid": true
}
```

## What Makes a Proof Invalid

- `tenantId` missing or mismatched at any node
- `environmentId` missing on execution context
- VerifiedTrust context belongs to a different tenant
- Authority grant expired or tenant-mismatched
- External agent not registered for the tenant
- Cross-tenant access without approved delegation
- Environment attestation missing or stale
