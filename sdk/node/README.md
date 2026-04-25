# BlockSiFr Node SDK

Minimal Node SDK for SCIM-RE `POST /re/authorize`.

## API
- `authorize(request)`
- Typed request/response models in `models.js` (JSDoc typedefs).
- Decision enum: `PERMIT`, `DENY`, `STEP_UP`, `ESCALATE`.
- Decision mode enum: `FULL`, `CONSTRAINED`, `REQUIRES_REATTESTATION`, `REQUIRES_HUMAN_APPROVAL`, `FAILED_CLOSED`.

## Usage
```js
import { authorize, Decision } from './index.js';

const result = await authorize({
  baseUrl: 'http://localhost:8080',
  requestId: 'req-1',
  principal: { id: 'agent-1', type: 'service-agent' },
  action: 'github.workflow.run',
  resource: { type: 'repo', id: 'org/project' },
  context: { trustScore: 0.9 }
});

if (result.decision === Decision.PERMIT) {
  // proceed
}
```
