# TTP Roadmap

TTP is in a specification-first, implementation-seeding phase. The immediate objective is a credible protocol kernel: clear grammar, runnable examples, testable evaluation semantics, and explicit boundaries with runtime enforcement systems.

## Phase 0 - Protocol Cleanup

- Rewrite README positioning and scope.
- Publish core specification.
- Add `.ttp` examples.
- Add threat model and security policy.
- Clarify TTP, SCIM-RE, RAP, Execution Exchange, FrontDesk, and VerifiedTrust boundaries.
- Remove language that implies production readiness or complete governance coverage.

## Phase 1 - MVP Parser/Evaluator

- Parse core blocks: `subject`, `trust`, `proof`, `authority_context`, `delegation`.
- Build an AST/object model.
- Validate required syntax and useful errors.
- Evaluate static trust scores.
- Evaluate trust decay over time.
- Evaluate threshold conditions.
- Emit JSON evaluation results.
- Add fixture and CLI tests.

## Phase 2 - Runtime Integration

- Map TTP evaluation context into RAP requests.
- Map TTP subject and attestation fields into SCIM-RE resources.
- Add an `ExecutionReceipt` placeholder mapping.
- Publish a small SDK for embedding the evaluator.
- Provide integration examples for CI, API gateways, MCP tool gateways, and agent runtimes.

## Phase 3 - Proof Hardening

- Add signed trust claims.
- Define issuer registry and issuer validation rules.
- Add replay protection guidance.
- Add receipt hash semantics.
- Prototype a ZKP-compatible proof backend.
- Keep `cleartext-dev` as the non-production development mode.

## Phase 4 - Ecosystem

- Add VSCode language support.
- Add formatter and linter.
- Publish conformance tests.
- Define policy registry conventions.
- Build reference gateway integration.
- Encourage independent implementations.

## Roadmap Principles

- Protocol clarity before feature breadth.
- Narrow TTP scope; no blurred product-layer claims.
- Security review before production recommendations.
- Interoperability over vendor lock-in.
- Concrete examples and tests over manifesto language.
