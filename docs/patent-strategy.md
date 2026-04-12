# TTP Intellectual Property and Patent Strategy

## Open Source Commitment

TTP is released under the Apache License 2.0 and is intended to remain a permanently open protocol. BlockSiFr's commercial interests are in managed services and enterprise tooling built on top of the protocol — not in controlling the protocol itself.

---

## What is Patented (or Patent-Pending)

BlockSiFr has filed patent applications covering specific implementations of:

1. **Issuer weight normalization in multi-source behavioral trust aggregation** — the specific algorithm for capping per-issuer contribution weights to prevent single-source domination.

2. **Negative signal amplification in trust scoring** — the approach of applying differential weighting to below-threshold behavioral scores to prioritize safety signals in aggregation.

These patents, if granted, cover specific implementations of these methods.

---

## What This Means for You

### You CAN, royalty-free:

- **Implement the TTP protocol** as described in the specification.
- **Use the reference aggregation algorithm** from [protocol/aggregation-spec.md](aggregation-spec.md) in any product, commercial or otherwise.
- **Build competing Trust Authority services**, SDKs, issuers, or verifiers that conform to the protocol.
- **Deploy TTP** for internal enterprise use without paying BlockSiFr anything.
- **Fork and modify** the reference implementations under Apache 2.0.

The Apache 2.0 license's express patent grant covers any patents BlockSiFr holds that are **necessarily infringed** by implementing the protocol specification as published in this repository.

In plain language: **if you implement what's in the spec, you're covered.**

### What is NOT covered:

- Substantially different aggregation mechanisms that happen to be described in the same patent claims. But implementing the spec as written is covered.
- Modifications that add patented capabilities not present in the open specification.

---

## BlockSiFr's Commercial Model

BlockSiFr earns revenue through:

1. **Managed Trust Authority** — hosted, SLA-backed Trust Authority infrastructure for enterprises that don't want to self-host.

2. **Enterprise features** — audit logging, compliance reporting, multi-tenancy, advanced threat detection.

3. **Professional services** — implementation support, custom issuer development, security assessments.

None of these commercial offerings gate access to the open protocol. The protocol remains open, and alternative Trust Authority implementations are possible and encouraged.

---

## Long-Term IP Commitment

BlockSiFr commits that:

1. The core TTP specification will never be made patent-encumbered in a way that blocks royalty-free implementation.

2. If TTP is submitted to a standards body (IETF, W3C, etc.), BlockSiFr will provide necessary patent grants as required by that body's IP policy.

3. Any protocol change that introduces a new patent-pending mechanism will be clearly flagged in the RFC process, and the patent grant will be updated before the change is accepted into the normative specification.

---

## Questions

For questions about IP or licensing, contact: hello@blocksifr.com
