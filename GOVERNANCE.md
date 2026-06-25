# Governance

TTP is open protocol infrastructure.

Changes to grammar, primitives, schemas, proof modes, trust proof outcomes, receipt semantics, or downstream runtime decision semantics must follow the RFC process.

Process:

1. Open an issue.
2. Explain the trustworthiness problem.
3. Identify the actor or system being evaluated.
4. Describe the evidence, attestation, or trust condition involved.
5. Describe the affected primitive.
6. Submit an RFC.
7. Provide examples.
8. Add schema or evaluator tests.
9. Receive maintainer review.
10. Merge after consensus.

The goal is interoperability, not vendor lock-in.

TTP should remain narrow:

* define trustworthiness semantics
* define trust primitives
* define proof requirements
* define decay semantics
* define attestation semantics
* define receipt semantics
* support downstream runtime authority systems

TTP should not become:

* a full IAM system
* a SIEM
* a GRC platform
* an AI monitoring tool
* a security dashboard
* a full commercial control plane
* the production enforcement product
