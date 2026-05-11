import test from 'node:test';import assert from 'node:assert/strict';import {prove_trust_threshold} from '../src/index.mjs';
const b={subject:'agent:invoice-bot',dimension:'execution',evaluatedAt:'2026-04-29T14:00:00Z'};
test('above threshold',()=>assert.equal(prove_trust_threshold({...b,trustScore:0.8,requiredThreshold:0.7}).satisfied,true));
test('equal threshold',()=>assert.equal(prove_trust_threshold({...b,trustScore:0.7,requiredThreshold:0.7}).satisfied,true));
test('below threshold',()=>assert.equal(prove_trust_threshold({...b,trustScore:0.6,requiredThreshold:0.7}).satisfied,false));
test('invalid score',()=>assert.ok(prove_trust_threshold({...b,trustScore:2,requiredThreshold:0.7}).failureReasons.length));
test('invalid threshold',()=>assert.ok(prove_trust_threshold({...b,trustScore:0.8,requiredThreshold:2}).failureReasons.length));
test('hash changes',()=>assert.notEqual(prove_trust_threshold({...b,trustScore:0.8,requiredThreshold:0.7}).proofHash,prove_trust_threshold({...b,trustScore:0.81,requiredThreshold:0.7}).proofHash));
