# TTP Ecosystem Integrations

This document summarizes integration patterns with AGT-style policy systems and network-security platforms.

## AGT-Native Integration

Use TTP as the behavioral evidence layer in a closed loop:

1. AGT enforces pre-execution policy.
2. Issuers submit post-execution receipts.
3. Trust Authority recomputes trust.
4. AGT adjusts permissions using updated trust evidence.

Key patterns:
- OPA/Rego bridge (`input.ttp` claims)
- SPIFFE/SVID identity compatibility
- Canonical score adapter: `agt_trust_score = round(ttp_score * 1000)`
- AgentMesh trust attestation bridge

See full details in [integration-guide.md#part-6-agt-native-integration-recommended-priority](integration-guide.md#part-6-agt-native-integration-recommended-priority).

---

## Network Security Integrations (Zscaler / Palo Alto / Juniper)

Possible today through issuer adapters:

1. Collect network/session telemetry.
2. Map events to signed TTP receipts.
3. Aggregate with other issuers.
4. Enforce trust tokens at app/action boundaries.

Notes:
- Treat network evidence as one issuer class among multiple sources.
- Keep action-level verification at the service boundary.
- Use domain isolation for contextual trust decisions.

See full details in [integration-guide.md#part-7-network-security-platform-integrations-zscaler--palo-alto--juniper](integration-guide.md#part-7-network-security-platform-integrations-zscaler--palo-alto--juniper).
