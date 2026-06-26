# Examples

Runnable `.ttp` examples live in the
[`examples/`](https://github.com/BlockSiFr/ttp-protocol/tree/main/examples)
directory. Validate any of them with `npm run ttp -- check <file>`.

| Example | Shows |
| --- | --- |
| `01-basic-agent.ttp` | A minimal subject + trust claim. |
| `02-trust-decay.ttp` | Trust decaying over time. |
| `03-threshold-proof.ttp` | Proving trust clears a threshold. |
| `04-delegated-trust.ttp` | Bounded delegation between subjects. |
| `05-agent-tool-trust-wrapper.ttp` | Gating an agent tool call. |
| `06-cicd-pipeline-trust-proof.ttp` | Trust before a deploy stage. |
| `07-api-client-trust-proof.ttp` | Gating a sensitive API client. |
| `08-msp-mssp-trust-proof.ttp` | Customer-impacting operational action. |

```bash
npm run ttp -- eval examples/02-trust-decay.ttp --subject agent:invoice_reviewer --at now
```
