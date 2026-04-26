# Examples

This directory contains both integration patterns and illustrative protocol expressions.

## A) Integration pattern docs

### CI/CD
- `governed-ci/github-actions-governed-step.md`
- `governed-ci/azure-devops-governed-pipeline.md`

### API/runtime surfaces
- `api-gateway/api-gateway-enforcement.md`
- `copilot-tool-gate/copilot-tool-call-gate.md`
- `github-app-self-governance.md`

## B) Illustrative `.ttp` protocol examples (non-executable)

- `copilot-delegation.ttp`
- `github-actions-deploy.ttp`
- `mcp-tool-delegation.ttp`
- `terraform-apply.ttp`
- `agent-to-agent-trust-route.ttp`

These `.ttp` files are illustrative protocol examples unless/until a compiler is introduced.

## Core boundary reminder

- TTP expresses trust context, trust routing, delegation, and decay semantics.
- Runtime Authority enforces execution decisions.
