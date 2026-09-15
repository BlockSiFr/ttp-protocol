import test from 'node:test';import assert from 'node:assert/strict';import {verify_isnad_chain} from '../src/index.mjs';
const link=(issuer,subject,amount,extra={})=>({issuer,subject,amount,scope:['invoice.write'],expiresAt:'2026-12-01T00:00:00Z',proofRefs:['p1'],transferable:true,...extra});
const base={chainId:'isnad-1',rootAuthority:'root:cfo',requestedAction:'invoice.write',currentTime:'2026-06-25T00:00:00Z',minLinkTrust:0.1,maxLength:5,
  links:[link('root:cfo','agent:approver',0.8),link('agent:approver','agent:invoice-bot',0.5)]};

test('continuous rooted chain is valid',()=>{const o=verify_isnad_chain(base);assert.equal(o.valid,true);assert.equal(o.continuous,true);assert.equal(o.terminalSubject,'agent:invoice-bot');});
test('product attenuation multiplies link trust',()=>assert.equal(verify_isnad_chain(base).effectiveTrust,0.4));
test('weakest link is identified',()=>assert.equal(verify_isnad_chain(base).weakestLink.index,1));
test('min attenuation grades by weakest link',()=>assert.equal(verify_isnad_chain({...base,attenuation:'min'}).effectiveTrust,0.5));
test('empty chain is broken',()=>{const o=verify_isnad_chain({...base,links:[]});assert.equal(o.valid,false);assert.equal(o.continuous,false);});
test('root mismatch fails',()=>assert.equal(verify_isnad_chain({...base,rootAuthority:'root:other'}).valid,false));
test('gap breaks continuity',()=>{const o=verify_isnad_chain({...base,links:[link('root:cfo','agent:approver',0.8),link('agent:rogue','agent:invoice-bot',0.5)]});assert.equal(o.valid,false);assert.equal(o.continuous,false);});
test('expired link fails',()=>assert.equal(verify_isnad_chain({...base,links:[link('root:cfo','agent:approver',0.8,{expiresAt:'2026-01-01T00:00:00Z'}),base.links[1]]}).valid,false));
test('out of scope link fails',()=>assert.equal(verify_isnad_chain({...base,requestedAction:'invoice.delete'}).valid,false));
test('weak link below minimum fails',()=>assert.equal(verify_isnad_chain({...base,minLinkTrust:0.6}).valid,false));
test('untrusted narrator fails',()=>assert.equal(verify_isnad_chain({...base,trustedAuthorities:['root:cfo']}).valid,false));
test('non-transferable intermediate breaks chain',()=>assert.equal(verify_isnad_chain({...base,links:[link('root:cfo','agent:approver',0.8,{transferable:false}),base.links[1]]}).valid,false));
test('chain exceeding max length fails',()=>assert.equal(verify_isnad_chain({...base,maxLength:1}).valid,false));
test('monotonic enforcement rejects amplification',()=>assert.equal(verify_isnad_chain({...base,enforceMonotonic:true,links:[link('root:cfo','agent:approver',0.4),link('agent:approver','agent:invoice-bot',0.9)]}).valid,false));
test('chain hash is deterministic',()=>assert.equal(verify_isnad_chain(base).chainHash,verify_isnad_chain(base).chainHash));
