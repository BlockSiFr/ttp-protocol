# Specifications

This directory defines canonical protocol and governance contracts.

## Core specifications
- `ttp.md` — Trust Expression Layer.
- `scim-re.md` — Runtime Execution Governance Protocol.
- `rap.md` — Runtime Authority Protocol.
- `scim-re-authorize-api.md` — `POST /re/authorize` API contract.
- `execution-receipt.md` — immutable decision record format.
- `trust-decay.md` — trust aging and recovery semantics.
- `runtime-authority-prompt.md` — mythos-aware runtime authority behavior contract.

## Normative baseline
All governed actions require runtime authorization (`POST /re/authorize`) and produce an `ExecutionReceipt`. Trust is evaluated before execution, and no implicit trust persists after provisioning.
