# Examples

Use these examples to model trustworthiness establishment before downstream authority and execution decisions.

## Decision Boundary

TTP establishes trustworthiness. It does not enforce execution directly. RAP, Execution Exchange, API gateways, CI gates, and integrated runtime systems enforce downstream decisions.

## Core Examples

- `01-basic-agent.ttp`
- `02-trust-decay.ttp`
- `03-threshold-proof.ttp`
- `04-delegated-trust.ttp`
- `05-agent-tool-trust-wrapper.ttp`
- `06-cicd-pipeline-trust-proof.ttp`
- `07-api-client-trust-proof.ttp`
- `08-msp-mssp-trust-proof.ttp`
- `09-execution-receipt-reference.json`

## Each Example Answers

- What actor is being evaluated?
- What trustworthiness question is being answered?
- What evidence exists?
- What can decay?
- What proof is produced?
- What downstream system would consume the result?

## Production Note

Examples are non-production protocol patterns. Production enforcement requires signed claims, trusted issuer registry, replay protection, clock integrity, tenant isolation, fail-closed downstream enforcement, receipt signing, and commercial enforcement infrastructure such as Execution Exchange.
