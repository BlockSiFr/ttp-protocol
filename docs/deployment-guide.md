# FrontDesk Deployment Guide (Runtime Authority Gate)

This guide explains how to deploy the Runtime Authority Gate from local development to production.

## Deployment objectives

A production-ready deployment should guarantee:
1. pre-execution authorization for all governed actions,
2. fail-closed behavior on uncertainty/unavailability,
3. durable receipt storage,
4. receipt integrity verification,
5. explicit step-up/escalation operations.

---

## Stage 1: Local development

- Run `server.mjs` directly.
- Use `RECEIPT_STORE_MODE=memory` or `file`.
- Use HMAC signing for fast local iteration.

Recommended env:

```bash
PORT=8080
RECEIPT_STORE_MODE=file
RECEIPT_STORE_FILE=.runtime-authority-receipts.json
RECEIPT_SIGNING_MODE=HMAC
RECEIPT_HMAC_SECRET=local-dev-secret
```

---

## Stage 2: Pre-production hardening

Before production rollout:

- Enable durable file path mounted on persistent volume (or implement DB adapter).
- Move from local secret to managed key material.
- Validate end-to-end decision branches (`PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`) with operational runbooks.
- Validate receipt verification path with `verify-receipt.mjs`.

---

## Stage 3: Production deployment

### 1) Runtime authority service
- Run multiple instances behind a load balancer.
- Route all governed actions through `POST /re/authorize`.
- Keep health probes on `GET /healthz`.

### 2) Storage
- Replace local file mode with managed store for retention and audit durability.
- Enforce immutable retention controls for regulated classes.

### 3) Signing and key management
- Prefer `RECEIPT_SIGNING_MODE=RS256` in production.
- Set:
  - `RECEIPT_PRIVATE_KEY_PATH`
  - `RECEIPT_PUBLIC_KEY_PATH`
- Rotate keys on a defined schedule and re-validate verification flows after rotation.

### 4) Access control
- Require strong caller authentication (workload identity/JWT/OIDC profile).
- Restrict who can invoke reauthorization/approval paths.

### 5) Operations and SLOs
Track at minimum:
- auth latency (p50/p95),
- decision distribution,
- step-up/escalation completion time,
- receipt verification success rate,
- failure-mode rate (fail-closed denies).

---

## Minimum production checklist

- [ ] All protected execution paths call `POST /re/authorize`.
- [ ] Durable receipt backend in place.
- [ ] Receipt signing enabled and verification routine tested.
- [ ] Step-up and escalation runbooks validated.
- [ ] Monitoring/alerts configured for auth latency and deny spikes.
- [ ] Open-source vs paid boundary preserved in integration docs.
