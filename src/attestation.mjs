import {failure} from './errors.mjs';
export function verify_attestation({attestation,subject,requiredType,requiredIssuer,validAt,maxAge,requiredClaims=[]}){const r=[];
if(attestation.subject!==subject) r.push(failure('INVALID_SUBJECT','subject mismatch'));
if(requiredIssuer&&attestation.issuer!==requiredIssuer) r.push(failure('INVALID_ISSUER','issuer mismatch'));
if(requiredType&&attestation.type!==requiredType) r.push(failure('INVALID_INPUT','type mismatch'));
if(new Date(attestation.expiresAt)<new Date(validAt)) r.push(failure('EXPIRED_ATTESTATION','expired'));
if(maxAge){const age=(new Date(validAt)-new Date(attestation.issuedAt))/1000;if(age>maxAge) r.push(failure('STALE_ATTESTATION','stale'));}
for(const c of requiredClaims){if(!(c in (attestation.claims||{}))) r.push(failure('INVALID_INPUT',`missing claim ${c}`));}
const valid=r.length===0;return {valid,subject,attestationRef:attestation.ref,issuer:attestation.issuer,type:attestation.type,trustScoreDelta:valid?attestation.trustScoreDelta??0:undefined,verifiedAt:validAt,failureReasons:r};}
