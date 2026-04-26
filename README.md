# Trust Transfer Protocol

TTP is the protocol for expressing, transferring, routing, and verifying trust before autonomous execution.

## 1. What TTP Is

TTP (Trust Transfer Protocol) is the protocol layer in BlockSiFr Agent Trust Infrastructure for:
- delegated trust expression,
- trust routing across autonomous chains,
- trust decay semantics,
- attestation and trust-proof context packaging,
- verifiable trust context handoff into runtime authority systems.

TTP is protocol-first, standards-style, and implementation-portable.

## 2. What TTP Is Not

TTP is not:
- the runtime gate,
- FrontDesk,
- the full product,
- an execution runtime,
- a trusted third party,
- a blockchain-first system.

TTP does not enforce execution decisions by itself.

## 3. Why Trust Transfer Matters

Autonomous execution chains (human → copilot → agent → workflow → API) require explicit, scoped, time-bound, and decaying trust transfer.

Without explicit trust transfer semantics, runtime authority has incomplete context and governance cannot be consistently auditable.

## 4. Core Concepts

- **TrustSubject**: identity participating in trust transfer.
- **TrustGrant**: scoped, time-bounded trust/authority expression.
- **TrustRoute**: ordered trust transfer path across hops.
- **Delegation**: explicit transfer from one TrustSubject to another.
- **Attestation**: freshness/legitimacy evidence bound to a subject or action.
- **TrustDecay**: time-based reduction in usable trust.
- **TrustProof**: packaged evidence supporting trust claims.
- **ExecutionIntent**: action/resource intent requiring runtime evaluation.

## 5. Architecture Relationship

- **TTP**: trust expression, delegated trust, trust routing, trust decay, trust proof packaging.
- **SCIM-RE**: runtime schema plane (`WorkloadIdentity`, `AuthorityGrant`, `Attestation`, `ExecutionReceipt`).
- **Runtime Authority**: enforcement engine for runtime decisions.
- **FrontDesk**: enterprise UX and governance control plane built around runtime authority.

## 6. Execution Flow

`Intent → TTP trust context → SCIM-RE AuthorityGrant/Attestation → Runtime Authority decision → ExecutionReceipt`

## 7. Example Trust Transfer

Human delegate:
- subject: `human:alice`
- delegated scope: `crm.read:accounts`
- target: `agent:crm-assistant-7`
- decay: `600s`
- attestation: `session-attestation-v1`

TTP expresses this context. Runtime Authority evaluates and enforces execution before the action runs.

## 8. Trust Routing

Trust routing defines how trust context traverses multi-hop autonomous chains.

Example chain:
`human → Microsoft Copilot → agent → MCP tool → API → database`

Each hop carries:
- delegator,
- delegatee,
- scope,
- decay,
- attestation requirements,
- runtime authority evaluation requirement.

See:
- `docs/TRUST_ROUTING.md`
- `docs/EXAMPLES.md`
- `examples/*.ttp`

## 9. Developer Quickstart

1. Read protocol specs in `specs/README.md`.
2. Review architecture boundaries in `docs/ARCHITECTURE.md` and `docs/PROTOCOL_BOUNDARIES.md`.
3. Review TTP↔SCIM-RE concept mapping in `docs/SCIM_RE_ALIGNMENT.md`.
4. Run repo checks:

```bash
npm test
python -m py_compile sdk/python/client.py
```

5. Review illustrative protocol examples in `examples/*.ttp`.

## 10. Repository Structure

- `specs/` — canonical TTP + SCIM-RE specification artifacts.
- `docs/` — architecture, boundaries, alignment, routing, deployment, and examples guidance.
- `examples/` — illustrative `.ttp` trust-transfer examples and integration patterns.
- `sdk/` — integration SDKs for runtime authority callers.
- `reference-implementations/` — reference components for surrounding infrastructure.

## 11. Roadmap

- tighten formal trust routing semantics,
- expand normative trust decay and delegation constraints,
- strengthen cross-surface conformance examples,
- improve interoperability mapping with deterministic governance substrates.

## 12. Contributing

See `CONTRIBUTING.md`.

Contributions should preserve this core boundary:
- TTP expresses trust context and protocol semantics.
- Runtime Authority and FrontDesk enforce and operationalize execution governance.

## 13. License

Apache-2.0 (see `LICENSE`).
