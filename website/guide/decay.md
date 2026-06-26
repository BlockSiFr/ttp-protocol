# Trust Decay

Trust is a function of time and evidence. Without fresh attestation it weakens;
a new attestation recharges it.

<p align="center">
  <img src="/diagrams/trust-decay-curve.svg" alt="Trust decay and attestation recharge" style="width:100%;border:1px solid #1e2430;border-radius:12px" />
</p>

## Bands

| Band | Range | Posture |
| --- | --- | --- |
| Active | `0.85–1.00` | Full reliance |
| Degraded | `0.65–0.85` | Reliance with watch |
| Warning | `0.40–0.65` | Step-up before sensitive actions |
| Critical | `0.00–0.40` | Deny by default |

```ttp
trust "invoice_agent" {
  subject = agent:invoice-bot
  score   = 0.91
  decay   = exponential(halflife = 6h)   # trust halves every 6h without evidence
}
```

::: decay DECAY
Decay is declarative. Choose a model (`exponential`, `linear`, `stepped`) and a
rate; the evaluator applies it at proof time against the elapsed interval.
:::

::: attestation ATTESTATION
A verified attestation adds a recharge delta, lifting the effective score back
toward the active band.
:::
