# Microsoft Agent Trust Profile

## Supported Microsoft Agents

- Microsoft 365 Copilot agents
- Copilot Studio agents
- Azure AI Foundry agents
- Azure Logic Apps workflows
- Microsoft Teams bots
- Power Automate flows
- Microsoft Graph actions
- GitHub Copilot coding agents

## Trust Route (Copilot Email Draft Example)

```
Enterprise Tenant: tenant_enterprise_globex
  → Communications Mission: mission_comms_outreach
  → Copilot Communications Pack: pack_copilot_comms
  → Copilot Email Agent: externalAgentId=copilot_email_001, platformType=microsoft_copilot
  → Microsoft Graph Connector: connectorId=conn_graph_globex
  → VerifiedTrust: nhiId=svc_m365_globex → lifecycle=active, credFreshness=valid
  → RAP: action=graph.mail.send → STEP_UP (sensitive action)
  → Approval obtained: approved_by=manager@globex.com
  → PERMIT after approval
  → ExecutionReceipt with approvalRef
```

## Sensitive Microsoft Actions (Always STEP_UP)

```
graph.mail.send          (external recipients)
graph.files.export
graph.files.delete
powerautomate.flow.trigger  (finance/HR/customer data)
github.pr.merge
github.secret.update
entra.user.update
teams.message.send       (external channels)
```

## Azure AI Foundry / GitHub Trust Notes

Azure AI Foundry agents use `sdk_wrapper` interception mode. GitHub Copilot agents use `api_gateway` or `ci_cd_gate` depending on workflow type.
