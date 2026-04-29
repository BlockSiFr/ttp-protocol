---
title: "Microsoft Foundry SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# Microsoft Foundry SCIM-RE API Developer Guide

## Purpose
SCIM-RE adds an Authority Plane in front of protected execution in Azure AI Foundry workflows.

## Platform Context
Foundry handles agent runs, tools, and enterprise data paths. Protect production tool calls, deployment actions, and privileged data access.

## Core Execution Invariant
```text
Foundry agent run/tool call → Azure Function or APIM SCIM-RE middleware → /re/authorize → Foundry tool/action execution → ExecutionReceipt
```

## Identity Mapping
| Platform concept | SCIM-RE field |
|---|---|
| Azure tenant | `tenantId` |
| Managed identity | `subject` |
| Foundry project | `context.projectId` |
| Agent ID | `context.agentId` |
| Thread/run ID | `context.threadId` / `context.runId` |

## Action Namespace
- Prefix: `microsoft-foundry.*`
- Example: `microsoft-foundry.tool.invoke`

## Enforcement Rules
1. Production tool calls require grant.
2. Agent deployment requires change-control authority.
3. Canonical tool argument hash must be included in receipt context.
4. Fail closed if `/re/authorize` is unavailable.

## Required Tests
- Low-risk read allowed with grant.
- Mutation denied without grant.
- Risky action triggers `step-up` or `escalate`.
- Receipt written to platform-visible audit context.

## Source References
- https://learn.microsoft.com/en-us/azure/foundry/
- https://learn.microsoft.com/en-us/rest/api/aifoundry/
- https://azure.microsoft.com/en-us/products/ai-foundry
