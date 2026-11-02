#!/usr/bin/env node
// Synthetic local staging harness: no cloud calls, no real GitHub approvals.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ttp-cfav-authority-'));
const token='synthetic-token-'+crypto.randomBytes(32).toString('hex');
const key='synthetic-hmac-'+crypto.randomBytes(32).toString('hex');
const now=new Date();
const verifiedAt=new Date(now.getTime()-15000).toISOString();
const validUntil=new Date(now.getTime()+1800000).toISOString();
const expired=new Date(now.getTime()-60000).toISOString();
const grant=(updates={})=>({
  subject:'wi://github/actions/runner',repo:'BlockSiFr/ttp-protocol',
  action:'pull_request.execute',branch:'cfav-synthetic-branch',
  trustScore:0.95,verifiedAt,expiresAt:validUntil,...updates
});
const grants={
  'grant-valid':grant(),
  'grant-revoked':grant({revoked:true}),
  'grant-expired':grant({expiresAt:expired}),
  'grant-stale':grant({verifiedAt:new Date(now.getTime()-1000000).toISOString()}),
  'grant-other-tenant':grant({repo:'other/tenant'})
};
const config=path.join(root,'services/authority/tsconfig.json');
const tsc=path.join(root,'reference-implementations/trust-authority/node_modules/.bin/tsc');
const compiled=path.join(tmp,'compiled');
const build=spawnSync(tsc,['-p',config,'--noEmit','false','--outDir',compiled],
  {cwd:root,encoding:'utf8',timeout:120000});
if(build.status!==0)throw Error('cannot compile authority: '+build.stderr+build.stdout);
const binary=path.join(compiled,'index.js');
assert.ok(fs.existsSync(binary),'compiled authority entry missing');
const require=createRequire(import.meta.url);
const {assessApprovalHistory}=require(path.join(compiled,'approvalVerifier.js'));
const {consumeStepUpReceipt}=require(path.join(compiled,'replayLedger.js'));
const {openReceiptLedger}=require(path.join(compiled,'receiptLedger.js'));
const receiptFile=path.join(tmp,'signed-receipts','receipts.jsonl');
process.env.RECEIPT_HMAC_SECRET=key;

const replayDir=path.join(tmp,'durable-ledger');
assert.equal(consumeStepUpReceipt('step-up-fixture',replayDir).accepted,true,
  'first step-up redemption can be durably recorded');
assert.equal(consumeStepUpReceipt('step-up-fixture',replayDir).reason,'STEP_UP_ALREADY_CONSUMED',
  'second attempt is denied');
assert.equal(consumeStepUpReceipt('step-up-other',replayDir).accepted,true);
assert.equal(consumeStepUpReceipt('step-up-new','relative/path').accepted,false,
  'relative or operator-unconfigured store denied');
const restartProbe=spawnSync(process.execPath,['-e',
  'const r=require(process.argv[1]); if(r.consumeStepUpReceipt("step-up-fixture",process.argv[2]).accepted) process.exit(7)',
  path.join(compiled,'replayLedger.js'),replayDir],{cwd:root,timeout:10000});
assert.equal(restartProbe.status,0,'a separate process cannot redeem the same STEP_UP receipt');

const claimed={
  repo:'BlockSiFr/ttp-protocol',workflowRunId:'111222333',
  commitSha:'a'.repeat(40),branch:'cfav-synthetic-branch',
  resource:'repo:BlockSiFr/ttp-protocol:pr/100',
  invokingActor:'synthetic-contributor',reviewer:'independent-synthetic-reviewer'
};
const history=[{state:'approved',user:{login:claimed.reviewer},
  environments:[{name:'protected-execution'}]}];
assert.equal(assessApprovalHistory(history,claimed,'synthetic-pr-author',
  claimed.commitSha,claimed.branch).verified,true,
  'independent positive fixture requires correct GitHub payload');
for(const [entries,author,sha,ref] of [
  [[], 'synthetic-pr-author',claimed.commitSha,claimed.branch],
  [history,claimed.reviewer,claimed.commitSha,claimed.branch],
  [history,'synthetic-pr-author','b'.repeat(40),claimed.branch],
  [history,'synthetic-pr-author',claimed.commitSha,'other-branch'],
  [[{...history[0],state:'rejected'}],'synthetic-pr-author',claimed.commitSha,claimed.branch],
  [[{...history[0],environments:[{name:'another-environment'}]}],
    'synthetic-pr-author',claimed.commitSha,claimed.branch]
]){
  assert.equal(assessApprovalHistory(entries,claimed,author,sha,ref).verified,false,
    'fake, wrong, revoked or mismatched approval must deny');
}


const probe=net.createServer();
const port=await new Promise((resolve,reject)=>{
  probe.once('error',reject);
  probe.listen(0,'127.0.0.1',()=>resolve(probe.address().port));
});
await new Promise(resolve=>probe.close(resolve));
let server;
try{
  server=spawn(process.execPath,[binary],{
    cwd:root,stdio:['ignore','pipe','pipe'],
    env:{...process.env,PORT:String(port),RUNTIME_AUTH_TOKEN:token,
      RECEIPT_HMAC_SECRET:key,RUNTIME_AUTH_GRANTS_JSON:JSON.stringify(grants),
      RUNTIME_AUTH_RECEIPT_LEDGER_PATH:receiptFile}
  });
  let stderr='';
  server.stderr.on('data',chunk=>{stderr+=chunk.toString().slice(0,2000)});
  const url='http://127.0.0.1:'+port;
  let healthy=false;
  for(let i=0;i<70;i++){
    if(server.exitCode!==null)throw Error('authority exited: '+stderr);
    try {
      const result=await fetch(url+'/healthz',{signal:AbortSignal.timeout(600)});
      if(result.status===200){healthy=true;break}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(healthy,'synthetic authority did not listen');

  const base={
    subject:'wi://github/actions/runner',action:'pull_request.execute',
    resource:'repo:BlockSiFr/ttp-protocol:pr/100',repo:'BlockSiFr/ttp-protocol',
    branch:'cfav-synthetic-branch',pathsTouched:['docs/README.md'],
    commitSha:'a'.repeat(40),invokingActor:'synthetic-contributor',
    workflowRunId:'111222333',attestationRef:'synthetic-only',
    authorityGrantRef:'grant-valid',context:{event:'pull_request'}
  };
  async function request(body,suppliedToken=token){
    const r=await fetch(url+'/re/authorize',{
      method:'POST',
      headers:{'content-type':'application/json',
        ...(suppliedToken?{authorization:'Bearer '+suppliedToken}:{})},
      body:JSON.stringify(body)
    });
    return {status:r.status,json:await r.json()};
  }
  for(const auth of ['','forged-caller']){
    const r=await request(base,auth);
    assert.equal(r.status,401,'invalid bearer');
  }
  for(const ref of ['absent','grant-revoked','grant-expired','grant-other-tenant']){
    const r=await request({...base,authorityGrantRef:ref,trustScore:1,freshnessSeconds:0});
    assert.equal(r.json.decision,'DENY','missing, revoked, expired or mismatched grant');
  }
  const stale=await request({...base,authorityGrantRef:'grant-stale',trustScore:1,freshnessSeconds:0});
  assert.notEqual(stale.json.decision,'PERMIT','stale grant cannot permit');
  const allowed=await request({...base,trustScore:0,freshnessSeconds:999999});
  assert.equal(allowed.status,200);
  assert.equal(allowed.json.decision,'PERMIT','must rely on operator grant');
  assert.equal(allowed.json.receipt.commitSha,base.commitSha);
  assert.equal(allowed.json.receipt.pathsTouched[0],base.pathsTouched[0]);
  assert.equal(allowed.json.receipt.workflowRunId,base.workflowRunId);
  const {signature,...unsigned}=allowed.json.receipt;
  const digest='hmac-sha256:'+crypto.createHmac('sha256',key).update(JSON.stringify(unsigned)).digest('hex');
  assert.equal(signature,digest,'receipt HMAC verified using provisioned fixture key');

  const protectedReq={...base,pathsTouched:['.github/workflows/ci.yml']};
  const stepup=await request(protectedReq);
  assert.equal(stepup.json.decision,'STEP_UP');
  const reauth={...protectedReq,action:'merge request reauthorize',
    priorReceiptId:stepup.json.receiptId,
    approval:{environment:'protected-execution',approved:true,approvedBy:'independent-synthetic-reviewer'}};
  assert.equal((await request({...reauth,priorReceiptId:allowed.json.receiptId})).json.decision,'DENY');
  assert.equal((await request({...reauth,commitSha:'b'.repeat(40)})).json.decision,'DENY');
  assert.equal((await request({...reauth,pathsTouched:['.github/workflows/other.yml']})).json.decision,'DENY');
  assert.equal((await request({...reauth,approval:undefined})).json.decision,'DENY');
  const malformedApproval=await request({...reauth,approval:{approved:true,approvedBy:123,environment:'protected-execution'}});
  assert.equal(malformedApproval.status,400,'malformed GitHub reviewer claim must not crash the service');
  const approved=await request(reauth);
  assert.equal(approved.json.decision,'DENY',
    'caller-supplied approval cannot permit without independent GitHub API verification');
  assert.equal(approved.json.reason,'GITHUB_APPROVAL_VERIFIER_UNCONFIGURED');
  assert.equal(approved.json.receipt.priorReceiptId,stepup.json.receiptId);
  const bad=await fetch(url+'/re/authorize',{
    method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{broken-json'});
  assert.equal(bad.status,400);
  // A gracefully restarted service must recover signed prior decisions from
  // the same persisted ledger. Corrupting that ledger must deny startup.
  server.kill('SIGTERM');
  await new Promise((resolve,reject)=>{
    if(server.exitCode!==null){resolve();return}
    server.once('exit',resolve);
    setTimeout(()=>reject(new Error('staging authority did not stop cleanly')),3000);
  });
  server=undefined;
  const restored=openReceiptLedger(receiptFile);
  assert.ok(restored.count()>=4,'every authority decision must be durable');
  assert.equal(restored.get(allowed.json.receiptId)?.decision,'PERMIT');
  assert.equal(restored.get(stepup.json.receiptId)?.decision,'STEP_UP');
  assert.equal(restored.get(approved.json.receiptId)?.decision,'DENY');
  assert.ok(restored.lastHash()?.startsWith('sha256:'));
  assert.throws(()=>openReceiptLedger(receiptFile),/EEXIST/,
    'two authority services cannot fork the same signed chain');
  restored.close();
  const persisted=fs.readFileSync(receiptFile,'utf8');
  fs.writeFileSync(receiptFile,persisted.replace('"decision":"PERMIT"','"decision":"DENY"'));
  assert.throws(()=>openReceiptLedger(receiptFile),/RECEIPT_LEDGER_(CHAIN_BROKEN|SIGNATURE_INVALID)/,
    'tampered receipt chain cannot authorize after restart');
  console.log('CFAV synthetic authority HTTP PASS: credentials, scoped grants, STEP_UP, fake approval denial and evidence binding.');
  console.log('Pure GitHub history fixtures include positive and negative assertions; live authorization remains unverified.');
}finally{
  if(server){
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>server.once('exit',resolve)),
      new Promise(resolve=>setTimeout(resolve,1500))]);
    if(server.exitCode===null)server.kill('SIGKILL');
  }
  fs.rmSync(tmp,{force:true,recursive:true});
}
