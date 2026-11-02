import test from 'node:test';
import assert from 'node:assert/strict';
import { issueAuthority, verifyAuthority, createReplayStore } from '../src/authority.mjs';
import { issueReceipt, verifyReceipt } from '../src/receipt.mjs';
import { generateKeyPair, exportPublic, signHash } from '../src/keys.mjs';
import { hashObj } from '../src/ttp.mjs';

const at = '2026-11-02T22:00:00.000Z';
const key = generateKeyPair();
const pinned = exportPublic(key.publicKey);
const request = { principal:'user:synthetic', action:'payments.transfer',
  target:'acct:1',params:{amount:100} };
const issue = () => issueAuthority({ ...request, consequence:'MONEY_MOVED',
  issuedAt:at, validForSeconds:300, keyPair:key });
const verify = (authority, now=at) => verifyAuthority(authority,request,
  {publicKey:pinned,replayStore:createReplayStore(),now});
function reSign(auth, changes){
  const {bindingHash:_oldHash,signature:_oldSig,signerPublicKey:_oldPub,...envelope}=auth;
  const updated={...envelope,...changes};
  const bindingHash=hashObj(updated);
  return {...updated,bindingHash,signature:signHash(bindingHash,key),
    signerPublicKey:pinned};
}
test('CFAV: signed invalid or inverted timestamps can never authorize',()=>{
  for(const changes of [
    {expiresAt:'not-a-time'},
    {issuedAt:'not-a-time'},
    {issuedAt:'2026-11-02T22:05:00.000Z',expiresAt:'2026-11-02T22:00:00.000Z'}
  ]){
    const proof=reSign(issue(),changes);
    const r=verify(proof);
    assert.equal(r.allowed,false);
    assert.ok(r.failures.some(f=>f.code==='AUTHORITY_TIME_INVALID'));
  }
  assert.equal(verify(issue(),'not-a-time').allowed,false);
});
test('CFAV: exact expiry is not a valid authorization instant',()=>{
  const r=verify(issue(),'2026-11-02T22:05:00.000Z');
  assert.equal(r.allowed,false);
  assert.ok(r.failures.some(f=>f.code==='AUTHORITY_EXPIRED'));
});
test('CFAV: future-dated receipts cannot become proof of prior execution',()=>{
  const make=(issuedAt)=>issueReceipt({
    request,verification:{decision:'EXECUTION_DENIED',failures:[]},
    result:null,issuedAt,keyPair:key
  });
  const future=make('2026-11-03T22:00:00.000Z');
  const r=verifyReceipt(future,{publicKey:pinned,now:at});
  assert.equal(r.valid,false);
  assert.ok(r.failures.some(f=>f.code==='RECEIPT_TIME_INVALID'));
  assert.equal(verifyReceipt(make(at),{publicKey:pinned,now:at}).valid,true);
  assert.equal(verifyReceipt(make(at),{publicKey:pinned,now:'bad'}).valid,false);
});
