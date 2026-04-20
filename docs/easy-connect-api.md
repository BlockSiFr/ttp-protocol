# Easy Connect API

For new integrators, start with one call:

`POST /v1/connect`

This endpoint returns a ready-to-use integration profile with:
- authority endpoints,
- a sample `POST /re/authorize` request,
- curl snippets for authorize + attest.

## Minimal request

```json
{
  "integrationName": "my-first-integration",
  "subject": "wi://ttp/github/security-review-agent",
  "repo": "blocksifrdev/ttp-protocol"
}
```

## Why it exists

Most teams struggle with first integration wiring. `/v1/connect` is an easy bootstrap path so teams can connect to TTP in minutes and then move to production hardening.

## Next step

Use `quickstart.sampleAuthorizeRequest` from the connect response and submit it to `POST /re/authorize`.

Enforce decisions as:
- `PERMIT`: execute
- `STEP_UP` / `ESCALATE`: require approval and reauthorize
- `DENY`: block

Always persist and verify `receiptId`.
