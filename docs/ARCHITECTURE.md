# TTP Architecture (Layered Model)

This repository defines the protocol layer for trust expression and transfer in the BlockSiFr Agent Trust Infrastructure.

## Layered model

### Layer 0: TTP — Trust expression and transfer
TTP defines how trust is expressed, delegated, routed, scoped, decayed, and packaged as verifiable context.

### Layer 1: SCIM-RE — Runtime identity and authority schema
SCIM-RE structures `WorkloadIdentity`, `AuthorityGrant`, `Attestation`, and `ExecutionReceipt` objects consumed by runtime governance.

### Layer 2: Runtime Authority — Enforcement engine
Runtime Authority evaluates trust context, authority state, policy, and runtime conditions to decide execution outcomes.

### Layer 3: FrontDesk — Enterprise UX and governance control plane
FrontDesk productizes enterprise operator workflows (governance lifecycle, approvals, and operational experience) around runtime authority.

### Layer 4: ExecutionReceipt corpus — Cryptographic proof layer
`ExecutionReceipt` records every runtime decision for cryptographic accountability and auditability.

---

## ASCII architecture flow

```text
Human / Copilot / Agent
        ↓
Execution Intent
        ↓
TTP Trust Transfer / Trust Route
        ↓
SCIM-RE AuthorityGrant + Attestation
        ↓
Runtime Authority Gate
        ↓
allow / throttle / step_up / escalate / deny
        ↓
ExecutionReceipt
```

---

## Boundary rule

TTP does not enforce execution. TTP supplies protocol semantics and trust context that Runtime Authority evaluates before execution.
