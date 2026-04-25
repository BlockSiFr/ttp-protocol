# BlockSiFr Agent Trust Infrastructure

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Positioning](https://img.shields.io/badge/focus-trust--before--execution-purple.svg)](#blocksifr-agent-trust-infrastructure)

Trust-before-execution infrastructure for enterprise agent systems.

**Authorship:** Trust Transfer Protocol (TTP) is authored by **Maurice Witten**, Founder & Chief Architect of **BlockSiFr**.

## Core definitions

- **TTP** = **Trust Expression Layer**
- **SCIM-RE** = **Runtime Execution Governance Protocol**
- **RAP** = **Runtime Authority Protocol**
- **FrontDesk** = **Runtime Authority Gate**

## Critical boundary

> **TTP does not enforce execution.**
>
> TTP expresses trust context and intent signals.
> Runtime authority is evaluated and enforced by SCIM-RE / RAP controls at the FrontDesk gate.

## Execution flow

```text
Intent → TTP → SCIM-RE/RAP → FrontDesk → Execution → ExecutionReceipt
```

## Enterprise posture

This repository is positioned as:

- **BlockSiFr Agent Trust Infrastructure**
- **Trust-before-execution**
- **Runtime authority**
- **Cryptographic accountability**
- **Enterprise-ready integration model**

## Repository layout

- `specs/` — protocol and operational specs for TTP, SCIM-RE, RAP, trust decay, and receipts.
- `sdk/node` — Node SDK for `/re/authorize` integration.
- `sdk/python` — Python SDK for `/re/authorize` integration.
- `reference-implementations/runtime-authority-gate` — minimal local FrontDesk service.
- `examples/` — governed CI/CD, API gateway, and tool-call gate patterns.

## Quick start

1. Read `specs/ttp.md` and `specs/scim-re.md`.
2. Stand up the local reference gate in `reference-implementations/runtime-authority-gate`.
3. Wire callers through `POST /re/authorize` using the Node or Python SDK.
4. Persist and verify each generated `ExecutionReceipt` for auditability.

## Non-goals

This repository does **not** position:

- TTP as a standalone runtime.
- TTP as an independent execution authorizer.
- Blockchain as a required runtime dependency.

