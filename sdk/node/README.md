# BlockSiFr Node SDK (`sdk/node`)

Minimal integration SDK for `POST /re/authorize`.

## What this SDK gives you
- `authorize(request)` helper for runtime authorization calls.
- Typed model hints via JSDoc in `models.js`.
- Enums for decision and decision mode handling.

## Decision contract
- Outcomes: `PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`
- Modes: `FULL`, `CONSTRAINED`, `REQUIRES_REATTESTATION`, `REQUIRES_HUMAN_APPROVAL`, `FAILED_CLOSED`

## Usage

```js
import { authorize, Decision } from './index.js';

const result = await authorize({
  baseUrl: 'http://localhost:8080',
  requestId: 'req-1',
  principal: { id: 'agent-1', type: 'service-agent' },
  action: 'pipeline.deploy',
  resource: { type: 'environment', id: 'prod' },
  context: { trustScore: 0.9, environment: 'dev' },
  authorityGrant: {
    grantId: 'grant-local-001',
    expiresAt: '2030-01-01T00:00:00Z',
    scope: ['pipeline.deploy:prod']
  }
});

if (result.decision === Decision.PERMIT && result.mode === 'FULL') {
  // execute
}
```

## Integration guidance
- Always enforce **both** `decision` and `mode`.
- Treat missing `receipt` / `receiptId` as deny.
- Persist `receiptId` and receipt integrity fields with execution logs.
