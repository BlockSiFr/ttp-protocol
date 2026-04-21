# Trust Routing Threat Model

## Key threats

- Binding replay/reuse with altered parameters.
- Revoked identity trying stale grants.
- Delegation chain abuse through hop overflow.
- Proof engine outage leading to accidental allow.
- Ambiguous issuer routes producing inconsistent outcomes.

## Mitigations

- Mandatory execution binding hash check.
- Revocation checks on every decision.
- Max-hop and delegation constraints.
- Fail-closed on resolver/proof unavailability.
- Deterministic strategy precedence and reason codes.
- Signed, chain-hashed execution receipts.
