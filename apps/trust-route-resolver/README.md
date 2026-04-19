# trust-route-resolver

Runtime authority routing service for TTP.

## Run

```bash
node apps/trust-route-resolver/src/server.mjs
```

Default port: `8090`

## Endpoints

- `POST /route/resolve`
- `POST /re/authorize`
- `POST /attestations`
- `POST /attestations/verify`
- `POST /revocations`
- `GET /revocations/{subject}`
- `GET /receipts/{receiptId}`
- `GET /receipts?subject=...&decision=...&from=...&to=...`
- `POST /utils/binding-hash`
