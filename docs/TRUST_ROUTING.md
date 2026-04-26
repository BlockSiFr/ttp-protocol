# Trust Routing

Trust routing is the mechanism by which trust context, delegated authority, attestations, and execution intent traverse across autonomous execution chains.

## Example chain

`human → Microsoft Copilot → agent → MCP tool → API → database`

At each hop, capture:
- who is delegating,
- what trust is transferred,
- what scope applies,
- what decay applies,
- what attestation is required,
- what authority gate must evaluate before execution.

## Hop-by-hop illustration

| Hop | Delegating principal | Trust transferred | Scope | Decay | Attestation | Gate evaluation |
|---|---|---|---|---|---|---|
| Human → Copilot | Human operator | Task intent trust | `crm.read` | 15 min | User auth + session attestation | Runtime Authority pre-tool-call |
| Copilot → Agent | Copilot workload identity | Delegated execution trust | `crm.read:accounts` | 10 min | Copilot attestation | Runtime Authority pre-agent action |
| Agent → MCP tool | Agent workload identity | Tool invocation trust | `tool.crm.query` | 5 min | Agent attestation | Runtime Authority pre-tool invocation |
| MCP tool → API | MCP workload identity | API access trust | `api.crm.read` | 5 min | Tool attestation | API-side Runtime Authority gate |
| API → Database | API workload identity | Data access trust | `db.crm.select` | 2 min | Service attestation | Data access Runtime Authority gate |

## Pseudo-JSON trust route example

```json
{
  "trustRouteId": "route-crm-read-001",
  "executionIntent": {
    "action": "crm.read.accounts",
    "resource": "crm/account"
  },
  "hops": [
    {
      "from": "human:alice",
      "to": "copilot:ms-copilot-session-1",
      "delegatedScope": ["crm.read"],
      "decay": {"ttlSeconds": 900},
      "requiredAttestation": "session-attestation-v1"
    },
    {
      "from": "copilot:ms-copilot-session-1",
      "to": "agent:crm-assistant-7",
      "delegatedScope": ["crm.read:accounts"],
      "decay": {"ttlSeconds": 600},
      "requiredAttestation": "copilot-attestation-v1"
    }
  ],
  "authorityEvaluation": {
    "endpoint": "POST /re/authorize",
    "required": true
  }
}
```

TTP expresses this trust route context.
Runtime Authority evaluates and enforces execution decisions.
