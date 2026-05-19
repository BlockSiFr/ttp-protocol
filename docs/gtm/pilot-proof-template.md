# Pilot Proof Template

Use this template to turn a pilot into a reusable proof point without exposing sensitive implementation details.

## Summary

- Organization type:
- Protected action:
- Runtime boundary:
- TTP components used:
- Pilot duration:

## Before TTP

- How was identity established?
- How was action authority decided?
- What evidence existed after execution?
- What failure or audit gap motivated the pilot?

## TTP Integration

- Subject:
- Action:
- Resource:
- Domain:
- Minimum score:
- Issuers:
- Verification location:
- Receipt destination:

## Results

| Result | Evidence |
| --- | --- |
| First gated workflow completed | |
| `PERMIT` path validated | |
| `DENY` path validated | |
| `STEP_UP` or `CONSTRAIN` path validated | |
| Receipt captured and reviewed | |
| Stale or insufficient trust behavior tested | |

## Metrics

- Time to first gated workflow:
- Decision count:
- Decision mix:
- Receipt completeness rate:
- Stale trust rejection count:
- Issues found:
- Follow-up integrations:

## Reusable Quote

Write a one-sentence outcome that does not require naming the customer:

> A platform team used TTP to gate [protected action] with current trust and receipt proof before execution.

## Redaction Checklist

- Remove tenant names, hostnames, customer data, secrets, and internal incident details.
- Replace actor identifiers with role-based examples.
- Preserve architecture shape, decision outcomes, and measured adoption friction.
