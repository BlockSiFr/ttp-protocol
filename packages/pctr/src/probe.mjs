import { execFile } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { previewConsequence } from './twin.mjs';

// A probe measures what an action would actually affect, instead of trusting a number
// declared in pctr.json. A probe MUST be read-only: a dry run, a COUNT, a plan. PCTR
// runs it before anything is authorized, so a probe with side effects defeats the point.

const PROBE_TIMEOUT_MS = 10_000;
const MEASURABLE = ['recordsAffected', 'amount', 'connectedWorkflows', 'dataClass', 'reversible', 'severity'];

export async function runProbe(spec, context, { cwd = process.cwd(), timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  if (!spec) return { ok: false, skipped: true, fields: {} };
  const probe = typeof spec === 'string' ? { module: spec } : spec;
  try {
    const raw = probe.command
      ? await runCommand(probe.command, probe.args ?? [], context, { cwd, timeoutMs })
      : await runModule(probe.module, context, { cwd });
    const fields = Object.fromEntries(Object.entries(raw ?? {}).filter(([k]) => MEASURABLE.includes(k)));
    if (!Object.keys(fields).length) {
      return { ok: false, fields: {}, error: `probe returned no measurable fields (expected one of: ${MEASURABLE.join(', ')})` };
    }
    return { ok: true, fields, source: probe.command ?? probe.module };
  } catch (error) {
    // A failing probe must never quietly become "no consequence". It downgrades to
    // declared values and says so.
    return { ok: false, fields: {}, error: error.message ?? String(error) };
  }
}

async function runModule(modulePath, context, { cwd }) {
  const resolved = pathToFileURL(path.resolve(cwd, modulePath)).href;
  const mod = await import(resolved);
  const fn = mod.default ?? mod.probe;
  if (typeof fn !== 'function') throw new Error(`${modulePath} does not export a probe function`);
  return await fn(context);
}

function runCommand(command, args, context, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, {
      cwd, timeout: timeoutMs, maxBuffer: 1024 * 1024,
      env: { ...process.env, PCTR_ACTION: context.action, PCTR_TARGET: context.target ?? '', PCTR_PARAMS: JSON.stringify(context.params ?? {}) }
    }, (error, stdout) => {
      if (error) return reject(new Error(`probe command failed: ${error.message.split('\n')[0]}`));
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error(`probe command did not return JSON: ${String(stdout).slice(0, 80)}`)); }
    });
    child.on('error', reject);
  });
}

// The Consequence Twin, with measured values where a probe exists and declared values
// everywhere else. The result always says which is which.
export async function previewMeasured(graph, action, params = {}, { probes, cwd = process.cwd(), target } = {}) {
  const spec = (probes ?? graph.manifest?.probes ?? {})[action];
  const result = await runProbe(spec, { action, target, params }, { cwd });
  const preview = previewConsequence(graph, action, { ...params, ...result.fields });
  return {
    ...preview,
    measured: result.ok,
    measuredFields: Object.keys(result.fields),
    probe: spec ? { source: result.source ?? (typeof spec === 'string' ? spec : spec.command), ok: result.ok, error: result.error ?? null } : null,
    provenance: Object.fromEntries(
      ['recordsAffected', 'amount', 'connectedWorkflows'].map((f) => [f, result.fields[f] !== undefined ? 'measured' : 'declared'])
    )
  };
}
