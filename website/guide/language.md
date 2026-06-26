# Language Specification

TTP is expressed as a small declarative language. A `.ttp` file declares
subjects, their trust, and the policies that gate actions.

```ttp
trust "invoice_agent" {
  subject     = agent:invoice-bot
  issuer      = trust-issuer:finance-control
  score       = 0.91
  decay       = exponential(halflife = 6h)
  scope       = [invoice.read, invoice.write]
  evidence    = [attestation:att-7b3c, receipt:rcpt-01J9F4]
}

policy "write_invoices" {
  action            = invoice.write
  require_trust     = 0.80
  on_below          = step-up
  execution_policy  = gate
  emit              = execution_receipt
}
```

The full grammar, evaluation order, and failure codes are in the
[SPECIFICATION.md](https://github.com/BlockSiFr/ttp-protocol/blob/main/SPECIFICATION.md).
Validate a file with `npm run ttp -- check <file>`.
