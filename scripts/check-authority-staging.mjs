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
      RECEIPT_HMAC_SECRET:key,RUNTIME_AUTH_GRANTS_JSON:JSON.stringify(grants)}
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
  const approved=await request(reauth);
  assert.equal(approved.json.decision,'PERMIT','synthetic post-step-up permit');
  assert.notEqual(approved.json.receiptId,stepup.json.receiptId);
  assert.equal(approved.json.receipt.priorReceiptId,stepup.json.receiptId);
  const bad=await fetch(url+'/re/authorize',{
    method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{broken-json'});
  assert.equal(bad.status,400);
  console.log('CFAV synthetic authority HTTP PASS: authentication, scoped grants, freshness, bound receipts, STEP_UP, reauthorization and negative controls.');
  console.log('Not a live GitHub reviewer approval or production deployment.');
}finally{
  if(server){
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>server.once('exit',resolve)),
      new Promise(resolve=>setTimeout(resolve,1500))]);
    if(server.exitCode===null)server.kill('SIGKILL');
  }
  fs.rmSync(tmp,{force:true,recursive:true});
}
