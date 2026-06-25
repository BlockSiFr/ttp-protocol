# First Trust Proof

This directory explains the shortest local path to produce a non-production trust proof.

```bash
npm run ttp -- check examples/01-basic-agent.ttp
npm run ttp -- eval examples/02-trust-decay.ttp --subject agent:invoice_reviewer --at now
```

The actor is `agent:invoice_reviewer`. The trustworthiness question is whether the agent has enough current, evidence-backed trust to be relied on for invoice review context before downstream authority systems act.
