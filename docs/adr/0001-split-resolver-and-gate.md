# ADR 0001: Split Resolver and Gate

## Context

Route resolution and final gate enforcement have different scaling and evolution patterns.

## Decision

Split into:
- Trust Route Resolver (`/route/resolve`) for path computation.
- Runtime Authority Gate (`/re/authorize`) for enforceable decision + receipt issuance.

## Rationale

- clearer separation of concerns,
- easier latency optimization,
- cleaner enterprise compliance evidence path,
- independent future deployment scaling.
