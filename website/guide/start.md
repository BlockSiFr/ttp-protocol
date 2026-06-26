# Overview

The **Trust Transfer Protocol (TTP)** is the protocol layer for agent trust.
Identity proves *who* is acting. Authorization defines *what* was assigned. TTP
establishes whether the actor is **trustworthy enough for this action, right
now** — before any downstream authority or execution decision is made.

<p align="center">
  <img src="/diagrams/trust-gap.svg" alt="Identity vs Authorization vs TTP" style="width:100%;border:1px solid #1e2430;border-radius:12px" />
</p>

## Quickstart

```bash
git clone https://github.com/BlockSiFr/ttp-protocol.git
cd ttp-protocol
npm install
npm test

# evaluate the reference examples
npm run ttp -- check examples/01-basic-agent.ttp
npm run ttp -- eval  examples/02-trust-decay.ttp --subject agent:invoice_reviewer --at now
npm run demo
```

- `check` validates a `.ttp` file.
- `eval` evaluates a subject's trust at a point in time.
- `demo` prints reference decisions, trust scores, and `ExecutionReceipt` ids
  for local, non-production scenarios.

::: receipt NEXT
Continue to [Protocol Concepts](/guide/concepts) to learn the primitives, then
[Runtime Authority](/guide/runtime) for how decisions are made.
:::
