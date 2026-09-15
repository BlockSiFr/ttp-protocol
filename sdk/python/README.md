# BlockSiFr Python SDK (`sdk/python`)

Minimal Python SDK for `POST /re/authorize` integrations.

## What this SDK gives you
- `authorize(request: AuthorizeRequest) -> AuthorizeResponse`
- Dataclass request/response models
- Decision and decision-mode enums

## Decision contract
- Outcomes: `PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`
- Modes: `FULL`, `CONSTRAINED`, `REQUIRES_REATTESTATION`, `REQUIRES_HUMAN_APPROVAL`, `FAILED_CLOSED`

## Usage

```python
from sdk.python import authorize, AuthorizeRequest, Principal, Resource, AuthorityGrant

resp = authorize(AuthorizeRequest(
    base_url='http://127.0.0.1:8080',
    requestId='py-req-1',
    principal=Principal(id='py-agent', type='service-agent'),
    action='pipeline.deploy',
    resource=Resource(type='environment', id='prod'),
    context={'trustScore': 0.91, 'environment': 'dev'},
    authorityGrant=AuthorityGrant(
        grantId='grant-local-001',
        expiresAt='2030-01-01T00:00:00Z',
        scope=['pipeline.deploy:prod']
    )
))

print(resp.decision.value, resp.mode.value, resp.receipt.receiptId)
```

## Integration guidance
- Enforce both `decision` and `mode`.
- Treat missing receipt as deny.
- Persist receipt integrity values for audit traceability.

## AGT bridge (`agt.py`)

PCTR <-> [Microsoft AGT](https://github.com/microsoft/agent-governance-toolkit) for
Python, mirroring `packages/pctr/src/agt.mjs`. AGT is Python-first, so this is where
most real integrations sit.

```python
from agt import agt_claims, normalize_agt_event, to_trust_evidence, to_agt_trust_score

# 1. AGT's runtime events -> canonical PCTR events (None when unrecognised)
event = normalize_agt_event(agt_policy_decision)

# 2. What PCTR hands AGT's policy engine, under input.ttp
claims = agt_claims(ttp_score=0.9178, action="payments.transfer", issuer_count=2,
                    agents=["spiffe://blocksifr.com/ns/prod/sa/finance"])

# 3. Evidence back, so AGT decides better next time
evidence = to_trust_evidence(receipt)
```

**AGT trust is 0-1**, banded untrusted 0.0 / provisional 0.30 / trusted 0.60 /
verified 0.85 — `to_agt_trust_score()` returns AGT's `TrustScore {overall, dimensions,
tier}`. The 0-1000 integer scale (`to_agt_score()`) is only for downstream consumers that
ask for it.

## Trust aggregation (`aggregate.py`)

The normative algorithm from
[`protocol/aggregation-spec.md`](../../protocol/aggregation-spec.md) **v1.1** — time
decay, negative-signal amplification, and issuer weight capping that redistributes to the
uncapped issuers. The same eleven test vectors run against both bindings.

```python
from aggregate import aggregate_trust, score_label

result = aggregate_trust(receipts, current_time_ms)
print(result["score"], score_label(result["score"]))
```

An empty receipt window returns `INSUFFICIENT_TRUST_DATA` with `score: None` — absent
evidence is never a score.

The two implementations are held in step by `scripts/check-agt-parity.mjs`, which runs
both over the same corpus in CI — AGT bridge and trust aggregation, 59 checks — and fails
on any divergence.

Tests: `python3 -m unittest discover -s sdk/python -p 'test_*.py'`
