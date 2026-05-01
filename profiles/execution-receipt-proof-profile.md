# Execution Receipt Proof Profile

## Purpose

The execution receipt is the tamper-evident record that proves a governed action was authorized, executed, and bounded to a specific tenant and environment. TTP defines what proof material contributes to receipt integrity.

## Receipt Hash Inputs

The `receiptHash` MUST be computed over:

```
SHA-256(
  tenantId +
  environmentId +
  missionId +
  agentId +
  subjectId +
  action +
  resource +
  decision +
  timestamp +
  priorReceiptHash +        (or "GENESIS" for first receipt)
  verifiedTrustEvidenceRef  (or "" if not present)
)
```

Changing any of these fields invalidates the receipt hash. This is intentional — it means the receipt is immutable after issuance.

## Chain Hash

The `chainHash` extends the receipt chain:

```
chainHash = SHA-256(priorChainHash + receiptHash)
```

## Tenant Binding Guarantee

Because `tenantId` is included in the hash inputs:
- A receipt created for `tenant_a` is cryptographically bound to `tenant_a`
- Moving the receipt to `tenant_b`'s chain breaks verification
- Cross-tenant receipt chains require a `CrossTenantDelegation` proof attached

## External Agent Receipts

When the action was taken by an external agent, the receipt MUST additionally include:
- `externalAgentId`
- `platformId`
- `platformType`
- `platformEvidenceRef`
- `interceptionMode`

## Verification Failures

| Failure | Verification result |
|---|---|
| `tenantId` removed from receipt | Hash mismatch → INVALID |
| `environmentId` changed | Hash mismatch → INVALID |
| Prior receipt belongs to different tenant | Chain break → INVALID |
| VerifiedTrust evidence ref changed | Hash mismatch → INVALID |
| `externalAgentId` added/removed post-issuance | Hash mismatch → INVALID |
