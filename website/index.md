---
layout: home
hero:
  name: Trust Transfer Protocol
  text: Trust-Before-Execution
  tagline: Every action must earn authority before execution. Every decision must be provable after.
  image:
    src: /trust-ring.svg
    alt: TTP trust ring
  actions:
    - theme: brand
      text: Quickstart
      link: /guide/start
    - theme: alt
      text: Protocol Concepts
      link: /guide/concepts
    - theme: alt
      text: GitHub
      link: https://github.com/BlockSiFr/ttp-protocol
features:
  - icon: ▣
    title: I'm an AI engineer
    details: Wrap agent tool calls with a trust proof — no rewrite required.
    link: /guide/integrations
  - icon: ◆
    title: I'm a security architect
    details: Fail-closed runtime gating, signed receipts, and a threat model.
    link: /guide/security
  - icon: ⬡
    title: I'm building an agent framework
    details: Embed the runtime authority gate at your execution boundary.
    link: /guide/runtime
  - icon: ▤
    title: I'm evaluating enterprise governance
    details: Where the open protocol ends and managed enforcement begins.
    link: /guide/concepts
  - icon: ✦
    title: I want to contribute
    details: From a good first issue to owning a protocol surface.
    link: /guide/contributing
---

<p align="center" style="margin-top:3rem">
  <img src="/diagrams/protocol-loop.svg" alt="Identity, Attestation, Trust Evaluation, Runtime Authority Gate, Decision, Execution Receipt" style="width:100%;max-width:1100px;border:1px solid #1e2430;border-radius:12px" />
</p>

## Protocol status

::: decay PROTOCOL v1.0 · REFERENCE EVALUATOR ACTIVE
The protocol spec and reference evaluator are available. Runtime authority
enforcement is in progress. Do not use `cleartext-dev` proof mode in production.
:::

## Quickstart

```bash
git clone https://github.com/BlockSiFr/ttp-protocol.git
cd ttp-protocol && npm install && npm test

npm run ttp -- check examples/01-basic-agent.ttp
npm run demo
```

Then read [Protocol Concepts](/guide/concepts) and the
[Runtime Authority](/guide/runtime) model.
