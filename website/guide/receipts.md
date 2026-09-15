# Execution Receipts

Every decision produces a signed, hash-chained `ExecutionReceipt` — evidence,
not a log line. It records what was decided, the trust state behind it, and the
cryptographic basis to verify it later.

<p align="center">
  <img src="/diagrams/execution-receipt.svg" alt="Execution receipt card" style="width:660px;max-width:100%;border:1px solid #1e2430;border-radius:12px" />
</p>

## Fields

| Field | Meaning |
| --- | --- |
| `subject` | The actor that was evaluated. |
| `action` / `resource` | What was attempted, and against what. |
| `decision` | `allow` · `throttle` · `step-up` · `escalate` · `deny`. |
| `trustScoreAtDecision` | Effective trust at the moment of decision. |
| `authorityGrantRef` | The grant relied upon. |
| `attestationRef` | The evidence that supported trust. |
| `timestamp` | When the decision was made. |
| `signature` | Cryptographic signature over the receipt. |
| `chainHash` | Links this receipt to the prior one — tamper-evident. |

::: receipt RECEIPT
A receipt is verifiable independently of the system that produced it. Given the
public key and the chain, anyone can confirm the decision was made as recorded.
:::
