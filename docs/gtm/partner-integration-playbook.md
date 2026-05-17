# Partner Integration Playbook

This playbook helps partners decide where TTP belongs in their product or service.

## Partner Types

| Partner | Integration point | First proof |
| --- | --- | --- |
| Agent framework | Tool-call boundary or agent runtime token flow | Agent requests trust token and passes it to a verifier before a protected tool call. |
| API gateway | Request middleware or policy plugin | Gateway checks trust token domain, score, freshness, and issuer count. |
| CI/CD platform | Protected deployment step | Deployment receives `PERMIT`, `DENY`, or `STEP_UP` before execution. |
| Identity governance vendor | Non-human identity context enrichment | TTP receipt links identity, action, trust state, and decision rationale. |
| SIEM/SOAR platform | Receipt ingestion | Receipts become searchable evidence for automated actions. |

## Integration Sequence

1. Pick one protected action with measurable risk.
2. Define subject, action, resource, domain, and threshold.
3. Decide where trust is issued and where it is verified.
4. Add verification at the action boundary.
5. Capture receipt output in the partner system.
6. Document failure behavior for stale trust, insufficient score, and unavailable trust authority.

## Partner Deliverables

- Architecture note showing the trust gate location.
- Minimal runnable example.
- Receipt sample.
- Failure semantics table.
- Version compatibility note for the TTP package or schema version used.

## Co-Sell Message

TTP helps partner products answer a security-critical question: "should this autonomous or non-human actor be allowed to attempt this action now?" The partner keeps its existing product role; TTP adds portable trust semantics and evidence at the execution boundary.
