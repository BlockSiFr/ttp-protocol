# Runtime Authority

Trust is checked at a **runtime authority gate** before an action runs. The gate
consumes a trust proof, an authority grant, and the current decay state, then
emits a decision and a signed receipt.

<p align="center">
  <img src="/diagrams/runtime-authority-flow.svg" alt="Runtime authority flow" style="width:100%;border:1px solid #1e2430;border-radius:12px" />
</p>

## Decision outcomes

<p align="center">
  <img src="/diagrams/decision-matrix.svg" alt="allow, throttle, step-up, escalate, deny" style="width:100%;border:1px solid #1e2430;border-radius:12px" />
</p>

| Outcome | Meaning |
| --- | --- |
| `allow` | Trust clears the threshold; the action executes. |
| `throttle` | Marginal trust; proceed under rate or scope limits. |
| `step-up` | Fresh attestation required to continue. |
| `escalate` | Route to a human or higher authority for review. |
| `deny` | Trust below floor; the action is blocked. |

::: deny DENY
The gate is **fail-closed**. If trust cannot be established, the default outcome
is `deny` — never implicit allow.
:::

::: step-up STEP-UP
A `step-up` is not a failure. It asks the actor to present fresh evidence (a new
attestation) and re-enter the gate.
:::

> TTP establishes the trust context. RAP, Execution Exchange, API gateways, and
> CI gates enforce the decision. See the
> [commercial boundary](https://github.com/BlockSiFr/ttp-protocol/blob/main/COMMERCIAL_BOUNDARY.md).
