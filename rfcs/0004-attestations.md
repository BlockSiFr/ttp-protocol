# RFC: Attestations

## Summary

Define interoperable TTP semantics for attestations as part of trustworthiness establishment for autonomous systems.

## First-Principles Problem

Autonomous actors can hold valid identity and assigned permissions while their current trustworthiness is stale, insufficient, decayed, or unsupported by fresh evidence.

## Trustworthiness Question

* What actor is being evaluated?
* What trustworthiness question is being answered?
* What evidence or attestation is required?
* What trust condition can decay?
* What proof should be produced?
* What downstream authority system may rely on the result?
* What remains commercial?

## Motivation

TTP must establish evidence-backed trust before RAP, Execution Exchange, API gateways, CI gates, or other runtime authority systems make downstream decisions.

## Proposed Primitive or Change

Specify the grammar, schema, evaluator behavior, and receipt impact for attestations without moving production enforcement into the open protocol.

## Example

```text
Subject -> TrustClaim -> Attestation -> TrustDecay evaluation -> TrustProof -> downstream authority evaluation -> ExecutionReceipt
```

## Security Considerations

Define issuer validation, freshness requirements, replay boundaries, clock assumptions, failure behavior, and evidence integrity requirements. Cleartext-dev proof modes are not production proof modes.

## Commercial Boundary

TTP defines open protocol semantics. BlockSiFr Execution Exchange, managed Runtime Authority Gate, production RAP service, HSM-backed signing, production receipt ledgers, enterprise evidence engines, and customer-specific baselines remain commercial capabilities.

## Open Questions

* Which existing schema fields are sufficient?
* What conformance vectors are required?
* What evaluator tests prove decay, freshness, and invalid references?
* Which downstream runtime decisions may consume this result?
