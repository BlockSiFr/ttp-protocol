# Integrations

TTP wraps the boundary where an action happens — no agent rewrite, no IdP
replacement. The enforcement point and current status by surface:

<p align="center">
  <img src="/diagrams/integrations.svg" alt="Integration surfaces and status" style="width:100%;border:1px solid #1e2430;border-radius:12px" />
</p>

| Surface | Enforcement point | Status |
| --- | --- | --- |
| GitHub Actions | workflow job | reference |
| CI/CD Pipelines | pipeline stage | reference |
| API Gateways | gateway request | experimental |
| Service Accounts | token issuance | experimental |
| Microsoft Copilot | tool call | planned |
| Azure DevOps | release stage | planned |
| LangChain | agent tool | experimental |
| CrewAI | agent step | planned |

::: authority PATTERN
Each integration evaluates a `TrustProof` at the surface's action point and
records an [ExecutionReceipt](/guide/receipts) for the decision.
:::
