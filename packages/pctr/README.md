# PCTR — Protected Consequence Trust Routing

**See what your agents can cause. Route them safely. Prove what happened.**

Your agent can have valid credentials and still be about to do the wrong thing.

```
Objective  ->  Trust Route  ->  Consequence Preview  ->  Execution Authority  ->  Protected Action  ->  Receipt
```

## 60 seconds

<img src="../../assets/pctr-scan.svg" alt="pctr scan finds five agents, three tools and four potential actions, and reports one critical protected consequence: customers.delete can be reached through support-agent and admin-agent without independent execution authority" width="100%">

Not on npm yet — from a clone of this repo:

```bash
npm link ./packages/pctr    # then the bare `pctr` command works anywhere
pctr init                   # discover agents and tools, write pctr.json
pctr scan                   # what consequences can they reach?
```

No account. No network. Everything stays in `./pctr.json` and `./.pctr`.

## Share what you find

```bash
pctr scan --share           # writes pctr-report.md
```

Drops straight into a pull request or an issue: a severity table, the highest-priority
consequence with the route that reaches it, and what to do about it. Add
`packages/pctr/examples/pctr-scan.yml` to `.github/workflows/` and every PR gets the same
report as a comment, with `fail-on: critical` to block a merge when an agent can reach an
irreversible consequence.

```markdown
## 🛑 PCTR consequence scan

**5 agents · 3 tools · 4 actions.** 3 of them can cause a protected consequence, and 2 cannot be undone.

| Severity | Consequences |
| --- | --- |
| 🔴 CRITICAL | 1 |
| 🟠 HIGH | 1 |

### Highest priority: `customers.delete`

Causes **data deleted** · **irreversible** · 1,842 records · blast radius WIDE
```

## The three questions

| Question | Command | Answers |
| --- | --- | --- |
| **Consequence** — what can this action cause? | `pctr preview <action>` | records, money, reversibility, blast radius |
| **Route** — which trustworthy agent path may get there? | `pctr route <action>` | the selected path, and why every other one was rejected |
| **Authority** — is this exact execution allowed right now? | `pctr protect <action>` | an allow/deny decision plus a verifiable receipt |

## Consequence Twin

See what your AI is about to change before it changes it — `git diff` for autonomous
agents. It reasons over the graph and the parameters you declare; it does not query your
live systems (see [Honest limits](#honest-limits)).

```bash
pctr preview customers.delete --records 1842
```

```
CONSEQUENCE PREVIEW

Action                customers.delete
Causes                data deleted
Records affected      1842
Reversible            NO
Connected workflows   4
Blast radius          WIDE (100/100)
Routes that reach it  1
Risk                  CRITICAL

Recommended

- Require TTP execution authority bound to these exact parameters
- Limit batch to 25 records (currently 1842) + require approval
- Notify 4 connected workflows before executing
- Verify authority at the effect boundary, not in the calling agent
```

## TrustRoute Autopilot

The right trustworthy agent gets the job automatically. Admissibility is decided first;
only routes that survive are optimized for latency and cost. A security constraint is
never traded away for a faster or cheaper route.

```bash
pctr route payments.transfer --amount 18000
```

```
ROUTE SELECTED

user:local
  |
  v
planner
  |
  v
finance-agent-d
  |
  v
payments
  |
  v
payments.transfer

Effective trust       0.9178 (0.9 required for CRITICAL)
Hops                  5
Human approval        REQUIRED

Rejected routes

user:local -> planner -> finance-agent-a -> payments -> payments.transfer
  x finance-agent-a evidence is 4200s old; CRITICAL actions require evidence under 300s
  x effective trust 0.6579 is below the 0.9 required for CRITICAL consequences
```

At $1,800 the same action is `HIGH` and needs no approval; the amount is what moves it to
`CRITICAL`. Material parameters change the consequence, and the consequence sets the bar.

`finance-agent-a` was the *faster* route. It was still rejected.

## Agent Time Machine

Replay exactly why your AI did what it did.

```bash
pctr protect payments.transfer --amount 18000
pctr replay
pctr explain EXECUTION_DENIED
```

```
WHY WAS THIS EXECUTION DENIED?

policy requires human approval for CRITICAL consequences

Because

- Objective received: protect payments.transfer
- Action proposed: payments.transfer ($18000)
- Consequence detected: MONEY_MOVED (CRITICAL)
- Route selected: user:local -> planner -> finance-agent-d -> payments -> payments.transfer
```

Every answer is derived from the recorded causal chain, not re-narrated by a model.
Runs can also be forked and compared:

```bash
pctr replay <run> --fork e3
pctr replay <run> --compare <other-run>
```

## Execution authority

A valid identity is not enough. A valid credential is not enough. A valid route is not
enough. Authority binds principal, delegator, session, action, target, material
parameters, constraints, policy, consequence, validity window and nonce — and the effect
boundary verifies it independently of the agent that asked.

```js
import { issueAuthority, verifyAuthority } from '@blocksifr/pctr';

const authority = issueAuthority({
  principal: 'user:ops', action: 'payments.transfer', target: 'acct:9931',
  params: { amount: 1800 }, consequence: 'MONEY_MOVED', route
});

// Same authority, changed amount — possession is not authority.
verifyAuthority(authority, { action: 'payments.transfer', target: 'acct:9931', params: { amount: 18000 } });
// -> { allowed: false, failures: [{ code: 'PARAMETER_MISMATCH', ... }] }
```

Authority also expires and can only be spent once (`REPLAYED_AUTHORITY`).

## Receipts

Every protected execution produces verifiable evidence of what was
requested, who delegated it, which route was selected, what consequence was identified,
what parameters were bound, which verifier checked it, and what actually executed.

```bash
pctr receipt         # show the last one
pctr verify          # verify all of them, including the chain
```

A receipt that records an execution which was never allowed fails verification
(`EXECUTED_WITHOUT_AUTHORITY`), and a removed or reordered receipt breaks the chain.

Receipts and authority are signed with **Ed25519**. Verification takes the public key, so
someone who can check your receipts cannot mint one:

```bash
pctr keys --export public-key.pem   # share this; never share .pctr/keys/signing-key.pem
pctr verify --key public-key.pem
```

```
RECEIPT VERIFICATION

Receipts checked      3
Valid                 2 of 3
Chain                 BROKEN
Signer                verified against a pinned key
  x rcpt-3d80fffd-b45a-405f-8a70-007b5ce7bfde
      receipt signature does not verify
```

Verifying without a pinned key still works, but reports itself as `signerVerified: false`
with an `UNPINNED_KEY` warning — internal consistency is not proof of who signed. Pin
signers permanently with `"trustedSigners": ["ed25519:…"]` in `pctr.json`.

## Commands

```
pctr init                 Discover agents and tools, write pctr.json
pctr scan                 What consequences can your agents reach?
pctr graph                Show the trust graph
pctr preview <action>     Consequence Twin
pctr route <action>       TrustRoute Autopilot
pctr protect <action>     Run the full loop and issue a receipt
pctr simulate <action>    Same, without executing any effect
pctr replay [run]         Agent Time Machine
pctr explain <event>      Why was this allowed, denied, or rerouted?
pctr receipt [id]         Show an execution receipt
pctr verify [id]          Verify receipt signatures and the receipt chain
pctr keys                 Show your signing key id and public key
pctr serve                Run the effect boundary as its own process
pctr doctor               Check your setup
```

Every command prints plain English first. Add `--json` for machine-readable output.

## pctr.json

```json
{
  "principal": "user:ops",
  "agents": [
    { "id": "planner", "framework": "openai-agents", "trust": 0.98, "evidenceAgeSeconds": 20,
      "authority": ["*"], "jurisdiction": "eu", "tools": [], "delegatesTo": ["finance-agent-d"] },
    { "id": "finance-agent-d", "framework": "claude-agents", "trust": 0.97, "evidenceAgeSeconds": 30,
      "authority": ["payments.*"], "jurisdiction": "eu", "latencyMs": 140, "tools": ["payments"] }
  ],
  "tools": [{ "id": "payments", "protocol": "mcp", "actions": ["payments.transfer"] }],
  "actions": [{ "id": "payments.transfer", "amount": 1800, "connectedWorkflows": 2 }],
  "policy": {
    "requireApprovalAtOrAbove": "CRITICAL",
    "approvalThresholds": { "amount": 5000 },
    "jurisdictions": { "MONEY_MOVED": ["eu"] },
    "maxHops": 6,
    "decayPerHop": 0.05
  }
}
```

Agents are participants, not platforms. A new framework needs an adapter that maps its
runtime events onto the canonical PCTR events — not a redesign of PCTR.

## Universal agent fabric

Adapters ship for `openai-agents`, `claude-agents`, `langgraph`, `crewai`, `autogen`,
`semantic-kernel`, `mcp`, `a2a`, and a `generic` envelope for everything else. Each one
maps a framework's own events onto the 16 canonical security events and drops the rest:

```js
import { ingest, createTimeline } from '@blocksifr/pctr';

const timeline = createTimeline({ objective: 'Settle invoice INV-4471' });
ingest('crewai', crewEvents, timeline);
ingest('langgraph', graphEvents, timeline);   // one timeline, one security meaning
```

A tool call in any of them becomes `ACTION_PROPOSED` plus the `CONSEQUENCE_DETECTED` it
implies — the part every framework leaves out. Token usage, streamed text and other
framework internals are dropped rather than invented into events.

See `node examples/pctr-universal-fabric-demo.mjs` for four frameworks feeding one
protected execution through a remote effect boundary.

## Relationship to TTP

PCTR answers *which path through multiple agents is trustworthy enough to reach this
consequence*. [TTP](../../README.md) answers *is this exact execution authority valid
for this principal, action, target, parameters, delegation and moment*.

> TLS protects the channel. TTP protects the authority transferred through the channel.

## Probes: measure the consequence, don't declare it

A number typed into `pctr.json` is a guess. A probe measures. Probes must be read-only —
a `COUNT`, a dry run, a `terraform plan` — because PCTR runs them *before* anything is
authorized.

```js
// probes/count-customers.mjs
export default async function probe({ action, params }) {
  const { rows } = await db.query('select count(*) as rows from customers where inactive_days > $1', [params.olderThanDays]);
  return { recordsAffected: Number(rows), connectedWorkflows: 4, reversible: false };
}
```

```json
{ "probes": { "customers.delete": "./probes/count-customers.mjs" } }
```

```
Records affected      1842 (measured)
```

A shell probe works too (`{ "command": "./plan.sh" }`, JSON on stdout, with `PCTR_ACTION`,
`PCTR_TARGET` and `PCTR_PARAMS` in the environment). If a probe fails, the preview falls
back to declared values and says so — it never silently becomes "no consequence".

## The effect boundary

The requesting agent must not enforce its own authority, so run the boundary somewhere
the agent does not control:

```bash
pctr serve --port 8787                      # holds the replay state and the trusted signers
pctr protect payments.transfer --boundary http://127.0.0.1:8787
```

Spent nonces persist to `.pctr/spent-nonces.json`, so an authority cannot be replayed
across a restart. If the boundary is unreachable, execution is **denied** — it never
fails open.

## Honest limits

- **Blast radius is a heuristic**, not a measurement: severity, record count, connected
  workflows and route count folded into a 0-100 score. The inputs are measurable; the
  weighting is a judgement call.
- **Trust scores come from your manifest.** PCTR decays them, tests them against the bar
  the consequence sets, and refuses stale evidence — but it does not attest agents
  itself. Wire `trust` and `evidenceAgeSeconds` to a real attestation source.
- **Discovery reads source, not running systems.** It parses MCP/LangChain/CrewAI tool
  and agent declarations statically, and does not connect to a live MCP server to list
  its tools. Anything it cannot see, you declare — and declared entries always win.
- **Keys live on disk.** `.pctr/keys/signing-key.pem` is written 0600 and must not be
  committed. KMS/HSM custody is commercial BlockSiFr, not this package.
- **`pctr serve` is plain HTTP on localhost.** Put it behind TLS and your own
  authentication before it leaves the machine.

Apache-2.0.
