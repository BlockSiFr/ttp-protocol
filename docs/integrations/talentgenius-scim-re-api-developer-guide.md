---
title: "TalentGenius SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# TalentGenius SCIM-RE API Developer Guide

## Purpose
SCIM-RE adds an Authority Plane in front of protected TalentGenius execution. It does not replace platform identity or workflow orchestration.

## Platform Context
TalentGenius public materials describe talent AI workflows. This guide is a provisional contract until partner API details are finalized.

## Core Execution Invariant
```text
TalentGenius agent action → TalentGenius SCIM-RE Adapter → /re/authorize → TalentGenius workflow/API → ExecutionReceipt
```

## Identity Mapping
| Platform concept | SCIM-RE field |
|---|---|
| Workspace ID | `tenantId` |
| Recruiter/user ID | `subject` |
| Agent ID | `context.agentId` |
| Candidate ID | `resource` |
| Requisition ID | `context.requisitionId` |

## Action Namespace
- Prefix: `talentgenius.*`
- Example: `talentgenius.outreach.send`

## Enforcement Rules
1. Candidate PII access requires explicit authority grant.
2. Outreach and export actions require grant and risk checks.
3. Fail closed if `/re/authorize` is unavailable.
4. `throttle`/`constrain` must be enforceable by adapter runtime.

## Required Tests
- Low-risk read allowed with grant.
- Mutation denied without grant.
- Sensitive action requires `step-up`.
- Receipt metadata persisted for audit.

## Source References
- https://talentgenius.io/
- https://talentgenius.io/agents/developers
- https://toolbox.talentgenius.io/agents/understanding-ai-agents
