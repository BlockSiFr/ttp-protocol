# Example: Copilot Tool-Call Gate

A governed tool-call pattern for agent assistants:

1. Agent intends a tool call (e.g., `delete_production_secret`).
2. Tool broker sends runtime authorization request to FrontDesk.
3. Tool broker executes only if decision is `PERMIT`.
4. Tool broker logs `ExecutionReceipt` with prompt and tool transcript references.

Example payload:

```json
{
  "requestId": "copilot-tool-009",
  "principal": { "id": "copilot-agent", "type": "assistant-agent" },
  "action": "tool.invoke",
  "resource": { "type": "tool", "id": "delete_production_secret" },
  "context": { "trustScore": 0.31, "intent": "cleanup" },
  "authorityGrant": { "grantId": "grant-local-001", "expiresAt": "2030-01-01T00:00:00Z", "scope": ["tool.invoke:delete_production_secret"] }
}
```

Expected outcome: likely `DENY` or `ESCALATE` for high-risk actions at low trust.
