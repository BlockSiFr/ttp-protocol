# ExecutionReceipt Specification

## Purpose
ExecutionReceipt is the immutable decision artifact for runtime governance and audit.

## Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.

## Required top-level sections
- `schemaVersion`
- `receiptId`
- `issuedAt`
- `execution`
- `decision`
- `trust`
- `risk`
- `cost`
- `compliance`
- `evidence`
- `integrity`

## Decision rules
- Outcome MUST be one of: `PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`.
- Constrained operation MUST use `outcome=PERMIT` and `mode=CONSTRAINED`.

## Integrity rules
- `integrity.hash` MUST be derived from canonical receipt content.
- `integrity.chainHash` SHOULD reference prior receipt hash to create tamper-evident linkage.
- If signing is unavailable, receipt hash MUST still be generated for accountability.
