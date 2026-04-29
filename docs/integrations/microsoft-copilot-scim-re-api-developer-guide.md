---
title: "Microsoft Copilot SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# Microsoft Copilot SCIM-RE API Developer Guide

## Purpose
SCIM-RE adds an Authority Plane in front of protected Copilot tool and connector execution.

## Platform Context
Copilot Studio and Microsoft 365 Copilot can execute connectors, tools, and Graph actions. Protect write and delegation paths.

## Core Execution Invariant
```text
Copilot agent/action/connector → FrontDesk Copilot Middleware → /re/authorize → connector/API/tool execution → ExecutionReceipt
```

## Identity Mapping
| Platform concept | SCIM-RE field |
|---|---|
| Entra tenant ID | `tenantId` |
| Entra object ID | `subject` |
| Copilot agent ID | `context.agentId` |
| Connector ID | `context.connectorId` |
| Graph resource | `resource` |

## Action Namespace
- Prefix: `microsoft-copilot.*`
- Example: `microsoft-copilot.tool.invoke`

## Enforcement Rules
1. Graph mutations require explicit grant.
2. MCP tool calls must bind arguments hash and agent/user identity.
3. High-risk domains require `step-up` or `escalate`.
4. Fail closed if `/re/authorize` is unavailable.

## Required Tests
- Read path allowed with grant.
- Mutation denied without grant.
- Sensitive action triggers `step-up`.
- Receipt captured in audit log.

## Source References
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-rest-api
- https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/overview-copilot-connector
