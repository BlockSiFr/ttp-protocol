# Persistent Storage Guidance

TTP reference services can run locally with file-backed state, but production-like deployments need durable storage so trust evidence, issued proofs, and receipt history survive restarts.

## Minimum Requirements

- Store issuer registry, agent registry, trust state, receipts, and revocation data on durable storage.
- Back up state on a schedule aligned to receipt retention requirements.
- Use append-only receipt storage or immutable object retention where available.
- Encrypt state at rest and restrict access to the trust authority service identity.
- Keep state scoped by tenant or deployment boundary; do not mix unrelated trust domains.
- Monitor storage growth, write failures, backup failures, and receipt-chain verification errors.

## Reference Deployment Pattern

For a single-node reference environment:

1. Mount a persistent volume at the service state directory.
2. Configure daily backups for registries and receipts.
3. Run a receipt-chain verification job after backup completion.
4. Rotate signing keys using a documented key ID and retention plan.
5. Keep old public verification keys available for the full receipt retention period.

For managed or high-availability deployments, replace local file state with a transactional database for mutable registries and immutable object storage for receipt artifacts.

## Fail-Closed Rules

The authority service must fail closed when:

- state cannot be read,
- receipt persistence fails,
- revocation state is unavailable,
- the signer cannot access current key material,
- receipt-chain verification detects an unexpected hash discontinuity.

These failures should produce an explicit deny/error receipt when the receipt subsystem is still available.
