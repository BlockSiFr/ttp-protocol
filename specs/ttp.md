# TTP Specification (Trust Expression Layer)

## Purpose
TTP defines the trust expression format used to carry intent, context, and risk signals into runtime governance.

## Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.

## What TTP does
- Captures request intent (`who`, `what`, `where`, `why now`).
- Carries environment and control metadata.
- Binds request IDs for downstream accountability.

## What TTP does not do
- Does not execute protected actions.
- Does not independently grant runtime authority.

## Required handoff
TTP payloads MUST be passed to SCIM-RE and RAP controls for runtime authority evaluation at FrontDesk.
