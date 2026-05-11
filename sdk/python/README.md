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
