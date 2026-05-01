#!/usr/bin/env node
// ttp CLI — issue, verify, decay
// Usage: node bin/ttp.mjs <command> [flags]

import { readFileSync } from 'node:fs';
import { prove_trust_threshold } from '../src/trust_threshold.mjs';
import { apply_decay } from '../src/decay.mjs';
import { generate_trust_proof } from '../src/trust_proof.mjs';

const [,, command, ...rawArgs] = process.argv;

function parseFlags(args) {
  const f = {};
  for (let i = 0; i < args.length - 1; i += 2) {
    const key = args[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    f[key] = args[i + 1];
  }
  return f;
}

function die(msg, code = 2) {
  process.stderr.write(`ttp: ${msg}\n`);
  process.exit(code);
}

function usage() {
  process.stdout.write(`
ttp v0.1.0 — Trust Transfer Protocol CLI

Commands:
  ttp issue   Generate a trust proof
    --subject   <id>       Subject identifier (required)
    --action    <action>   Action being authorized (required)
    --resource  <resource> Target resource (required)
    --trust     <0-1>      Current trust score (required)
    --threshold <0-1>      Minimum required trust (required)
    --dimension <dim>      Trust dimension [execution]
    --decay-seconds <n>    Apply trust decay over n seconds
    --decay-lambda  <f>    Decay constant (default 0.0001)

  ttp verify  Verify a trust proof (reads from stdin or --file)
    --file <path>          Path to proof JSON file (default: stdin)

  ttp decay   Compute decayed trust
    --trust   <0-1>        Initial trust score (required)
    --lambda  <float>      Decay constant (required)
    --elapsed <seconds>    Elapsed seconds (required)

Examples:
  node bin/ttp.mjs issue --subject agent_007 --action deploy \\
    --resource cluster/prod --trust 0.876 --threshold 0.7

  node bin/ttp.mjs issue ... | node bin/ttp.mjs verify

  node bin/ttp.mjs decay --trust 0.876 --lambda 0.0001 --elapsed 3600
`);
  process.exit(1);
}

if (!command || command === '--help' || command === '-h') usage();

if (command === 'issue') {
  const f = parseFlags(rawArgs);
  if (!f.subject) die('--subject is required');
  if (!f.action) die('--action is required');
  if (!f.resource) die('--resource is required');
  if (!f.trust) die('--trust is required');
  if (!f.threshold) die('--threshold is required');

  const now = new Date().toISOString();
  const trustScore = parseFloat(f.trust);
  const threshold = parseFloat(f.threshold);

  if (isNaN(trustScore) || trustScore < 0 || trustScore > 1)
    die('--trust must be a number between 0 and 1');
  if (isNaN(threshold) || threshold < 0 || threshold > 1)
    die('--threshold must be a number between 0 and 1');

  const thresholdProof = prove_trust_threshold({
    subject: f.subject,
    trustScore,
    requiredThreshold: threshold,
    dimension: f.dimension ?? 'execution',
    evaluatedAt: now,
  });

  if (!thresholdProof.satisfied) {
    process.stderr.write(
      `ttp: trust threshold not met (${trustScore} < ${threshold})\n` +
      JSON.stringify(thresholdProof.failureReasons, null, 2) + '\n',
    );
    process.exit(3);
  }

  let effectiveTrust = trustScore;
  if (f.decaySeconds) {
    const decayed = apply_decay({
      initialTrust: trustScore,
      decayConstant: parseFloat(f.decayLambda ?? '0.0001'),
      elapsedSeconds: parseInt(f.decaySeconds, 10),
    });
    effectiveTrust = decayed.finalTrust;
  }

  const proof = generate_trust_proof({
    subject: f.subject,
    action: f.action,
    resource: f.resource,
    trustThresholdProof: thresholdProof,
    attestationResults: [],
    delegationResults: [],
    routeResult: { valid: true, routeId: `cli_${Date.now()}` },
    generatedAt: now,
  });

  process.stdout.write(JSON.stringify(proof, null, 2) + '\n');
  process.exit(proof.valid ? 0 : 3);
}

if (command === 'verify') {
  const f = parseFlags(rawArgs);
  let raw;
  try {
    raw = f.file
      ? readFileSync(f.file, 'utf8')
      : readFileSync(0, 'utf8'); // stdin fd
  } catch (e) {
    die(`could not read input: ${e.message}`);
  }

  let proof;
  try { proof = JSON.parse(raw); }
  catch { die('invalid JSON'); }

  if (!proof || typeof proof !== 'object') die('expected a JSON object');

  if (!proof.valid) {
    process.stderr.write('ttp: proof is INVALID\n');
    if (proof.failureReasons?.length) {
      process.stderr.write(JSON.stringify(proof.failureReasons, null, 2) + '\n');
    }
    process.exit(3);
  }

  const { subject, action, resource, generatedAt } = proof;
  process.stdout.write(
    `ok  subject=${subject} action=${action} resource=${resource} generatedAt=${generatedAt}\n`,
  );
  process.exit(0);
}

if (command === 'decay') {
  const f = parseFlags(rawArgs);
  if (!f.trust) die('--trust is required');
  if (!f.lambda) die('--lambda is required');
  if (!f.elapsed) die('--elapsed is required');

  const result = apply_decay({
    initialTrust: parseFloat(f.trust),
    decayConstant: parseFloat(f.lambda),
    elapsedSeconds: parseInt(f.elapsed, 10),
  });

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

die(`unknown command: ${command}`);
