import {clamp01} from './util.mjs';
const mult={low:1,medium:1.2,high:1.5};
export function apply_decay({initialTrust,decayConstant,elapsedSeconds,activitySignals=[],riskTier='low',floor=0,ceiling=1,calculatedAt}){const d=initialTrust*Math.exp(-(decayConstant*mult[riskTier]??decayConstant)*elapsedSeconds);let recharge=0;
const appliedSignals=[];for(const s of activitySignals){if(!s.verified)continue;const delta=s.weight*(s.recencyFactor??1);recharge+=delta;appliedSignals.push({...s,delta});}
const finalTrust=Math.max(floor,Math.min(ceiling,clamp01(d+recharge)));
return {initialTrust,decayedTrust:d,finalTrust,elapsedSeconds,decayConstant,riskTier,appliedSignals,calculatedAt};}
