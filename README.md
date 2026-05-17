# Trust Transfer Protocol

TTP is the trust signal layer for BlockSiFr runtime legitimacy infrastructure.

TTP routes operational trust across existing digital infrastructure by preserving trust propagation, trust inheritance, trust continuity, trust decay, attestation exchange, and runtime legitimacy transfer.

## Runtime Surface

This package currently exposes the minimal primitives used by Runtime Authority:

- `apply_decay` from `@blocksifrdev/ttp-protocol/decay`
- `verify_attestation` from `@blocksifrdev/ttp-protocol/attestation`

These primitives support authority-before-execution decisions without introducing shell execution, crypto token, or blockchain assumptions.

## Infrastructure Alignment

| Internet Infrastructure | Autonomous Infrastructure |
|---|---|
| TCP/IP routes packets | TTP routes trust |
| DNS resolves addresses | SCIM-RE resolves execution identity |
| TLS secures transport | RAP secures legitimacy |
| APIs expose capability | FrontDesk governs execution |
| SIEM observes activity | CortexTrace proves lineage |
