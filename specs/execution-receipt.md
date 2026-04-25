# ExecutionReceipt Specification

## Purpose
ExecutionReceipt is the immutable decision artifact for runtime governance and audit.

## Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.

## Required fields
- `receiptId`
- `requestId`
- `decision`
- `reason`
- `timestamp`
- `chainHash`
- `prevChainHash` (nullable for first record)
- `evidenceDigest`

## Chain integrity
`chainHash` MUST be computed from canonical decision content and `prevChainHash` to create tamper-evident linkage.

## Audit use
Receipts MUST be retained for governance review, incident response, and compliance attestation.
