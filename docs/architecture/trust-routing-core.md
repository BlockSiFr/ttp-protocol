# Trust Routing Core

Trust Routing is the execution-path resolver inside TTP. It computes whether a request has a valid authority path **before** execution.

## Runtime invariant

`execution request -> route resolution -> authority verification -> decision -> execution (if permitted) -> receipt -> trust update`

## Route-resolution algorithm

1. Discover issuer candidates (`behavioral`, `supervisor`, `domain`, `workload`).
2. Build candidate paths `issuer -> proof -> subject -> action -> resource`.
3. Evaluate each path for trust decay, freshness, revocation, delegation, hops, grant validity, and environment fit.
4. Validate execution binding hash and params hash.
5. Apply precedence (`require_all`, `require_any`, `strongest_path_wins`, `freshest_path_wins`, `supervisor_override`, `domain_hard_deny_overrides_all`).
6. Select winning route or fail closed.

## Execution binding

Binding hash is mandatory and computed as:

`sha256(subject + action + resource + paramsHash + timestampBucket)`

A mismatch always returns `DENY`.

## Trust zones

- `active` (0.85-1.00)
- `degraded` (0.65-0.85)
- `warning` (0.40-0.65)
- `critical` (0.00-0.40)

## Fail-closed rules

Deny on resolver outage, proof outage, binding mismatch, stale attestation, revocation, missing grant, scope mismatch, env mismatch, delegation violation, hop overflow, or route ambiguity.
