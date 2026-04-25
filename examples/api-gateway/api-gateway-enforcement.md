# Example: API Gateway Enforcement

Pseudo-flow for gateway middleware:

1. Incoming API request targets a governed route.
2. Gateway builds TTP context and calls `POST /re/authorize`.
3. Decision drives enforcement:
   - `PERMIT`: forward request.
   - `PERMIT` + `mode=CONSTRAINED`: strip privileged operation headers.
   - `STEP_UP` / `ESCALATE`: require stronger auth or manual review.
   - `DENY`: return 403.
4. Persist returned `ExecutionReceipt` with request logs.

Node middleware skeleton:

```js
const auth = await fetch('http://localhost:8080/re/authorize', { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json());
if (auth.decision === 'DENY') return res.status(403).json(auth.receipt);
if (auth.decision === 'PERMIT' && auth.mode === 'CONSTRAINED') req.headers['x-scope-mode'] = 'constrained';
next();
```
