# TTP vs Existing Standards

TTP is complementary to existing identity, policy, credential, and visibility systems. It should not be positioned as a replacement for mature standards that solve different layers.

Core point:

> Existing systems prove identity, access, credentials, policy, or event visibility. TTP expresses live, decaying, transferable trust context for execution-time authority evaluation.

| Standard | Primary Function | What It Does Well | What TTP Adds |
| --- | --- | --- | --- |
| OAuth 2.0 | Delegated authorization framework. | Access tokens, consent, delegated API access. | Live trust context and decay before execution. |
| OIDC | Identity layer on OAuth 2.0. | Authentication, identity claims, federation. | Trust proof requirements beyond identity. |
| SAML | Enterprise federation and assertions. | Browser SSO and enterprise identity federation. | Execution-time trust freshness and decay. |
| SCIM | Identity lifecycle provisioning. | User and group provisioning across systems. | Runtime trust claims for autonomous actors. |
| SPIFFE/SPIRE | Workload identity. | Strong workload identities and mTLS integration. | Trust score, proof, delegation, and decay semantics. |
| OPA/Rego | General policy evaluation. | Flexible policy-as-code decisions. | A specific trust expression grammar OPA can consume. |
| Cedar | Authorization policy language. | Fine-grained app authorization. | Time-decaying trust context as an input to authorization. |
| X.509/PKI | Certificates and public key trust. | Identity, signing, TLS, certificate chains. | Scoped trust claims that change over time. |
| Verifiable Credentials | Tamper-evident credentials. | Issuer-holder-verifier credential exchange. | Execution-time trust decay and authority context. |
| DIDs | Decentralized identifiers. | Identifier control and resolution patterns. | Trust evaluation semantics over identified actors. |
| PAM | Privileged access management. | Human privileged session control and approvals. | Trust context for agents, workloads, and automated execution. |
| NHI governance tools | Inventory and governance of non-human identities. | Lifecycle, posture, ownership, compliance. | Portable protocol grammar for live trust before action. |
| API gateways | Traffic control and enforcement. | Routing, authn/z plugins, rate limits, enforcement. | Trust context the gateway can evaluate or forward. |
| SIEM/SOAR | Security visibility and automation. | Event collection, detection, response workflows. | Pre-execution trust proof rather than post-event visibility. |

## Integration Posture

TTP should be used with existing standards rather than instead of them. For example:

- OIDC authenticates the actor.
- SPIFFE identifies the workload.
- OPA/Cedar evaluates policy.
- TTP supplies decaying trust context.
- RAP decides runtime authority.
- Execution Exchange or an API gateway enforces the result.
