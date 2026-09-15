// Single adapter point onto the TTP protocol primitives, so PCTR depends on TTP
// in exactly one place. In-repo this resolves by path; published it resolves by package.
export { apply_decay, verify_trust_route, generate_trust_proof } from '../../../src/index.mjs';
