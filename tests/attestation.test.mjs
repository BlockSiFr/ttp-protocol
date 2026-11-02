import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verify_attestation } from '../src/index.mjs';
import { canonicalize } from '../src/util.mjs';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const issuer = 'issuer:enterprise-idp';
const pem = publicKey.export({type:'spki',format:'pem'});
const unsigned = {
  ref:'att-1',subject:'agent:invoice-bot',issuer,type:'workload',
  issuedAt:'2026-04-29T13:00:00Z',expiresAt:'2026-04-29T15:00:00Z',
  claims:{mfa:true},trustScoreDelta:0.1
};
const signed = {
  ...unsigned, signature: { alg:'ed25519',
    value:crypto.sign(null,Buffer.from(canonicalize(unsigned)),privateKey).toString('base64')}
};
const base={attestation:signed,subject:'agent:invoice-bot',
  requiredType:'workload',requiredIssuer:issuer,validAt:'2026-04-29T14:00:00Z',
  maxAge:7200,requiredClaims:['mfa'],trustedIssuerKeys:{[issuer]:pem}};
test('signed attestation verifies against independently provisioned issuer public key',()=>{
  const r=verify_attestation(base);
  assert.equal(r.valid,true);
  assert.equal(r.cryptographicallyVerified,true);
});
test('unsigned attestation fails closed by default',()=>{
  const r=verify_attestation({...base,attestation:unsigned});
  assert.equal(r.valid,false);
  assert.equal(r.cryptographicallyVerified,false);
});
test('a forged issuer key or a modified claim cannot pass',()=>{
  const other=crypto.generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
  assert.equal(verify_attestation({...base,trustedIssuerKeys:{[issuer]:other}}).valid,false);
  assert.equal(verify_attestation({...base,attestation:{...signed,claims:{mfa:false}}}).valid,false);
});
test('wrong subject, issuer, expiry, freshness and claims deny',()=>{
  for(const options of [
    {subject:'someone-else'},{requiredIssuer:'issuer:other'},
    {validAt:'2026-04-29T16:00:00Z'},{maxAge:100},
    {requiredClaims:['nonexistent']}
  ]) assert.equal(verify_attestation({...base,...options}).valid,false);
});
test('future, malformed and revoked attestations deny',()=>{
  assert.equal(verify_attestation({...base,validAt:'2026-04-29T12:00:00Z'}).valid,false);
  assert.equal(verify_attestation({...base,validAt:'not-a-date'}).valid,false);
  assert.equal(verify_attestation({...base,attestation:{...signed,revoked:true}}).valid,false);
});
test('cleartext-dev must be explicitly selected and does not claim cryptographic proof',()=>{
  const r=verify_attestation({...base,attestation:unsigned,verificationMode:'cleartext-dev'});
  assert.equal(r.valid,true);
  assert.equal(r.cryptographicallyVerified,false);
});
