<!--
  Trust Transfer Protocol — Pull Request
  Keep the protocol precise. Describe impact at each layer it touches.
-->

## Summary

<!-- What does this change do, and why? One short paragraph. -->

## Protocol Layer Impact

<!-- Does this change the grammar, semantics, schemas, or trust model?
     If it changes the spec, link the RFC. Write "none" if not applicable. -->

- [ ] Changes protocol grammar / `.ttp` language
- [ ] Changes a public schema (AuthorityGrant / Attestation / ExecutionReceipt / …)
- [ ] Changes trust scoring, decay, delegation, or proof semantics
- [ ] No protocol-surface change

## Runtime Enforcement Impact

<!-- How does this affect the runtime authority gate or decision outcomes
     (allow / throttle / step-up / escalate / deny)? -->

## Receipt / Evidence Impact

<!-- Does this change what is recorded in an ExecutionReceipt, how it is
     signed, or how the receipt chain is verified? -->

## Tests

<!-- What did you add or run? Paste the relevant `npm test` output. -->

```text
```

## Screenshots or Diagrams

<!-- For visual or asset changes, attach a render. -->

## Checklist

- [ ] `npm test` passes
- [ ] Docs / examples updated (if behavior changed)
- [ ] An RFC is linked for any protocol-surface change
- [ ] No `cleartext-dev` assumptions introduced into production paths
- [ ] Commits are signed off and scoped
