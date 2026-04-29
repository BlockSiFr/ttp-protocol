# Documentation Center

Use this directory by objective, not by file name.

## 1) I need to integrate runtime authorization

Start here in order:
1. [`docs/user-guide.md`](./user-guide.md)
2. [`docs/api/runtime-authority-gate.md`](./api/runtime-authority-gate.md)
3. [`specs/scim-re-authorize-api.md`](../specs/scim-re-authorize-api.md)
4. [`examples/README.md`](../examples/README.md)

## 2) I need to deploy/operate FrontDesk

Start here in order:
1. [`docs/deployment-guide.md`](./deployment-guide.md)
2. [`docs/admin-guide.md`](./admin-guide.md)
3. [`docs/repo-completeness-assessment.md`](./repo-completeness-assessment.md)
4. [`docs/security.md`](./security.md)

## 3) I need protocol and contract source-of-truth

- [`specs/README.md`](../specs/README.md)
- OpenAPI: [`specs/openapi/runtime-authority-gate.openapi.json`](../specs/openapi/runtime-authority-gate.openapi.json)
- Schemas: [`specs/schemas/`](../specs/schemas)

## 4) I need governance/boundary context

- Open-source vs paid boundary: [`docs/open-source-boundary.md`](./open-source-boundary.md)
- Governance posture: [`docs/governance.md`](./governance.md)


## 5) I need platform integration drafts

- [`docs/integrations/openai-agents-scim-re-api-developer-guide.md`](./integrations/openai-agents-scim-re-api-developer-guide.md)
- [`docs/integrations/microsoft-copilot-scim-re-api-developer-guide.md`](./integrations/microsoft-copilot-scim-re-api-developer-guide.md)
- [`docs/integrations/microsoft-foundry-scim-re-api-developer-guide.md`](./integrations/microsoft-foundry-scim-re-api-developer-guide.md)
- [`docs/integrations/zoho-scim-re-api-developer-guide.md`](./integrations/zoho-scim-re-api-developer-guide.md)
- [`docs/integrations/talentgenius-scim-re-api-developer-guide.md`](./integrations/talentgenius-scim-re-api-developer-guide.md)

## 6) I need commercialization planning docs

- [`docs/gtm-assessment.md`](./gtm-assessment.md)

---

## Documentation principles for this repo

- Trust is evaluated **before** execution.
- No governed action bypasses `POST /re/authorize`.
- Every decision emits an `ExecutionReceipt`.
- TTP is trust-expression; SCIM-RE/RAP are runtime governance/enforcement.
