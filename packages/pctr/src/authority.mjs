import crypto from 'node:crypto';
import { hashObj } from './ttp.mjs';
import { defaultKeyPair, signHash, verifyHash, exportPublic, keyIdFor } from './keys.mjs';

// EXECUTION AUTHORITY.
// A valid identity is not enough. A valid credential is not enough. A valid route is
// not enough. Authority is bound to the exact consequential execution, and the
// execution boundary verifies it independently of the agent that requested it.

export function issueAuthority({
  principal, delegator = null, session = null, action, target, params = {},
  constraints = {}, policyVersion = 'local-v1', consequence, route,
  validForSeconds = 300, issuedAt = new Date().toISOString(), keyPair = defaultKeyPair()
}) {
  const materialParams = selectMaterial(params, constraints.materialParams);
  const expiresAt = new Date(new Date(issuedAt).getTime() + validForSeconds * 1000).toISOString();
  const envelope = {
    type: 'TTPExecutionAuthority', version: 1,
    principal, delegator, session,
    action, target, materialParams,
    constraints, policyVersion, consequence,
    routeId: route?.routeId ?? null, routeHash: route?.routeHash ?? null,
    issuedAt, expiresAt, nonce: crypto.randomUUID(),
    // The signer's identity is inside the binding, so a signature cannot be re-attached
    // to the same authority under a different key.
    keyId: keyPair.keyId ?? keyIdFor(keyPair.publicKey)
  };
  const bindingHash = hashObj(envelope);
  return { ...envelope, bindingHash, signature: signHash(bindingHash, keyPair), signerPublicKey: exportPublic(keyPair.publicKey) };
}

// The effect boundary. It re-derives the binding from what is ACTUALLY about to
// execute and compares. A requesting agent cannot enforce its own authority.
export function verifyAuthority(authority, execution, { now = new Date().toISOString(), publicKey, trustedKeyIds, replayStore } = {}) {
  const failures = [];
  const { bindingHash, signature, signerPublicKey, ...envelope } = authority ?? {};
  if (!authority) return deny([{ code: 'AUTHORITY_MISSING', message: 'no execution authority presented' }]);

  if (hashObj(envelope) !== bindingHash) failures.push({ code: 'BINDING_HASH_MISMATCH', message: 'authority contents do not match their binding' });

  // Verifying with a key supplied by the caller is the real check. Falling back to the
  // key carried inside the authority proves only internal consistency, and says so.
  // Never use a self-supplied key ID as evidence that a key is trusted.
  // The key actually used to verify the signature must derive the bound key ID.
  // Pinned publicKey or an independently configured allowlist is the trust anchor.
  const key = publicKey ?? signerPublicKey;
  let derivedKeyId = null;
  try { if (key) derivedKeyId = keyIdFor(key); } catch { /* invalid key is rejected below */ }
  const keyIdentityMatches = derivedKeyId === envelope.keyId;
  const pinnedKey = Boolean(publicKey) || (Array.isArray(trustedKeyIds) && trustedKeyIds.includes(derivedKeyId));
  const signerVerified = keyIdentityMatches && pinnedKey;
  if (key && !keyIdentityMatches) failures.push({ code: 'SIGNER_KEY_ID_MISMATCH', message: 'verifying public key does not derive the claimed signer ID' });
  if (!key) failures.push({ code: 'SIGNATURE_INVALID', message: 'authority carries no verification key' });
  else if (!verifyHash(bindingHash, signature, key)) failures.push({ code: 'SIGNATURE_INVALID', message: 'authority signature does not verify' });
  else if (signature?.keyId !== envelope.keyId) failures.push({ code: 'SIGNER_MISMATCH', message: 'signature key id does not match the key id bound into the authority' });
  if (Array.isArray(trustedKeyIds) && !trustedKeyIds.includes(envelope.keyId)) {
    failures.push({ code: 'UNTRUSTED_SIGNER', message: `authority was signed by ${envelope.keyId}, which is not a trusted signer` });
  }

  if (!pinnedKey) failures.push({ code: 'UNTRUSTED_SIGNER', message: 'an independently pinned verification key or trusted key ID is required' });

  if (new Date(now) > new Date(envelope.expiresAt)) failures.push({ code: 'AUTHORITY_EXPIRED', message: `authority expired at ${envelope.expiresAt}` });
  if (new Date(now) < new Date(envelope.issuedAt)) failures.push({ code: 'AUTHORITY_NOT_YET_VALID', message: 'authority is not yet valid' });

  if (execution.action !== envelope.action) failures.push({ code: 'ACTION_MISMATCH', message: `authority binds ${envelope.action}, execution is ${execution.action}` });
  if (execution.target !== envelope.target) failures.push({ code: 'TARGET_MISMATCH', message: `authority binds ${envelope.target}, execution targets ${execution.target}` });
  if (execution.principal && execution.principal !== envelope.principal) failures.push({ code: 'PRINCIPAL_MISMATCH', message: 'execution principal differs from the authorized principal' });

  // Extra runtime parameters may change the effect. They are not authorized by
  // a signature over only the named subset unless policy explicitly marks them
  // nonmaterial in the signed constraints.
  const signedMaterial = envelope.materialParams ?? {};
  const signedNonmaterial = envelope.constraints?.nonMaterialParams ?? [];
  if (!Array.isArray(signedNonmaterial) ||
      signedNonmaterial.some((key) => typeof key !== 'string')) {
    failures.push({ code: 'INVALID_CONSTRAINTS', message: 'nonmaterial parameter exclusions are malformed' });
  }
  for (const key of Object.keys(execution.params ?? {})) {
    if (!Object.hasOwn(signedMaterial, key) &&
        !(Array.isArray(signedNonmaterial) && signedNonmaterial.includes(key))) {
      failures.push({ code: 'UNBOUND_EXECUTION_PARAMETER', message: `${key} was not bound by the signed authority` });
    }
  }
  const executed = selectMaterial(execution.params ?? {}, Object.keys(envelope.materialParams ?? {}));
  for (const [key, value] of Object.entries(envelope.materialParams ?? {})) {
    if (!deepEqual(executed[key], value)) {
      failures.push({ code: 'PARAMETER_MISMATCH', message: `${key} was authorized as ${JSON.stringify(value)} but is ${JSON.stringify(executed[key])}` });
    }
  }
  for (const [key, limit] of Object.entries(envelope.constraints?.max ?? {})) {
    if (Number(execution.params?.[key]) > Number(limit)) {
      failures.push({ code: 'CONSTRAINT_EXCEEDED', message: `${key} is ${execution.params[key]}, above the authorized maximum of ${limit}` });
    }
  }
  if (envelope.constraints?.requiresApproval && !execution.approval) {
    failures.push({ code: 'APPROVAL_MISSING', message: 'this authority requires a recorded human approval' });
  }
  if (replayStore?.seen(envelope.nonce)) failures.push({ code: 'REPLAYED_AUTHORITY', message: 'this authority has already been spent' });

  if (failures.length === 0) replayStore?.spend(envelope.nonce);
  return failures.length
    ? { ...deny(failures), signerVerified }
    : { allowed: true, decision: 'EXECUTION_ALLOWED', bindingHash, failures: [], verifiedAt: now, signerVerified,
        warnings: signerVerified ? [] : [{ code: 'UNPINNED_KEY', message: 'signature is internally consistent, but the signer was not pinned; pass publicKey or trustedKeyIds to verify who signed it' }] };
}

const deny = (failures) => ({ allowed: false, decision: 'EXECUTION_DENIED', failures });

export function createReplayStore(initial = []) {
  const spent = new Set(initial);
  return { seen: (n) => spent.has(n), spend: (n) => spent.add(n), list: () => [...spent] };
}

function selectMaterial(params, keys) {
  if (!keys?.length) return { ...params };
  return Object.fromEntries(keys.filter((k) => k in params).map((k) => [k, params[k]]));
}
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
