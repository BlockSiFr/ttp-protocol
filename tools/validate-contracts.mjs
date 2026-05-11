import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const openapi = readJson('specs/openapi/runtime-authority-gate.openapi.json');
const reqSchema = readJson('specs/schemas/re-authorize-request.schema.json');
const resSchema = readJson('specs/schemas/re-authorize-response.schema.json');
const receiptSchema = readJson('specs/schemas/execution-receipt.schema.json');
const reqExample = readJson('specs/examples/re-authorize.request.json');
const resExample = readJson('specs/examples/re-authorize.response.json');

assert(openapi.openapi === '3.1.0', 'OpenAPI must declare 3.1.0');
assert(openapi.paths?.['/re/authorize']?.post, 'OpenAPI missing POST /re/authorize');
assert(openapi.paths?.['/re/reauthorize']?.post, 'OpenAPI missing POST /re/reauthorize');

assert(reqSchema.required?.includes('requestId'), 'request schema must require requestId');
assert(reqSchema.required?.includes('action'), 'request schema must require action');
assert(reqSchema.required?.includes('resource'), 'request schema must require resource');

for (const field of ['decision', 'mode', 'rapDecision', 'nextStep', 'receiptId', 'receipt']) {
  assert(resSchema.required?.includes(field), `response schema must require ${field}`);
}

for (const field of ['execution', 'decision', 'trust', 'risk', 'cost', 'compliance', 'evidence', 'integrity']) {
  assert(receiptSchema.required?.includes(field), `receipt schema must require ${field}`);
}

assert(typeof reqExample.requestId === 'string', 'request example invalid requestId');
assert(typeof reqExample.action === 'string', 'request example invalid action');
assert(typeof reqExample.resource?.id === 'string', 'request example invalid resource.id');
assert(['PERMIT', 'STEP_UP', 'ESCALATE', 'DENY'].includes(resExample.decision), 'response example invalid decision');
assert(resExample.receipt?.decision?.outcome === resExample.decision, 'response example decision mismatch');

console.log('Contract artifacts validated successfully.');
