#!/usr/bin/env node
import { buildGraph, summarize, protectedActions } from '../src/graph.mjs';
import { discover, defaultPolicy } from '../src/discover.mjs';
import { previewConsequence } from '../src/twin.mjs';
import { previewMeasured } from '../src/probe.mjs';
import { resolveRoute } from '../src/router.mjs';
import { protect, simulate } from '../src/protect.mjs';
import { createBoundary, startBoundaryServer, remoteBoundary, persistentReplayStore } from '../src/boundary.mjs';
import { verifyReceipt, verifyReceiptChain } from '../src/receipt.mjs';
import { createTimeline, fromJSON, why, compare, fork } from '../src/timeline.mjs';
import { defaultKeyPair, exportPublic } from '../src/keys.mjs';
import fs from 'node:fs';
import path from 'node:path';
import * as store from '../src/store.mjs';
import * as r from '../src/render.mjs';

const VERSION = '0.1.0';

const argv = process.argv.slice(2);
const command = argv[0];
// Flags that take a value, so their value is never mistaken for a positional argument.
const VALUE_FLAGS = new Set(['amount', 'records', 'recordsAffected', 'batch', 'params', 'approve',
  'target', 'agent', 'objective', 'compare', 'fork', 'key', 'export', 'run', 'probe', 'boundary', 'port']);
const positional = (() => {
  const out = [];
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      if (VALUE_FLAGS.has(token.slice(2)) && argv[i + 1] && !argv[i + 1].startsWith('--')) i++;
      continue;
    }
    out.push(token);
  }
  return out;
})();
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const asJson = argv.includes('--json');
const out = (human, data) => console.log(asJson ? JSON.stringify(data, null, 2) : human);

const params = () => {
  const p = {};
  for (const key of ['amount', 'records', 'recordsAffected', 'batch']) {
    const v = flag(key);
    if (v != null && v !== true) p[key === 'records' ? 'recordsAffected' : key] = Number(v);
  }
  const raw = flag('params');
  if (raw && raw !== true) Object.assign(p, JSON.parse(raw));
  return p;
};

// How receipts get checked: an explicit public key file is real third-party
// verification; trustedSigners in pctr.json pins who is allowed to have signed.
function verifyOptions() {
  const keyPath = flag('key');
  const manifest = store.readManifest();
  return {
    publicKey: keyPath && keyPath !== true ? fs.readFileSync(String(keyPath), 'utf8') : undefined,
    trustedKeyIds: manifest?.trustedSigners
  };
}

function loadGraph() {
  const manifest = store.readManifest();
  if (!manifest) {
    console.error('No pctr.json found. Run: pctr init');
    process.exit(2);
  }
  return buildGraph(manifest);
}

async function main() {
  switch (command) {
    case undefined:
    case 'help': case '--help': case '-h':
      console.log(help()); return 0;
    case 'version': case '--version': case '-v':
      console.log(`pctr ${VERSION}`); return 0;

    case 'init': {
      const existing = store.readManifest();
      const { manifest, notes, discovered } = discover(process.cwd(), { declared: existing });
      if (!manifest.agents.length) {
        manifest.agents = exampleManifest().agents;
        manifest.tools = exampleManifest().tools;
        manifest.actions = exampleManifest().actions;
        notes.push('No agents detected; wrote a worked example you can edit.');
      }
      const path = store.writeManifest(manifest);
      if (asJson) return out(null, { path, manifest, notes });
      console.log(r.heading('pctr initialized'));
      console.log(`Wrote ${path}`);
      console.log(r.field('Agents', String(discovered.agents || manifest.agents.length)));
      console.log(r.field('Tools', String(discovered.tools || manifest.tools.length)));
      for (const n of notes) console.log(r.dim(`- ${n}`));
      console.log(`\nNext: ${r.bold('pctr scan')}`);
      return 0;
    }

    case 'scan': {
      const graph = loadGraph();
      return out(r.renderScan(graph), { summary: summarize(graph), protected: protectedActions(graph) });
    }

    case 'graph': {
      const graph = loadGraph();
      return out(r.renderGraph(graph), {
        principal: graph.principal,
        nodes: [...graph.nodes.values()],
        edges: graph.edges
      });
    }

    case 'preview': {
      const graph = loadGraph();
      const action = positional[0] ?? protectedActions(graph)[0]?.id;
      if (!action) return fail('Nothing to preview. Pass an action: pctr preview <action>');
      const probes = flag('probe') && flag('probe') !== true ? { [action]: String(flag('probe')) } : undefined;
      const p = await previewMeasured(graph, action, params(), { probes, target: flag('target') });
      return out(r.renderPreview(p), p);
    }

    case 'route': {
      const graph = loadGraph();
      const action = positional[0] ?? protectedActions(graph)[0]?.id;
      if (!action) return fail('Pass an action: pctr route <action>');
      // Material parameters can change the consequence, and the consequence sets the bar.
      const severity = previewConsequence(graph, action, params()).severity;
      const result = resolveRoute(graph, action, { target: flag('target'), severity });
      return out(r.renderRoute(result), result);
    }

    case 'protect': case 'simulate': {
      const graph = loadGraph();
      const action = positional[0] ?? protectedActions(graph)[0]?.id;
      if (!action) return fail(`Pass an action: pctr ${command} <action>`);
      const request = { action, target: flag('target') ?? action, params: params(), agent: flag('agent') };
      const probes = flag('probe') && flag('probe') !== true ? { [action]: String(flag('probe')) } : undefined;
      const measured = await previewMeasured(graph, action, request.params, { probes, target: request.target });
      const approval = flag('approve') ? { by: String(flag('approve')), at: new Date().toISOString() } : null;
      const run = await (command === 'simulate' ? simulate : protect)(graph, request, {
        objective: flag('objective') ?? `${command} ${action}`,
        approval,
        preview: measured,
        boundary: flag('boundary') && flag('boundary') !== true ? remoteBoundary(String(flag('boundary'))) : undefined,
        priorReceiptHash: store.listReceipts().at(-1)?.receiptHash ?? null,
        timeline: createTimeline({ objective: flag('objective') ?? `${command} ${action}` })
      });
      store.saveRun(run.timeline);
      store.saveReceipt(run.receipt);
      if (asJson) return out(null, { allowed: run.allowed, preview: run.preview, route: run.route, receipt: run.receipt, timeline: run.timeline.toJSON() });
      console.log(r.renderPreview(run.preview));
      if (run.routeResult) console.log(r.renderRoute(run.routeResult));
      console.log(r.renderReceipt(run.receipt, verifyReceipt(run.receipt)));
      console.log(`\n${r.dim(`Replay this run: pctr replay ${run.timeline.runId}`)}`);
      return run.allowed ? 0 : 1;
    }

    case 'replay': {
      const data = store.loadRun(positional[0]);
      if (!data) return fail('No runs recorded yet. Run: pctr protect <action>');
      const timeline = fromJSON(data);
      if (flag('compare') && flag('compare') !== true) {
        const other = store.loadRun(String(flag('compare')));
        if (!other) return fail(`No run named ${flag('compare')}`);
        const diff = compare(timeline, fromJSON(other));
        return out(renderCompare(diff, data.runId, other.runId), diff);
      }
      if (flag('fork')) {
        const forked = fork(timeline, { upTo: flag('fork') !== true ? String(flag('fork')) : null });
        store.saveRun(forked);
        return out(`${r.renderTimeline(forked)}\n${r.dim(`Forked run saved as ${forked.runId}`)}`, forked.toJSON());
      }
      return out(r.renderTimeline(timeline), data);
    }

    case 'explain': {
      const data = store.loadRun(flag('run') !== true ? flag('run') : null);
      if (!data) return fail('No runs recorded yet. Run: pctr protect <action>');
      const question = positional[0] ?? 'EXECUTION_DENIED';
      const answer = why(fromJSON(data), question);
      return out(r.renderWhy(answer), answer);
    }

    case 'serve': {
      // The boundary runs here, in its own process, holding the replay state and the
      // list of signers it accepts. Agents ask it; they do not decide for themselves.
      const manifest = store.readManifest();
      const keyPath = flag('key');
      const boundary = createBoundary({
        trustedKeyIds: manifest?.trustedSigners,
        publicKey: keyPath && keyPath !== true ? fs.readFileSync(String(keyPath), 'utf8') : undefined,
        replayStore: persistentReplayStore(path.join(store.dir(), 'spent-nonces.json'))
      });
      const port = Number(flag('port') !== true && flag('port') != null ? flag('port') : 8787);
      const { url } = await startBoundaryServer({ port, boundary,
        onDecision: (decision, { execution }) => {
          console.log(`${decision.allowed ? r.green('ALLOW') : r.red('DENY ')}  ${execution.action} -> ${execution.target ?? ''} ${decision.allowed ? '' : r.dim(decision.failures.map((f) => f.code).join(', '))}`);
        } });
      console.log(r.heading('effect boundary'));
      console.log(r.field('Listening on', url));
      console.log(r.field('Trusted signers', manifest?.trustedSigners?.join(', ') ?? r.yellow('none pinned — set trustedSigners in pctr.json')));
      console.log(r.field('Replay state', path.join(store.dir(), 'spent-nonces.json')));
      console.log(`\n${r.dim(`Enforce against it with: pctr protect <action> --boundary ${url}`)}`);
      await new Promise(() => {}); // serve until interrupted
      return 0;
    }

    case 'keys': {
      const pair = defaultKeyPair();
      const publicKey = exportPublic(pair.publicKey);
      if (flag('export') && flag('export') !== true) {
        fs.writeFileSync(String(flag('export')), `${publicKey}\n`);
        console.log(`Wrote public key to ${flag('export')}`);
      }
      return out([r.heading('signing keys'),
        r.field('Key id', pair.keyId),
        r.field('Private key', pair.ephemeral ? r.yellow('ephemeral (not persisted)') : pair.source),
        r.field('Algorithm', 'ed25519'),
        '', r.dim('Share the public key below. Anyone holding it can verify your receipts'),
        r.dim('and cannot mint one. Never share the private key.'), '', publicKey].join('\n'),
        { keyId: pair.keyId, algorithm: 'ed25519', publicKey, source: pair.source, ephemeral: pair.ephemeral });
    }

    case 'receipt': {
      const receipts = store.listReceipts();
      if (!receipts.length) return fail('No receipts yet. Run: pctr protect <action>');
      const receipt = positional[0] ? receipts.find((x) => x.receiptId === positional[0]) : receipts.at(-1);
      if (!receipt) return fail(`No receipt ${positional[0]}`);
      return out(r.renderReceipt(receipt, verifyReceipt(receipt, verifyOptions())), receipt);
    }

    case 'verify': {
      const receipts = store.listReceipts();
      if (!receipts.length) return fail('No receipts to verify yet.');
      const target = positional[0] ? [receipts.find((x) => x.receiptId === positional[0])].filter(Boolean) : receipts;
      const opts = verifyOptions();
      const results = target.map((x) => ({ receiptId: x.receiptId, ...verifyReceipt(x, opts) }));
      const bad = results.filter((x) => !x.valid);
      const unpinned = results.filter((x) => x.valid && !x.signerVerified);
      const chain = verifyReceiptChain(receipts, opts);
      const human = [r.heading('receipt verification'),
        r.field('Receipts checked', String(results.length)),
        r.field('Valid', bad.length ? r.red(`${results.length - bad.length} of ${results.length}`) : r.green(String(results.length))),
        r.field('Chain', chain.valid ? r.green('intact') : r.red('BROKEN')),
        r.field('Signer', unpinned.length
          ? r.yellow(`unpinned for ${unpinned.length} receipt(s) — pass --key <public-key.pem> or set trustedSigners in pctr.json`)
          : r.green('verified against a pinned key')),
        ...bad.flatMap((b) => [`  ${r.red('x')} ${b.receiptId}`, ...b.failures.map((f) => `      ${f.message}`)]),
        ...(chain.valid ? [] : chain.failures.flatMap((f) => [`  ${r.red('x')} ${f.receiptId}`, ...f.failures.map((x) => `      ${x.message}`)]))].join('\n');
      out(human, { results, chain });
      return bad.length ? 1 : 0;
    }

    case 'doctor': {
      const manifest = store.readManifest();
      const checks = [];
      checks.push(check('pctr.json present', Boolean(manifest), 'Run: pctr init'));
      const graph = manifest ? buildGraph(manifest) : null;
      if (graph) {
        const s = summarize(graph);
        checks.push(check('Agents declared', s.agents > 0, 'Add agents to pctr.json'));
        checks.push(check('Tools declared', s.tools > 0, 'Add tools with their actions to pctr.json'));
        checks.push(check('Protected consequences mapped', s.protected > 0, 'No protected consequence found — verify your action names'));
        checks.push(check('Policy defined', Boolean(manifest.policy), `Add a policy block, e.g. ${JSON.stringify(defaultPolicy())}`));
        const noAuthority = [...graph.nodes.values()].filter((n) => n.type === 'agent' && !(n.authority ?? []).length);
        checks.push(check('Every agent has declared authority', noAuthority.length === 0,
          `No authority declared for: ${noAuthority.map((n) => n.id).join(', ')}`));
        const unreachable = protectedActions(graph).filter((a) => resolveRoute(graph, a.id).admissible.length === 0);
        checks.push(check('Protected actions have an admissible route', unreachable.length === 0,
          `No admissible route today for: ${unreachable.map((a) => a.id).join(', ')}. That may be correct — it means nothing can currently reach them. Run "pctr route <action>" to see why.`));
      }
      const pair = defaultKeyPair();
      checks.push(check('Signing key is persisted', !pair.ephemeral,
        'The signing key is ephemeral, so receipts cannot be verified after this process exits. Make .pctr writable or set PCTR_PRIVATE_KEY.'));
      checks.push(check('Trusted signers pinned', Boolean(manifest?.trustedSigners?.length),
        `No trustedSigners in pctr.json, so receipts verify as "unpinned". Add "trustedSigners": ["${pair.keyId}"].`));
      if (graph) {
        const unmeasured = protectedActions(graph).filter((a) => !(manifest.probes ?? {})[a.id]);
        checks.push(check('Protected actions are measured by a probe', unmeasured.length === 0,
          `Using declared values for: ${unmeasured.map((a) => a.id).join(', ')}. Add a read-only probe under "probes" to measure the real consequence.`));
      }
      const failed = checks.filter((x) => !x.ok);
      const human = [r.heading('pctr doctor'),
        ...checks.map((x) => `${x.ok ? r.green('ok') : r.yellow('!!')}  ${x.label}${x.ok ? '' : `\n      ${r.dim(x.fix)}`}`)].join('\n');
      out(human, { checks });
      return failed.length ? 1 : 0;
    }

    default:
      return fail(`Unknown command: ${command}\n\n${help()}`);
  }
}

const check = (label, ok, fix) => ({ label, ok, fix });
const fail = (message) => { console.error(message); return 2; };

function renderCompare(diff, leftId, rightId) {
  const lines = [r.heading('compare runs'), r.field('Left', leftId), r.field('Right', rightId),
    r.field('Diverged at step', diff.divergedAt === null ? 'never' : String(diff.divergedAt)),
    r.field('Same outcome', diff.sameOutcome ? r.green('YES') : r.red(`NO (${diff.outcomes.join(' vs ')})`)), ''];
  for (const row of diff.rows) {
    lines.push(`${row.same ? r.dim('  =') : r.yellow('  ~')} ${row.left ?? r.dim('(none)')}`);
    if (!row.same) lines.push(`    ${r.dim('right:')} ${row.right ?? r.dim('(none)')}`);
  }
  return lines.join('\n');
}

function exampleManifest() {
  return {
    agents: [
      { id: 'planner', framework: 'openai-agents', trust: 0.98, evidenceAgeSeconds: 20, authority: ['*'], jurisdiction: 'eu', latencyMs: 80, costUnits: 1, tools: [], delegatesTo: ['finance-agent-a', 'finance-agent-d', 'support-agent'] },
      { id: 'finance-agent-a', framework: 'langgraph', trust: 0.97, evidenceAgeSeconds: 4200, authority: ['payments.*'], jurisdiction: 'eu', latencyMs: 90, costUnits: 1, tools: ['payments'] },
      { id: 'finance-agent-d', framework: 'claude-agents', trust: 0.97, evidenceAgeSeconds: 30, authority: ['payments.*'], jurisdiction: 'eu', latencyMs: 140, costUnits: 2, tools: ['payments'] },
      { id: 'support-agent', framework: 'crewai', trust: 0.82, evidenceAgeSeconds: 60, authority: ['customers.read'], jurisdiction: 'eu', latencyMs: 120, costUnits: 1, tools: ['crm'], delegatesTo: ['admin-agent'] },
      { id: 'admin-agent', framework: 'claude-agents', trust: 0.95, evidenceAgeSeconds: 30, authority: ['customers.*'], jurisdiction: 'eu', latencyMs: 200, costUnits: 2, tools: ['database'] }
    ],
    tools: [
      { id: 'payments', protocol: 'mcp', actions: ['payments.transfer'] },
      { id: 'crm', protocol: 'mcp', actions: ['customers.read'] },
      { id: 'database', protocol: 'mcp', actions: ['customers.delete', 'customers.update'] }
    ],
    actions: [
      { id: 'payments.transfer', amount: 1800, connectedWorkflows: 2 },
      { id: 'customers.delete', recordsAffected: 1842, connectedWorkflows: 4 }
    ]
  };
}

function help() {
  return `PCTR — Protected Consequence Trust Routing

  See what your agents can cause. Route them safely. Prove what happened.

Usage
  pctr init                 Discover agents and tools, write pctr.json
  pctr scan                 What consequences can your agents reach?
  pctr graph                Show the trust graph
  pctr preview <action>     Consequence Twin: what will this change?
  pctr route <action>       TrustRoute Autopilot: which path may get there?
  pctr protect <action>     Run the full loop and issue a receipt
  pctr simulate <action>    Same, without executing any effect
  pctr replay [run]         Agent Time Machine: what happened, step by step
  pctr explain <event>      Why was this allowed, denied, or rerouted?
  pctr receipt [id]         Show an execution receipt
  pctr verify [id]          Verify receipt signatures and the receipt chain
  pctr keys                 Show your signing key id and public key
  pctr serve                Run the effect boundary as its own process
  pctr doctor               Check your setup

Options
  --json                    Machine-readable output
  --amount <n>              Material parameter: amount
  --records <n>             Material parameter: records affected
  --params '<json>'         Any other material parameters
  --approve <who>           Record a human approval
  --target <resource>       Execution target
  --boundary <url>          protect: verify authority at a remote effect boundary
  --port <n>                serve: port for the effect boundary (default 8787)
  --probe <file|command>    preview: measure the real consequence with this probe
  --key <public-key.pem>    verify: check signatures against this public key
  --export <file>           keys: write the public key to a file
  --compare <run>           replay: diff two runs
  --fork [eventId]          replay: fork a run for simulation

Start with: pctr init, then pctr scan`;
}

main().then((code) => process.exit(code ?? 0)).catch((err) => {
  console.error(err.stack ?? String(err));
  process.exit(1);
});
