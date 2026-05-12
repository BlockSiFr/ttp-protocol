# TTP MVP

The first usable TTP implementation should be small, testable, and buildable in 30 days. It should prove the core protocol loop without claiming production security.

## MVP Includes

- Parse `.ttp` files.
- Validate core syntax.
- Build an AST/object model.
- Evaluate static trust score.
- Evaluate trust decay over time.
- Evaluate threshold condition.
- Output JSON evaluation result.
- Support `cleartext-dev` proof mode.
- Include at least three examples.
- Include CLI commands.

## MVP Excludes

- Production ZKP.
- Distributed trust network.
- Blockchain anchoring.
- Full policy marketplace.
- Complete FrontDesk integration.
- Cross-enterprise trust routing.
- Production issuer registry.
- Production runtime enforcement.

## CLI Commands

```bash
npm run ttp -- check examples/01-basic-agent.ttp
npm run ttp -- eval examples/02-trust-decay.ttp --subject agent:invoice_reviewer --at now
npm run ttp -- version
```

## Acceptance Criteria

- `ttp check examples/01-basic-agent.ttp` succeeds.
- `ttp eval examples/02-trust-decay.ttp --subject agent:invoice_reviewer --at now` returns JSON.
- Tests pass in CI.
- Invalid syntax returns useful errors.
- Expired trust returns failed evaluation.
- Decayed trust below threshold returns failed evaluation.
- Threshold met returns valid evaluation.

## Initial Examples

- `examples/01-basic-agent.ttp`
- `examples/02-trust-decay.ttp`
- `examples/03-threshold-proof.ttp`
- `examples/04-delegated-trust.ttp`
- `examples/05-frontdesk-authority-context.ttp`

## Buildable 30-Day Plan

| Week | Work |
| --- | --- |
| 1 | Parser, AST, syntax errors, examples. |
| 2 | Trust decay evaluator and threshold evaluator. |
| 3 | CLI, JSON output, fixture tests, CI. |
| 4 | Spec cleanup, security review, contributor docs, conformance fixtures. |
