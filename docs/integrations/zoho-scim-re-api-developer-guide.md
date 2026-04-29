---
title: "Zoho SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# Zoho SCIM-RE API Developer Guide

## Purpose
SCIM-RE adds an Authority Plane in front of protected Zoho execution. It does not replace Zoho identity, OAuth, or workflows.

## Platform Context
Zoho CRM uses OAuth 2.0 scopes and webhook events. Protect writes, exports, owner transfers, email sends, and webhook-driven actions.

## Core Execution Invariant
```text
Zoho workflow / custom function / API client → Zoho Execution Gateway → /re/authorize → Zoho API call → ExecutionReceipt
```

## Identity Mapping
| Zoho concept | SCIM-RE field |
|---|---|
| Org ID | `tenantId` |
| User ID | `subject` |
| OAuth client ID | `context.clientId` |
| Module/record ID | `resource` |
| OAuth scopes | `context.oauthScopes` |

## Action Namespace
- Prefix: `zoho.*`
- Example: `zoho.crm.deal.update`

## Enforcement Rules
1. Validate scopes before building the authorization request.
2. High-impact actions must authorize before execution.
3. Fail closed if `/re/authorize` is unavailable.
4. `step-up` and `escalate` are non-executable until satisfied.

## Required Tests
- Read allowed with valid grant.
- Mutation denied without grant.
- Sensitive actions return `step-up` when required.
- Receipt ID is written to audit metadata.

## Source References
- https://www.zoho.com/crm/developer/docs/api/v8/oauth-overview.html
- https://www.zoho.com/crm/developer/docs/api/v8/scopes.html
- https://www.zoho.com/crm/developer/docs/api/v8/create-webhook.html
