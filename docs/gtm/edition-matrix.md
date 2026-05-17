# Edition Matrix

This matrix explains what belongs in the open protocol repository and what may become managed or enterprise packaging. It is positioning guidance, not a product price sheet.

| Capability | Open protocol repo | Managed / enterprise option |
| --- | --- | --- |
| Protocol specification | Included | Included with support and implementation guidance |
| Schemas and test vectors | Included | Included with compatibility review |
| Local CLI and examples | Included | Included with onboarding support |
| TypeScript/Python/Node SDK foundations | Included as pre-release interfaces | Hardened SDKs, release management, and support SLAs |
| Reference Trust Authority | Included for pilots and interoperability | Managed Trust Authority operations and upgrade support |
| Issuer and verifier patterns | Included | Connector certification and integration support |
| Execution receipts | Included as schemas and reference behavior | Managed evidence storage, retention, and review workflows |
| Policy and threshold examples | Included as examples | Policy simulation, assurance, and enterprise workflow mapping |
| Security documentation | Included | Security review support and deployment guidance |
| Compliance dashboards | Not included | Optional commercial add-on |
| SLA-backed operations | Not included | Optional commercial add-on |
| Premium proprietary connectors | Not included | Optional commercial add-on |

## Procurement-Friendly Summary

TTP is the open trust semantics layer for runtime authority. The open-source package helps teams evaluate, integrate, and interoperate around trust proof, decay, delegation, and receipts.

Commercial offerings should be positioned as operational depth around the protocol: managed reliability, support, deployment assurance, evidence workflows, and enterprise-specific integrations. They should not be required to understand or independently implement the core protocol.

## Packaging Rules

- Keep protocol semantics, schemas, examples, and conformance artifacts portable.
- Keep managed operations, dashboards, paid support, and premium workflow automation outside the open protocol package.
- Do not require paid services to verify a core TTP claim.
- Make production-readiness status explicit for each package and reference implementation.
