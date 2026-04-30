import {failure} from './errors.mjs';import {hashObj} from './util.mjs';
export function prove_trust_threshold(input){const {subject,trustScore,requiredThreshold,dimension,evaluatedAt,proofMode='plain',evidenceRefs=[]}=input;const reasons=[];
if(trustScore<0||trustScore>1) reasons.push(failure('INVALID_TRUST_SCORE','trustScore out of range'));
if(requiredThreshold<0||requiredThreshold>1) reasons.push(failure('INVALID_THRESHOLD','requiredThreshold out of range'));
const satisfied=reasons.length===0&&trustScore>=requiredThreshold;
const envelope={type:'TrustThresholdProof',subject,dimension,requiredThreshold,trustScore,satisfied,evaluatedAt,proofMode,evidenceRefs};
return {...envelope,proofHash:hashObj(envelope),failureReasons:reasons};}
