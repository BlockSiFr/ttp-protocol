# Failure Semantics

Trust Routing is fail-closed.

## Hard-deny conditions

- no valid route,
- binding mismatch,
- stale attestation,
- revoked subject,
- grant missing/expired,
- env/scope mismatch,
- delegation not allowed,
- hop count exceeded,
- resolver outage,
- proof outage,
- latency budget exceeded on high-risk actions.

No best-effort allow fallback.
