# TTP Operator Guide

Operator workflows for managing the agent registry and trust-state controls in the reference Trust Authority.

## Register Agents

```bash
curl -X POST http://localhost:3000/v1/admin/agents \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-retention-001",
    "description": "Retention agent for production"
  }'
```

## List Agents (Registry)

```bash
# Basic list
curl -X GET http://localhost:3000/v1/admin/agents \
  -H "Authorization: Bearer $ADMIN_KEY"

# Include optional receipt metrics (domain-scoped)
curl -X GET "http://localhost:3000/v1/admin/agents?include_metrics=true&domain=retention" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## Check Agent Status

```bash
curl -X GET http://localhost:3000/v1/admin/agents/agent-retention-001/status \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## Quarantine / Block Controls

```bash
# Quarantine
curl -X POST http://localhost:3000/v1/admin/agents/agent-retention-001/quarantine \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"manual","reason":"investigating anomalous tool calls"}'

# Block
curl -X POST http://localhost:3000/v1/admin/agents/agent-retention-001/block \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason":"confirmed compromise"}'
```

## Metrics Notes

- `POST /v1/tokens` returns current trust summary (`score`, `issuer_count`).
- Behavioral receipts provide event-level evidence (`event_type`, `event_data`, `timestamp`, `score`).
- Use trend dashboards for score drift, issuer diversity, and quarantine frequency.
