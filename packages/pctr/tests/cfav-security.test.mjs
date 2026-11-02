import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/graph.mjs';
import { classifyAction } from '../src/consequences.mjs';
import { issueAuthority, verifyAuthority } from '../src/authority.mjs';
import { issueReceipt, verifyReceipt } from '../src/receipt.mjs';
import { generateKeyPair, exportPublic } from '../src/keys.mjs';
import { protect } from '../src/protect.mjs';

const graph = () => buildGraph({
  principal: 'user:synthetic',
  agents: [{id:'agent', trust:0.99, evidenceAgeSeconds:1, authority:['payments.*'],tools:['payments']}],
  tools:[{id:'payments',actions:['payments.transfer']}],
  actions:[{id:'payments.transfer',amount:100}],
  policy:{}
});
const signedEvidence = (key) => issueReceipt({
  request:{action:'payments.transfer',target:'acct:test',params:{amount:100}},
  route:{routeId:'fixture',routeHash:'sha256:fixture',agents:['agent'],effectiveTrust:0.95},
  verification:{decision:'EXECUTION_ALLOWED',failures:[],signerVerified:true},
  result:{status:'SUCCEEDED',output:'synthetic',executedAt:new Date().toISOString()},
  issuedAt:new Date().toISOString(),
  keyPair:key
});
test('CFAV: an attacker cannot claim a trusted key ID with a different private key', () => {
  const trusted=generateKeyPair(),attacker=generateKeyPair();
  const counterfeit={...attacker,keyId:trusted.keyId};
  const authority=issueAuthority({principal:'user:synthetic',action:'payments.transfer',
    target:'acct:1',params:{amount:100},keyPair:counterfeit});
  const execution={principal:'user:synthetic',action:'payments.transfer',target:'acct:1',params:{amount:100}};
  const forged=verifyAuthority(authority,execution,{trustedKeyIds:[trusted.keyId]});
  assert.equal(forged.allowed,false);
  assert.ok(forged.failures.some(x=>x.code==='SIGNER_KEY_ID_MISMATCH'));
  const receipt=signedEvidence(counterfeit);
  const verdict=verifyReceipt(receipt,{trustedKeyIds:[trusted.keyId]});
  assert.equal(verdict.valid,false);
  assert.equal(verdict.signerVerified,false);
  assert.ok(verdict.failures.some(x=>x.code==='SIGNER_KEY_ID_MISMATCH'));
});
test('CFAV: embedded self-supplied authority key cannot authorize without a trusted anchor',()=>{
  const key=generateKeyPair();
  const authority=issueAuthority({principal:'user:synthetic',action:'payments.transfer',
    target:'acct:1',params:{amount:100},keyPair:key});
  const execution={principal:'user:synthetic',action:'payments.transfer',target:'acct:1',params:{amount:100}};
  const v=verifyAuthority(authority,execution);
  assert.equal(v.allowed,false);
  assert.ok(v.failures.some(x=>x.code==='UNTRUSTED_SIGNER'));
  assert.equal(verifyAuthority(authority,execution,{publicKey:exportPublic(key.publicKey)}).allowed,true);
});
test('CFAV: a sensitive read is never downgraded by a read verb or manifest hints',()=>{
  for(const name of ['vault.read','secret.get','credential.read','token.get','password.read','api_key.read']){
    const result=classifyAction(name,{consequence:'DATA_READ',severity:'LOW'});
    assert.equal(result.consequence,'SECRET_EXPOSED',name);
    assert.equal(result.severity,'CRITICAL',name);
  }
  const g=buildGraph({principal:'p',agents:[{id:'a',tools:['t']}],tools:[{id:'t',actions:['vault.read']}],
    actions:[{id:'vault.read',consequence:'NONE',severity:'LOW'}]});
  assert.equal(g.nodes.get('vault.read').severity,'CRITICAL');
  assert.equal(g.nodes.get('vault.read').consequence,'SECRET_EXPOSED');
  assert.equal(classifyAction('payments.status').consequence,'DATA_READ');
});
test('CFAV: no unsigned or self-supplied measurements authorize a high-risk real effect',async()=>{
  let called=0;
  const r=await protect(graph(),{action:'payments.transfer',params:{amount:100}},{
    measurements:{agent:{proven:true,trust:1}},execute:()=>{called++;return 'sent';}
  });
  assert.equal(r.allowed,false);
  assert.equal(called,0);
  assert.ok(r.receipt.verifier.failures.some(x=>x.code==='SIGNED_BEHAVIORAL_EVIDENCE_REQUIRED'));
});
test('CFAV: lowballing a high-risk preview is rejected before effect',async()=>{
  const r=await protect(graph(),{action:'payments.transfer',params:{amount:100}},
    {preview:{severity:'LOW',consequence:'NONE'},execute:()=>{throw Error('unexpected effect')}});
  assert.equal(r.allowed,false);
  assert.ok(r.receipt.verifier.failures.some(x=>x.code==='CONSEQUENCE_UNDERSTATED'));
});
test('CFAV: asynchronous success settles before a success receipt',async()=>{
  const key=generateKeyPair();
  const r=await protect(graph(),{action:'payments.transfer',params:{amount:100}},{
    keyPair:key,trustedEvidenceKeyIds:[key.keyId],evidenceReceipts:[signedEvidence(key)],
    execute:async()=>{await Promise.resolve();return 'settled';}
  });
  assert.equal(r.allowed,true);
  assert.equal(r.result.status,'SUCCEEDED');
  assert.equal(r.receipt.executed.status,'SUCCEEDED');
  assert.equal(r.receipt.executed.output,'settled');
});
test('CFAV: asynchronous rejected effect is never recorded as succeeded',async()=>{
  const key=generateKeyPair();
  const r=await protect(graph(),{action:'payments.transfer',params:{amount:100}},{
    keyPair:key,trustedEvidenceKeyIds:[key.keyId],evidenceReceipts:[signedEvidence(key)],
    execute:async()=>{await Promise.resolve();throw Error('synthetic failure');}
  });
  assert.equal(r.allowed,true); // authorization permitted, but effect failed.
  assert.equal(r.result.status,'FAILED');
  assert.equal(r.receipt.executed.status,'FAILED');
  assert.equal(r.receipt.executed.output,null);
});
