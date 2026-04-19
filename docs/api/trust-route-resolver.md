# Trust Route Resolver API

`POST /route/resolve`

Purpose: resolve a deterministic authority path for an `ExecutionRequest`.

Resolver returns:
- selected path,
- decision,
- trust score and zone,
- reason codes,
- evaluation tier and latency.

Used by runtime gate (`/re/authorize`) as the pre-execution decision function.
