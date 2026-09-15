# Security

TTP is a protocol draft and reference implementation.

::: deny DO NOT
Do not use `cleartext-dev` proof mode in production. It performs no
cryptographic verification and exists only for local development.
:::

## Production requirements

Production trust establishment and downstream enforcement require:

- trusted issuer registry
- signed claims and replay protection
- clock integrity and key rotation
- tenant isolation
- **fail-closed** downstream enforcement
- receipt signing and audit retention
- attestation freshness and evidence integrity

## Posture

| Property | Status |
| --- | --- |
| Spec | draft v1.0 |
| Reference evaluator | active |
| Production enforcement | commercial (Execution Exchange) |

Report vulnerabilities per
[SECURITY.md](https://github.com/BlockSiFr/ttp-protocol/blob/main/SECURITY.md).
The full threat model is in
[THREAT_MODEL.md](https://github.com/BlockSiFr/ttp-protocol/blob/main/THREAT_MODEL.md).
