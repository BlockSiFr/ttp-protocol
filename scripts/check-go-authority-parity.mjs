// Independent Go/Node conformance: the Go verifier must validate objects
// issued by the actual PCTR implementation, not by Go fixture serialization.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { issueAuthority, verifyAuthority, createReplayStore } from '../packages/pctr/src/authority.mjs';
import { issueReceipt } from '../packages/pctr/src/receipt.mjs';
import { generateKeyPair, exportPublic } from '../packages/pctr/src/keys.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const now='2026-11-02T22:00:00.000Z';
const key=generateKeyPair();
const publicKey=exportPublic(key.publicKey);
const actual={principal:'user:synthetic',action:'payments.transfer',target:'acct:1',params:{amount:100}};

function checkGo(mode,object,execution=actual){
  const input={mode,authority:mode==='authority'?object:null,
    receipt:mode==='receipt'?object:null,execution,now,trustedKeyPem:publicKey};
  const child=spawnSync('go',['run','./cmd/verify-fixture'],{
    cwd:path.join(root,'sdk/go'),input:JSON.stringify(input),encoding:'utf8',
    timeout:120000,maxBuffer:1024*1024
  });
  if(child.status!==0)throw Error('Go interoperability checker failed: '+child.stderr);
  return JSON.parse(child.stdout);
}
const authority=issueAuthority({principal:actual.principal,action:actual.action,target:actual.target,
  params:actual.params,consequence:'MONEY_MOVED',issuedAt:now,validForSeconds:300,keyPair:key});
assert.equal(verifyAuthority(authority,actual,{now,publicKey,replayStore:createReplayStore()}).allowed,true);
assert.equal(checkGo('authority',authority).allowed,true,'Go must validate real JS signature');
assert.equal(checkGo('authority',authority,{...actual,params:{amount:50000}}).allowed,false,'different amount');
assert.equal(checkGo('authority',authority,{...actual,target:'acct:other'}).allowed,false,'different target');
const fake={...authority,consequence:'NONE'};
assert.equal(checkGo('authority',fake).allowed,false,'modified scope invalid');
const second=generateKeyPair();
const claimed={...second,keyId:key.keyId};
const spoof=issueAuthority({principal:actual.principal,action:actual.action,target:actual.target,
  params:actual.params,consequence:'MONEY_MOVED',issuedAt:now,keyPair:claimed});
assert.equal(checkGo('authority',spoof).allowed,false,'claimed trusted key ID is not signer identity');

const receipt=issueReceipt({
  request:{...actual,agent:'synthetic-agent'},
  preview:{consequence:'MONEY_MOVED',severity:'HIGH',reversible:false,blastRadius:{band:'LIMITED'}},
  route:null,authority,verification:{decision:'EXECUTION_ALLOWED',signerVerified:true,failures:[]},
  result:{status:'SUCCEEDED',output:'synthetic',executedAt:now},
  issuedAt:now,keyPair:key
});
assert.equal(checkGo('receipt',receipt).allowed,true,'Go must verify real JS receipt');
assert.equal(checkGo('receipt',{...receipt,executed:{status:'SUCCEEDED',output:'tampered'}}).allowed,false);
const impossible=issueReceipt({
  request:{...actual},verification:{decision:'EXECUTION_DENIED',failures:[]},
  result:{status:'SUCCEEDED',output:'synthetic'},issuedAt:now,keyPair:key
});
assert.equal(checkGo('receipt',impossible).allowed,false,'signed receipt cannot claim unauthorized effect');
console.log('CFAV Go/JS parity PASS: signed authority, signer identity, exact parameters, trusted receipts and negative controls');
