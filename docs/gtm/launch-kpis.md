# Launch KPIs

These metrics define launch health for the open protocol repo and early adoption motion.

| KPI | Definition | Why it matters |
| --- | --- | --- |
| Quickstart activation rate | Percentage of new evaluators who run `npm run demo` or the equivalent first trust gate. | Measures whether the first value moment is reachable. |
| Time to first gated workflow | Time from repo checkout to a non-demo protected action using TTP. | Measures adoption friction. |
| Protected action coverage | Number of real action boundaries gated by TTP in pilots. | Measures movement from evaluation to operational value. |
| Receipt completeness rate | Percentage of decisions producing reviewable receipts with actor, action, resource, score, threshold, reason, and chain hash. | Measures auditability. |
| SDK integration starts | Number of agent, API, or CI integrations using a TTP SDK or verifier path. | Measures developer adoption. |
| External contribution rate | Issues, PRs, examples, or integration notes from outside maintainers. | Measures ecosystem pull. |
| Step-up usefulness | Number of workflows where `STEP_UP` or `CONSTRAIN` replaces unconditional permit or hard deny. | Measures practical governance nuance. |

## Launch Targets

Initial public launch targets should be conservative:

- 5 technical evaluators complete the local demo.
- 2 pilots gate a real protected action.
- 1 partner or internal integration publishes a receipt sample.
- 1 anonymized case study or implementation note is ready for public review.
- CI, packaging, and security status are green for the tagged pre-release.

## Reporting Cadence

Review these metrics weekly during launch and after every tagged pre-release. Keep the public repo focused on protocol adoption and interoperability; track commercial funnel metrics separately.
