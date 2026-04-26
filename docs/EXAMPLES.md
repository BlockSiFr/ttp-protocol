# Protocol Examples (TTP Expressions)

These examples are illustrative protocol expressions for trust transfer and trust routing.

## 1) Copilot delegates CRM read scope to an agent
- TTP expresses delegated trust context, scope, and decay.
- Runtime Authority enforces execution before CRM access.
- File: `examples/copilot-delegation.ttp`

## 2) GitHub Actions pipeline receives temporary deploy authority
- TTP expresses short-lived delegated deploy trust.
- Runtime Authority evaluates policy and attestation before deploy.
- File: `examples/github-actions-deploy.ttp`

## 3) MCP server delegates tool access to an agent
- TTP expresses tool-scope delegation and attestation requirements.
- Runtime Authority gates tool invocation.
- File: `examples/mcp-tool-delegation.ttp`

## 4) Terraform apply requires fresh trust and step-up
- TTP expresses elevated-risk trust requirements and freshness constraints.
- Runtime Authority decides whether step-up is required before apply.
- File: `examples/terraform-apply.ttp`

## 5) Agent-to-agent delegation with decay
- TTP expresses chained delegation and per-hop decay.
- Runtime Authority enforces each hop before execution.
- File: `examples/agent-to-agent-trust-route.ttp`

Boundary reminder: TTP expresses trust context. Runtime Authority enforces execution decisions.
