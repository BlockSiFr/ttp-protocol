# RFC 0001: Trust Routing in TTP

## Decision

Adopt Trust Routing as a first-class execution authority subsystem in TTP.

## Why

Behavioral trust must be evaluated at execution time against route-valid authority paths, not static identity alone.

## Consequences

- `/route/resolve` and `/re/authorize` become core runtime APIs.
- Execution receipts become required compliance artifacts for every decision.
- Binding hash is mandatory for replay-safe execution authorization.
