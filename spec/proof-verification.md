# Proof Verification
Lifecycle: canonicalize → hash verify → signature verify (if mode=signed) → evaluate failure codes.

Failure reason taxonomy: INVALID_SUBJECT, INVALID_ISSUER, EXPIRED_ATTESTATION, STALE_ATTESTATION, TRUST_BELOW_THRESHOLD, ROUTE_INVALID, DELEGATION_EXPIRED, DELEGATION_SCOPE_VIOLATION, TRANSFER_INVALID, PROOF_HASH_MISMATCH, SIGNATURE_INVALID, UNSUPPORTED_PROOF_MODE.

If proof verification fails, downstream authority must fail closed.
