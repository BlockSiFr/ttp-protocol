# TTP Go verification kernel (bounded preview)

This module provides an independent **Go** verification path for Ed25519-signed PCTR execution authorities and receipts. It does **not** create authority, verify an identity provider, validate trust scores, enforce a live effect, or provide BlockSiFr Control's managed runtime. It is not production certified.

## Verification properties

- Uses independently provisioned trusted signer public keys, **not a PEM shipped inside an authority or receipt**, and checks cryptographic signer-derived key identity against the claimed ID.
- Recomputes PCTR's sorted-key, six-decimal JSON binding hash, verifies Ed25519 signature, and checks principal, action, target, bound parameters, issuance and expiration.
- Rejects missing replay storage and re-spent nonces; the provided in-memory replay store is a **test/example**, not multi-node production-safe.
- Rejects unsigned/altered receipts, untrusted issuers and independently supplied mismatched prior receipt hashes.
- Rejects any unbound execution parameter unless a future signed constraints policy explicitly defines authorized nonmaterial parameters. The JavaScript engine now makes the equivalent conservative check.

## Test

From `sdk/go`:

```sh
go test -race ./...
```

This is a bounded implementation, **not independently certified interoperability**. Before production, run exact Node.js-issued wire-format test vectors, fuzz hostile JSON including duplicate keys and ambiguous Unicode/float representations, provision transactional nonce storage, anchor signing keys in KMS/HSM or validated trust registry, verify issuer revocation, and review tenant scope and authorization policies.

**Protocol licensing:** Apache-2.0 repository scope. Patent and sublicensing rights require the separate `docs/PATENT_ALIGNMENT_REVIEW.md` legal acceptance.
