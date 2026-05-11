import {hashObj} from './util.mjs';
export function generate_trust_proof(i){const valid=!!(i.trustThresholdProof?.satisfied&&i.routeResult?.valid&&i.delegationResults?.every(d=>d.valid)&&i.attestationResults?.every(a=>a.valid));
const evidence={thresholdProof:i.trustThresholdProof?.proofHash,attestations:i.attestationResults?.map(a=>a.attestationRef)||[],delegations:i.delegationResults?.map((d,idx)=>d.ref||`del-${idx}`)||[],route:i.routeResult?.routeId,decay:i.decayResult?.calculatedAt};
const envelope={type:'CompositeTrustProof',subject:i.subject,action:i.action,resource:i.resource,valid,proofMode:i.proofMode,evidence,generatedAt:i.generatedAt};
return {...envelope,proofHash:hashObj(envelope),failureReasons:valid?[]:[{code:'INVALID_INPUT',message:'one or more subproofs invalid'}]};}
