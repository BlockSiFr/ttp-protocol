import crypto from 'node:crypto';
export const clamp01=(n)=>Math.max(0,Math.min(1,n));
export function canonicalize(v){
  if(Array.isArray(v)) return `[${v.map(canonicalize).join(',')}]`;
  if(v&&typeof v==='object'){const keys=Object.keys(v).sort();return `{${keys.map(k=>`${JSON.stringify(k)}:${canonicalize(v[k])}`).join(',')}}`;}
  if(typeof v==='number') return Number(v.toFixed(6)).toString();
  return JSON.stringify(v);
}
export const hashObj=(obj)=>`sha256:${crypto.createHash('sha256').update(canonicalize(obj)).digest('hex')}`;
