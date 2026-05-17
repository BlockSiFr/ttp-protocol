# Value Hypotheses

TTP should be measured by whether it improves execution governance at concrete boundaries. These hypotheses are written for pilot planning and should be converted into customer-specific success criteria.

## Hypotheses

| Hypothesis | Measurement | Expected pilot evidence |
| --- | --- | --- |
| Runtime trust gates reduce over-permissioned execution. | Count protected actions moved from static allow/deny to trust-aware decisions. | At least one sensitive action uses current trust, scope, and freshness checks. |
| Receipts reduce investigation time. | Compare time to reconstruct why a protected action executed before and after receipt capture. | Receipts show actor, action, resource, threshold, route, decision, and chain hash. |
| Step-up decisions reduce binary blocking. | Count actions that move from hard deny or unconditional permit to `STEP_UP` or `CONSTRAIN`. | Production-like workflows can require human review or added proof when trust is marginal. |
| Trust decay catches stale authority. | Count decisions affected by freshness, expiration, or decay. | A token or claim that was once valid fails after trust state ages out. |
| Protocol-level semantics improve portability. | Count integrations using the same trust concepts across agent, API, and CI boundaries. | The same subject/action/resource/threshold model applies to more than one system. |

## Pilot Outcome Statements

Use these statements when scoping a pilot:

- "We can prove why this agent action was permitted, denied, or stepped up."
- "We can reject stale or insufficient trust even when identity authentication succeeds."
- "We can add a trust gate to one protected boundary without replacing IAM, CI, API gateway, or policy tooling."
- "We can capture execution receipts that support audit and incident review."

## Metrics To Capture

| Metric | Definition |
| --- | --- |
| Protected action coverage | Number of sensitive actions evaluated through TTP. |
| Decision mix | Percentage of `PERMIT`, `DENY`, `STEP_UP`, `THROTTLE`, and `CONSTRAIN` results. |
| Stale trust rejection rate | Decisions denied or stepped up due to expiration, decay, or freshness failure. |
| Receipt completeness | Percentage of decisions with actor, action, resource, score, threshold, reason, and chain hash. |
| Time to first gated workflow | Time from repo checkout to first non-demo protected action. |

## Proof Required Before Broad Launch

- One public pilot narrative or anonymized implementation story.
- One repeatable performance baseline for parser, verifier, resolver, and receipt paths.
- One documented integration with a CI system, API gateway, or agent runtime.
- One security review pass focused on unsafe defaults and production disclaimers.
