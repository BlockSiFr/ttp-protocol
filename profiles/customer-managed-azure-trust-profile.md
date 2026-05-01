# Customer-Managed Azure Trust Profile

## Overview

Enterprise tenants can run FrontDesk runtime workers inside their own Azure tenant. The FrontDesk control plane coordinates the mission; the customer's Azure environment executes it.

## Architecture

```
BlockSiFr Control Plane (SaaS)
  │
  ├── Mission coordination
  ├── RAP authorization evaluation
  ├── Receipt chain management
  │
  └── Customer Azure Runtime (customer-managed)
        ├── Runtime worker (Azure Container App / AKS)
        ├── Customer-owned Managed Identity (workload identity)
        ├── Customer-owned Key Vault (secrets, signing keys)
        ├── Customer-owned Storage Account (state, receipts)
        ├── Customer-owned Log Analytics (tenant-scoped logs)
        └── Optional: Private Networking (Private Endpoint, VNet)
```

## Trust Route

```
Enterprise Tenant: tenant_enterprise_globex
  → Customer Azure Environment: environmentId=env_azure_globex_eastus
  → Environment Attestation: attestedAt=<recent>, imageDigest=sha256:..., signingKeyRef=kv_globex_fd_key
  → Managed Identity: nhiId=mi_frontdesk_globex_prod (VerifiedTrust validated)
  → FrontDesk Control Plane authorizes mission via RAP
  → Runtime worker in customer Azure executes governed agent action
  → Receipt signed with customer-owned signingKeyRef
  → Receipt stored in customer-owned Storage Account
  → Receipt hash anchored in BlockSiFr receipt chain
```

## Trust Proof Requirements

The TTP proof for customer Azure must bind:
- `tenantId`
- `environmentId`
- `imageDigest` (container image integrity)
- `signingKeyRef` (customer Key Vault reference)
- `managedIdentityRef` (customer managed identity)
- `networkPolicyRef` (if private networking active)
- `attestedAt` (must be < 4 hours old for protected execution)

## Responsibility Model

| Responsibility | BlockSiFr | Customer |
|---|---|---|
| Control plane uptime | ✓ | |
| RAP authorization logic | ✓ | |
| Receipt chain integrity | ✓ | |
| Mission coordination | ✓ | |
| Runtime worker compute | | ✓ |
| Key Vault management | | ✓ |
| Managed identity lifecycle | | ✓ |
| Storage Account management | | ✓ |
| Network security | | ✓ |
| Log Analytics destination | | ✓ |
| Azure Policy compliance | | ✓ |
