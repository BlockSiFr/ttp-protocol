# Protocol Security Model

TTP assumes trust is temporary, scoped, issuer-bound, and evaluated before execution.

## Trust Is Not Permanent

A valid trust claim at one time does not imply future trust. TTP documents must include expiration, and runtime systems should reject stale or missing trust context.

## Trust Decays

Trust may decline after issuance. The decay model prevents long-lived trust from being treated as equally strong over time.

The MVP supports linear decay. Future versions may add risk-event and issuer-specific decay models.

## Trust Must Be Scoped

Trust should be bound to:

- Subject.
- Domain.
- Scope.
- Action.
- Resource.
- Issuer.

Broad trust claims should be treated as higher risk.

## Trust Must Expire

`expires_at` is mandatory for meaningful trust claims. Expired trust must fail, even when the effective score would otherwise meet a threshold.

## Trust Issuers Must Be Validated

An evaluator must know which issuers are allowed for which domains and scopes. The MVP documents issuer fields but does not implement a production issuer registry.

## Proof Freshness Matters

High-risk actions may require proof freshness that is shorter than claim expiration. A six-hour trust claim may still be too old for a production deployment or payment action.

## TTP Is Not Enforcement By Itself

TTP produces trust context and evaluation results. It does not stop execution unless a runtime control point uses the result.

## Runtime Enforcement Must Fail Closed

Runtime layers should reject execution when:

- TTP parsing fails.
- The subject is unknown.
- The trust claim is missing.
- The proof is expired or stale.
- The effective score is below threshold.
- The proof mode is unsupported.
- The issuer is not accepted.

Fail-open behavior defeats the purpose of execution-time trust.
