# Documentation Center

Use this directory by objective, not by file name.

## 1) I need to establish trustworthiness

Start here in order:

1. [`docs/concepts/trustworthiness-establishment.md`](./concepts/trustworthiness-establishment.md)
2. [`docs/concepts/trust-decay.md`](./concepts/trust-decay.md)
3. [`docs/concepts/trust-proofs.md`](./concepts/trust-proofs.md)
4. [`examples/README.md`](../examples/README.md)

## 2) I need to integrate a downstream runtime system

Start here in order:

1. [`docs/integrations/api-gateway.md`](./integrations/api-gateway.md)
2. [`docs/integrations/github-actions.md`](./integrations/github-actions.md)
3. [`docs/integrations/mcp.md`](./integrations/mcp.md)
4. [`specs/scim-re-authorize-api.md`](../specs/scim-re-authorize-api.md)

## 3) I need enterprise boundary context

Start here in order:

1. [`COMMERCIAL_BOUNDARY.md`](../COMMERCIAL_BOUNDARY.md)
2. [`docs/enterprise/security-model.md`](./enterprise/security-model.md)
3. [`docs/enterprise/threat-model.md`](./enterprise/threat-model.md)
4. [`docs/enterprise/deployment-patterns.md`](./enterprise/deployment-patterns.md)

## 4) I need protocol and contract source-of-truth

- [`specs/README.md`](../specs/README.md)
- OpenAPI: [`specs/openapi/runtime-authority-gate.openapi.json`](../specs/openapi/runtime-authority-gate.openapi.json)
- Schemas: [`specs/schemas/`](../specs/schemas)
- RFCs: [`rfcs/`](../rfcs/)

## Documentation Principles

- TTP establishes trustworthiness before downstream authority and execution.
- SCIM-RE structures runtime trust context.
- RAP evaluates authority.
- Execution Exchange enforces downstream runtime decisions in production.
- CortexTrace records evidence and receipts.
