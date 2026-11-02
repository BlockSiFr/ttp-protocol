import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const workflow = fs.readFileSync('.github/workflows/governed-execution.yml', 'utf8')

test('governance executes trusted base-branch workflow without checking out pull request code', () => {
  assert.match(workflow, /pull_request_target:/)
  assert.doesNotMatch(workflow, /^\s*- uses:\s*actions\/checkout@/m)
  assert.doesNotMatch(workflow, /git\s+checkout\s+/)
  assert.doesNotMatch(workflow, /ttp-local-authorize/)
})

test('PR metadata is parsed from event JSON and never shell-interpolated directly', () => {
  assert.match(workflow, /GITHUB_EVENT_PATH/)
  assert.match(workflow, /\.pull_request\.head\.ref/)
  assert.doesNotMatch(workflow, /\$\{\{\s*github\.head_ref\s*\}\}/)
  assert.doesNotMatch(workflow, /\$\{\{\s*steps\.changes\.outputs\.paths\s*\}\}/)
})

test('runtime authority must be present, HTTPS, and fail closed', () => {
  assert.match(workflow, /RUNTIME_AUTH_URL/)
  assert.match(workflow, /RUNTIME_AUTH_TOKEN/)
  assert.match(workflow, /AUTH_URL.*https:\/\//)
  assert.match(workflow, /no local authorization fallback/)
  assert.match(workflow, /runtime authority unreachable or rejected request/)
})

test('runtime decision must be bound to the exact PR and receipts', () => {
  for (const field of ['receiptId', 'decision', 'repo', 'commitSha', 'workflowRunId', 'pathsTouched', 'resource']) {
    assert.ok(workflow.includes('.receipt.' + field), 'required receipt binding: ' + field)
  }
  assert.match(workflow, /protected authority\/policy paths require STEP_UP/)
  assert.match(workflow, /protected-execution/)
  assert.match(workflow, /GOVERN_RESULT.*success/)
  assert.match(workflow, /STEP_UP_RESULT.*success/)
})

test('governance token has no write permissions', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read\s*\n\s*pull-requests: read/)
  assert.doesNotMatch(workflow, /^\s*(?:contents|pull-requests): write\s*$/m)
})

test('CFAV: protected step-up requires fresh independently reviewed execution authority', () => {
  assert.match(workflow, /Reauthorize After Independent Approval/);
  assert.match(workflow, /actions\/runs\/\$GITHUB_RUN_ID\/approvals/);
  assert.match(workflow, /protected-execution/);
  assert.match(workflow, /priorReceiptId/);
  assert.match(workflow, /REAUTH_RESULT/);
  assert.match(workflow, /REAUTH_DECISION/);
  assert.match(workflow, /REAUTH_RECEIPT/);
  assert.match(workflow, /independent reauthorization after approval not proven/);
  assert.match(workflow, /RUNTIME_AUTH_GRANT_REF/);
});

test('CFAV: authority starter cannot accept unauthenticated users or default signing secrets', () => {
  const authority=fs.readFileSync('services/authority/index.ts','utf8');
  const signer=fs.readFileSync('services/authority/receiptSigner.ts','utf8');
  assert.match(authority,/timingSafeEqual/);
  assert.match(authority,/if \(!validBearer\(req.headers.authorization\)\)/);
  assert.match(authority,/verifiedGrant\(req\)/);
  assert.match(authority,/prior_receipt_binding_or_freshness_mismatch/);
  assert.doesNotMatch(signer,/dev-only-secret/);
  assert.match(signer,/RECEIPT_HMAC_SECRET/);
});

test('CFAV: starter authority never exposes bearer authentication on an unrestricted HTTP listener',()=>{
  const authority=fs.readFileSync('services/authority/index.ts','utf8');
  assert.match(authority,/server\.listen\(port, "127\.0\.0\.1"/);
  assert.match(authority,/PORT must be an integer/);
});
