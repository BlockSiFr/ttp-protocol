#!/usr/bin/env node
// Renders a terminal SVG of a real `pctr scan`, so the picture in the README is
// generated from the actual output and cannot drift from what the tool prints.
// Usage: node packages/pctr/scripts/render-terminal-svg.mjs [outfile]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'bin', 'pctr.mjs');
const outFile = process.argv[2] ?? path.join(here, '..', '..', '..', 'assets', 'pctr-scan.svg');

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pctr-svg-'));
const run = (args) => execFileSync('node', [cli, ...args], { cwd: workdir, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
run(['init']);
const output = run(['scan']).replace(/\[[0-9;]*m/g, '').split('\n');
fs.rmSync(workdir, { recursive: true, force: true });

const THEME = {
  bg: '#0A0A0F', chrome: '#12121A', border: '#1F1F2B', text: '#C9D1D9', dim: '#6E7681',
  cyan: '#00D4FF', teal: '#00B8A9', red: '#FF5470', amber: '#FFB300', green: '#00E676'
};
const LINE_H = 21;
const PAD = 22;
const TOP = 46;

// The terminal draws a route down the page; a README image reads better with it on one
// line, so collapse the vertical arrows into a single chain.
const collapsed = [];
for (const line of output) {
  const trimmed = line.trim();
  if (trimmed === '|') continue;
  if (trimmed === 'v') { collapsed.push('\u0000'); continue; }
  if (collapsed.at(-1) === '\u0000') {
    collapsed.pop();
    collapsed.push(`${collapsed.pop()} \u2192 ${trimmed}`);
    continue;
  }
  collapsed.push(line);
}
const MAX_COLS = 82;
// Wrap anything wider than the frame, the way the terminal would.
const wrapped = collapsed.flatMap((line) => {
  if (line.length <= MAX_COLS) return [line];
  const indent = line.match(/^\s*/)[0];
  const parts = [];
  let current = indent;
  for (const word of line.trim().split(' ')) {
    if (current.trim() && `${current} ${word}`.length > MAX_COLS) { parts.push(current); current = `${indent}${word}`; }
    else current = current.trim() ? `${current} ${word}` : `${current}${word}`;
  }
  if (current.trim()) parts.push(current);
  return parts;
});
const lines = wrapped.filter((l, i) => !(i === 0 && !l.trim()));
const width = 760;
const height = TOP + PAD + lines.length * LINE_H + 8;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Colour by meaning, matching what the terminal itself emphasizes.
function paint(line) {
  const trimmed = line.trim();
  if (/^(CRITICAL)/.test(trimmed)) return span(line, THEME.red);
  if (/^(HIGH)/.test(trimmed)) return span(line, THEME.amber);
  if (/^(MEDIUM)/.test(trimmed)) return span(line, THEME.cyan);
  if (/^PCTR$/.test(trimmed)) return span(line, THEME.cyan, 700);
  if (/^(Protected consequences|Highest priority:|Route:|Problem:|Recommended:)/.test(trimmed)) return span(line, THEME.text, 700);
  if (/\u2192/.test(trimmed)) {
    // The route chain: dim the hops, light up the consequence at the end.
    const hops = trimmed.split(' \u2192 ');
    return hops.map((hop, i) => (i === hops.length - 1
      ? span(` \u2192 ${hop}`, THEME.red, 700)
      : span(i === 0 ? hop : ` \u2192 ${hop}`, THEME.teal))).join('');
  }
  if (/^(customers\.delete|payments\.transfer)/.test(trimmed)) return span(line, THEME.red, 700);
  if (/^(\||v|↓)$/.test(trimmed)) return span(line, THEME.dim);
  if (/^(Agents found|Tools found|External systems|Potential actions)/.test(trimmed)) {
    const label = line.slice(0, 22);
    const value = line.slice(22);
    return `${span(label, THEME.dim)}${span(value, THEME.teal, 600)}`;
  }
  if (/irreversibly|without independent execution authority/.test(trimmed)) return span(line, THEME.text);
  if (/^Add TTP authority/.test(trimmed)) return span(line, THEME.green);
  return span(line, THEME.text);
}
const span = (text, fill, weight = 400) =>
  `<tspan fill="${fill}"${weight !== 400 ? ` font-weight="${weight}"` : ''} xml:space="preserve">${esc(text)}</tspan>`;

const body = lines.map((line, i) =>
  `    <text x="${PAD}" y="${TOP + PAD + i * LINE_H}">${paint(line)}</text>`).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="pctr scan output: 5 agents, 3 tools, 4 potential actions, one critical protected consequence — customers.delete can delete customer records without independent execution authority">
  <rect width="${width}" height="${height}" rx="10" fill="${THEME.bg}" stroke="${THEME.border}"/>
  <rect width="${width}" height="${TOP - 10}" rx="10" fill="${THEME.chrome}"/>
  <rect y="${TOP - 20}" width="${width}" height="10" fill="${THEME.chrome}"/>
  <circle cx="24" cy="18" r="5" fill="#FF5F57"/><circle cx="43" cy="18" r="5" fill="#FEBC2E"/><circle cx="62" cy="18" r="5" fill="#28C840"/>
  <text x="84" y="22" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" fill="${THEME.dim}">pctr scan</text>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13.5" fill="${THEME.text}">
${body}
  </g>
</svg>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, svg);
console.log(`Wrote ${outFile} (${lines.length} lines, ${(svg.length / 1024).toFixed(1)} KB)`);
