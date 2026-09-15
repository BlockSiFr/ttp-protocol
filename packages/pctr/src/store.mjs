import fs from 'node:fs';
import path from 'node:path';

// Everything PCTR learns locally lives in ./.pctr — no account, no network.
export const dir = (cwd = process.cwd()) => path.join(cwd, '.pctr');
const ensure = (p) => { fs.mkdirSync(p, { recursive: true }); return p; };

export const manifestPath = (cwd = process.cwd()) => path.join(cwd, 'pctr.json');

export function readManifest(cwd = process.cwd()) {
  const p = manifestPath(cwd);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
export function writeManifest(manifest, cwd = process.cwd()) {
  fs.writeFileSync(manifestPath(cwd), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath(cwd);
}

export function saveRun(timeline, cwd = process.cwd()) {
  const p = path.join(ensure(path.join(dir(cwd), 'runs')), `${timeline.runId}.json`);
  fs.writeFileSync(p, `${JSON.stringify(timeline.toJSON ? timeline.toJSON() : timeline, null, 2)}\n`);
  return p;
}
export function listRuns(cwd = process.cwd()) {
  const p = path.join(dir(cwd), 'runs');
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter((f) => f.endsWith('.json'))
    .map((f) => ({ runId: f.replace(/\.json$/, ''), file: path.join(p, f), mtime: fs.statSync(path.join(p, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
}
export function loadRun(runId, cwd = process.cwd()) {
  const runs = listRuns(cwd);
  const hit = runId ? runs.find((r) => r.runId === runId) : runs[0];
  return hit ? JSON.parse(fs.readFileSync(hit.file, 'utf8')) : null;
}

export function saveReceipt(receipt, cwd = process.cwd()) {
  const p = path.join(ensure(path.join(dir(cwd), 'receipts')), `${receipt.receiptId}.json`);
  fs.writeFileSync(p, `${JSON.stringify(receipt, null, 2)}\n`);
  return p;
}
export function listReceipts(cwd = process.cwd()) {
  const p = path.join(dir(cwd), 'receipts');
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(p, f), 'utf8')))
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
}
