# Runtime Authority API: `POST /v1/connect`

The easy-connect bootstrap endpoint for new integrators.

## Request

```json
{
  "integrationName": "github-protected-merge-gate",
  "subject": "wi://ttp/github/security-review-agent",
  "repo": "blocksifrdev/ttp-protocol",
  "branch": "main",
  "mode": "sync"
}
```

Required fields:
- `integrationName`
- `subject`
- `repo`

## Response

```json
{
  "status": "connected",
  "integrationId": "conn-...",
  "authority": {
    "healthz": "http://localhost:8080/healthz",
    "authorize": "http://localhost:8080/re/authorize",
    "attest": "http://localhost:8080/trust/attest",
    "receiptById": "http://localhost:8080/receipts/{receiptId}"
  },
  "quickstart": {
    "nextStep": "POST sampleAuthorizeRequest to /re/authorize and enforce based on decision + receiptId.",
    "sampleAuthorizeRequest": { "subject": "...", "action": "merge request" },
    "curl": {
      "authorize": "curl -sS -X POST .../re/authorize ...",
      "attest": "curl -sS -X POST .../trust/attest ..."
    }
  }
}
```

## Validation

Invalid payload returns HTTP `400`:

```json
{
  "error": "INVALID_CONNECT_REQUEST",
  "message": "integrationName, subject, and repo are required."
}
```
