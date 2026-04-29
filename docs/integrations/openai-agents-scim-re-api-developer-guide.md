---
title: "OpenAI Agents SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# OpenAI Agents SCIM-RE API Developer Guide

## Purpose
SCIM-RE adds an Authority Plane in front of protected OpenAI agent tool execution and handoff flows.

## Platform Context
OpenAI Agents SDK and Responses API support tool invocation, orchestration, and handoffs. Protect external tools, side effects, and privileged operations.

## Core Execution Invariant
```text
OpenAI agent tool call/handoff → SCIM-RE tool wrapper → /re/authorize → execute only if authorized → ExecutionReceipt
```

## Identity Mapping
| Platform concept | SCIM-RE field |
|---|---|
| Agent ID | `subject` |
| Tool name | `resource` |
| Handoff target | `context.handoffTarget` |
| Trace ID | `context.traceId` |
| User ID | `context.userId` |

## Action Namespace
- Prefix: `openai-agents.*`
- Example: `openai-agents.tool.invoke`

## Enforcement Rules
1. Every external tool call must authorize before execution.
2. Handoffs are delegation events and require trust-route validation.
3. Computer-use and sandbox actions default to full evaluation.
4. Fail closed if `/re/authorize` is unavailable.

## Required Tests
- Low-risk operation allowed with grant.
- Mutation denied without grant.
- Sensitive operation returns `step-up`.
- Receipt metadata attached to tool result or audit record.

## Source References
- https://developers.openai.com/api/docs/guides/agents
- https://openai.github.io/openai-agents-python/tools/
- https://developers.openai.com/api/docs/guides/agents/orchestration
- https://openai.github.io/openai-agents-python/handoffs/
