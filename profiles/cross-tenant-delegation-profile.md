# Cross-Tenant Delegation Profile

## Default: DENY

Cross-tenant trust transfer is **prohibited by default**. No agent, mission, connector, credential, or receipt may cross tenant boundaries unless an explicit `CrossTenantDelegation` exists and is:

1. Approved by authorized operators from both tenants
2. Scoped to specific actions and resources
3. Time-limited (has `expiresAt`)
4. Backed by an execution receipt for the approval itself
5. Enforced by RAP for every governed action under the delegation

## Cross-Tenant Trust Route

```
Source Tenant A (tenantId=tenant_a)
  → CrossTenantDelegation record:
      delegationId=del_001
      sourceTenantId=tenant_a
      targetTenantId=tenant_b
      delegatedSubject=ag_specialist_001
      allowedActions=[crm.contacts.read]
      approvedBy=admin@tenant_a.com
      approvedAt=...
      expiresAt=...
      receiptRequired=true
  → RAP receives request from tenant_a agent acting on tenant_b resource
  → RAP verifies CrossTenantDelegation exists and is valid
  → PERMIT (scoped to delegated actions only)
  → Receipt binds BOTH tenantIds + delegationId
```

## Failure Modes

| Failure | Decision |
|---|---|
| No CrossTenantDelegation found | DENY |
| Delegation expired | DENY |
| Action not in delegation.allowedActions | DENY |
| Delegation approval receipt missing | DENY |
| Delegation tenant fields mismatch request | DENY |

## Prohibited Patterns

- Query-string tenant override to access another tenant's data
- Client-selected tenantId without server validation
- Agent from Tenant A reading Tenant B's receipts without delegation
- Implicit trust transfer through shared connectors
