# TTP Protocol Test Vectors

This directory contains test vectors for verifying conformant implementations of the Trust Transfer Protocol.

## Purpose

Test vectors allow independent implementations to verify that they produce identical results for the same inputs. Conformant implementations MUST produce matching outputs for all vectors marked as normative.

## Files

| File | Contents |
|------|----------|
| `receipt-vectors.json` | Valid and invalid receipts with expected validation outcomes |
| `aggregation-vectors.json` | Receipt sets with expected aggregate scores |
| `token-vectors.json` | Valid and invalid tokens with expected verification outcomes |
| `keys.json` | Ed25519 keypairs used to produce the vectors (test use only) |

## Keys

The keypairs in `keys.json` are for test use only. Never use them in production.

- `issuer-test-key-01`: Signs receipts in these vectors
- `authority-test-key-01`: Signs tokens in these vectors

## Using These Vectors

### Node.js

```typescript
import { validateReceipt } from "./receipt-validator"
import vectors from "./receipt-vectors.json"

for (const vector of vectors.cases) {
  const result = await validateReceipt(vector.input)
  if (result.valid !== vector.expected.valid) {
    throw new Error(`Vector '${vector.id}' failed: expected ${vector.expected.valid}, got ${result.valid}`)
  }
  if (vector.expected.error && result.error !== vector.expected.error) {
    throw new Error(`Vector '${vector.id}': expected error '${vector.expected.error}', got '${result.error}'`)
  }
}
```

### Go

```go
for _, vector := range vectors.Cases {
    result := ValidateReceipt(vector.Input)
    if result.Valid != vector.Expected.Valid {
        t.Errorf("vector %s failed", vector.ID)
    }
}
```
