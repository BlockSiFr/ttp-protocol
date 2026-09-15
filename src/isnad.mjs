import {failure} from './errors.mjs';import {clamp01,hashObj} from './util.mjs';
// Isnad-chain trust: verifies a chain of trust transmission ("isnad") from a trusted
// root authority down to a terminal subject. A chain is sound when it is continuous
// (muttasil — every link's issuer is the prior link's subject), rooted at the trusted
// source, every link is individually valid, and trust attenuates along the chain.
const ATTENUATION=['product','min','none'];
export function verify_isnad_chain(i){
  const r=[];
  const links=i.links||[];
  const action=i.requestedAction;
  const minLinkTrust=i.minLinkTrust??0;
  const trusted=i.trustedAuthorities;
  const attenuation=ATTENUATION.includes(i.attenuation)?i.attenuation:'product';
  if(!links.length)r.push(failure('ISNAD_BROKEN_LINK','empty chain'));
  if(i.maxLength!=null&&links.length>i.maxLength)r.push(failure('ISNAD_TOO_LONG','chain exceeds max length'));
  if(links.length&&i.rootAuthority&&links[0].issuer!==i.rootAuthority)r.push(failure('ISNAD_ROOT_MISMATCH','chain does not originate at root authority'));
  let eff=1,minAmt=1,weakest=null,prevAmt=Infinity;
  for(let idx=0;idx<links.length;idx++){
    const l=links[idx];
    if(!l.issuer||!l.subject)r.push(failure('INVALID_INPUT',`link ${idx} missing identity`));
    if(l.issuer===l.subject&&!i.allowSelf)r.push(failure('ISNAD_BROKEN_LINK',`link ${idx} self transmission`));
    if(idx>0&&l.issuer!==links[idx-1].subject)r.push(failure('ISNAD_BROKEN_LINK',`gap between link ${idx-1} and ${idx}`));
    if(new Date(l.expiresAt)<new Date(i.currentTime))r.push(failure('ISNAD_LINK_EXPIRED',`link ${idx} expired`));
    if(action&&!(l.scope||[]).includes(action))r.push(failure('ISNAD_SCOPE_VIOLATION',`link ${idx} out of scope`));
    if(idx<links.length-1&&l.transferable===false)r.push(failure('ISNAD_SCOPE_VIOLATION',`link ${idx} not transferable onward`));
    if(trusted&&!trusted.includes(l.issuer))r.push(failure('ISNAD_UNTRUSTED_NARRATOR',`link ${idx} issuer not trusted`));
    if((l.proofRefs||[]).some(p=>!p))r.push(failure('INVALID_INPUT',`link ${idx} invalid proof ref`));
    const amt=l.amount;
    if(typeof amt!=='number'||amt<0||amt>1)r.push(failure('TRANSFER_INVALID',`link ${idx} amount invalid`));
    else{if(amt<minLinkTrust)r.push(failure('ISNAD_WEAK_LINK',`link ${idx} below minimum link trust`));
      if(i.enforceMonotonic&&amt>prevAmt)r.push(failure('ISNAD_TRUST_AMPLIFIED',`link ${idx} amplifies trust`));
      prevAmt=amt;eff*=amt;if(amt<minAmt){minAmt=amt;weakest={index:idx,issuer:l.issuer,subject:l.subject,amount:amt};}}
  }
  const effectiveTrust=!links.length?0:attenuation==='min'?clamp01(minAmt):attenuation==='none'?clamp01(links[links.length-1].amount??0):clamp01(eff);
  const continuous=!r.some(f=>f.code==='ISNAD_BROKEN_LINK');
  const terminalSubject=links.length?links[links.length-1].subject:undefined;
  const envelope={type:'IsnadChainProof',chainId:i.chainId,rootAuthority:i.rootAuthority,terminalSubject,action,length:links.length,continuous,attenuation,effectiveTrust,weakestLink:weakest};
  return {...envelope,chainHash:hashObj({...envelope,links}),valid:r.length===0,failureReasons:r};
}
