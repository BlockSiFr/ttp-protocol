# External Agent Trust Profile

## Purpose

This profile defines how FrontDesk establishes and routes trust for agents from external platforms (Zoho, TalentGenius, Microsoft Copilot, GitHub, MCP, custom agents).

## Core Principle

FrontDesk wraps external agent identity into a FrontDesk-governed agent record (`ExternalAgent`). The trust route treats the external platform agent as a **delegated execution entity** within the FrontDesk mission trust context.

## External Agent Trust Route

```
FrontDesk Mission Trust Context (tenantId, missionId, agentPackId)
  → External Agent Registration (externalAgentId, platformId, frontdeskAgentId, tenantId)
  → Platform Connector (connectorId → VerifiedTrust NHI evaluation if verifiedTrustRequired)
  → Interception Mode (native_runtime | api_gateway | webhook | sdk_wrapper | mcp_proxy | audit_log_ingestion | manual_receipt)
  → RAP Authorization Request (externalAgentId + platformId + platformType + interceptionMode)
  → RAP Decision
  → Platform Evidence Capture (platformEvidenceRef)
  → ExecutionReceipt (externalAgentId + platformId + platformEvidenceRef + tenantId)
```

## Trust Establishment Rules

1. External agent MUST be registered with `tenantId` before it can be included in a mission.
2. External agent's `platformId` MUST match a connected `AgentPlatform` record for the same tenant.
3. External agent's `allowedActions` defines the scope boundary — RAP denies any action outside it.
4. `verifiedTrustRequired: true` means VerifiedTrust NHI context is mandatory for the connector.

## Trust Decay for External Agents

External agent trust decays through:
- Platform connector credential freshness (via VerifiedTrust if `verifiedTrustRequired`)
- Last sync timestamp (`lastSyncedAt`) — agents not synced within 24h are flagged as `stale`
- Platform API connectivity status
- Interception coverage — `not_supported` interception mode limits trust confidence

## Platform Evidence Binding

When a governed external agent action completes, the `ExecutionReceipt` MUST include:
- `externalAgentId`
- `platformId`
- `platformType`
- `platformEvidenceRef` (the platform's own event/audit reference)
- `interceptionMode`

If `interceptionMode = manual_receipt`, coverage is limited — the receipt notes this and compliance coverage is marked partial.

## Failure Modes

| Failure | TTP result |
|---|---|
| External agent not registered | `proof_invalid: unregistered_external_agent` |
| External agent tenant mismatch | `proof_invalid: external_agent_tenant_mismatch` |
| Platform connector disconnected | `proof_invalid: platform_connector_unavailable` |
| VerifiedTrust required but missing | `proof_invalid: verifiedtrust_context_required` |
| Action outside allowedActions | `proof_invalid: external_agent_action_out_of_scope` |
| Platform evidence missing on required receipt | `proof_partial: platform_evidence_missing` |
