# Performance Methodology

This document defines a repeatable baseline for TTP performance claims. It is not a benchmark result by itself; use it to produce comparable data before launch claims are made.

## Scope

Measure the paths that affect adoption and runtime confidence:

- `.ttp` parser check latency
- trust decay evaluation latency
- trust route resolution latency
- token verification latency
- receipt creation latency
- local demo end-to-end latency

## Environment

Record:

- CPU model and core count
- memory
- operating system
- Node.js version
- package version or commit SHA
- whether tests run cold or warm

## Baseline Commands

```bash
npm test
npm run check:examples
npm run demo
npm pack --dry-run
```

For service-style paths, run a small scripted loop against the reference implementation and report p50, p95, p99, error rate, and sample size.

## Reporting Rules

- Do not publish a single latency number without sample size.
- Separate parser, verifier, resolver, and receipt paths.
- Report whether crypto verification is enabled or `cleartext-dev` is used.
- Include failure-path timings for expired, revoked, insufficient-score, and domain-mismatch decisions.
- Include package size and unpacked size from `npm pack --dry-run`.

## Launch Baseline Checklist

- [ ] CLI examples checked.
- [ ] Unit and integration tests passed.
- [ ] Package contents reviewed.
- [ ] Local demo result captured.
- [ ] Reference service smoke test captured.
- [ ] p50/p95/p99 recorded for at least one verifier path.
- [ ] Caveats documented for pre-release status.
