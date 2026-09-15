import crypto from 'node:crypto';
import { hashObj } from '../../../src/util.mjs';
import { defaultKeyPair, signHash, verifyHash, exportPublic, keyIdFor } from './keys.mjs';

// A receipt is not a log line. It is verifiable evidence of what was requested, who
// authorized it, what was bound, what executed, and what resulted. Signing is symmetric
// (HMAC) today: that makes a receipt tamper-evident, not third-party verifiable. Anyone
// holding the signing key can also mint one — asymmetric signing is still to do.

export function issueReceipt({
  request, preview, route, authority, verification, result,
  policyVersion = 'local-v1', priorReceiptHash = null, keyPair = defaultKeyPair(),
  issuedAt = new Date().toISOString()
}) {
  const payload = {
    type: 'PCTRExecutionReceipt', version: 1,
    receiptId: `rcpt-${crypto.randomUUID()}`,
    requested: { action: request.action, target: request.target, params: request.params ?? {} },
    requestedBy: request.agent ?? null,
    principal: authority?.principal ?? request.principal ?? null,
    delegator: authority?.delegator ?? null,
    routeSelected: route ? { routeId: route.routeId, routeHash: route.routeHash, effectiveTrust: route.effectiveTrust, agents: route.agents } : null,
    consequence: preview ? { class: preview.consequence, severity: preview.severity, reversible: preview.reversible, blastRadius: preview.blastRadius } : null,
    authorityBound: authority ? { bindingHash: authority.bindingHash, materialParams: authority.materialParams, constraints: authority.constraints, expiresAt: authority.expiresAt, nonce: authority.nonce, signedBy: authority.keyId ?? null } : null,
    verifier: { boundary: verification?.boundary ?? 'pctr.effect-boundary', decision: verification?.decision ?? 'EXECUTION_DENIED', failures: verification?.failures ?? [], signerVerified: verification?.signerVerified ?? false },
    executed: result ? { status: result.status, output: result.output ?? null, executedAt: result.executedAt ?? issuedAt } : null,
    policyVersion, issuedAt, priorReceiptHash,
    keyId: keyPair.keyId ?? keyIdFor(keyPair.publicKey)
  };
  const receiptHash = hashObj(payload);
  return { ...payload, receiptHash, signature: signHash(receiptHash, keyPair), signerPublicKey: exportPublic(keyPair.publicKey) };
}

export function verifyReceipt(receipt, { publicKey, trustedKeyIds, priorReceiptHash = undefined } = {}) {
  const failures = [];
  const { receiptHash, signature, signerPublicKey, ...payload } = receipt ?? {};
  if (!receipt) return { valid: false, signerVerified: false, failures: [{ code: 'RECEIPT_MISSING', message: 'no receipt provided' }] };
  if (hashObj(payload) !== receiptHash) failures.push({ code: 'RECEIPT_HASH_MISMATCH', message: 'receipt contents were altered after signing' });

  // A third party verifies with a key they already hold. The embedded key can only
  // establish internal consistency, so verification says which of the two happened.
  const key = publicKey ?? signerPublicKey;
  const signerVerified = Boolean(publicKey) || (Array.isArray(trustedKeyIds) && trustedKeyIds.includes(payload.keyId));
  if (!key) failures.push({ code: 'SIGNATURE_INVALID', message: 'receipt carries no verification key' });
  else if (!verifyHash(receiptHash, signature, key)) failures.push({ code: 'SIGNATURE_INVALID', message: 'receipt signature does not verify' });
  else if (signature?.keyId !== payload.keyId) failures.push({ code: 'SIGNER_MISMATCH', message: 'signature key id does not match the key id inside the receipt' });
  if (Array.isArray(trustedKeyIds) && !trustedKeyIds.includes(payload.keyId)) {
    failures.push({ code: 'UNTRUSTED_SIGNER', message: `receipt was signed by ${payload.keyId}, which is not a trusted signer` });
  }
  if (priorReceiptHash !== undefined && payload.priorReceiptHash !== priorReceiptHash) {
    failures.push({ code: 'CHAIN_BROKEN', message: 'receipt does not chain to the expected prior receipt' });
  }
  if (payload.executed && payload.verifier?.decision !== 'EXECUTION_ALLOWED') {
    failures.push({ code: 'EXECUTED_WITHOUT_AUTHORITY', message: 'receipt records an execution that was not allowed' });
  }
  return {
    valid: failures.length === 0, receiptId: payload.receiptId, signerVerified, keyId: payload.keyId, failures,
    warnings: failures.length === 0 && !signerVerified
      ? [{ code: 'UNPINNED_KEY', message: 'signature is internally consistent, but the signer was not pinned; pass publicKey or trustedKeyIds to verify who signed it' }]
      : []
  };
}

// Receipts chain, so a missing or reordered receipt is detectable.
export function verifyReceiptChain(receipts, opts = {}) {
  const failures = [];
  let prior = null;
  for (const r of receipts) {
    const res = verifyReceipt(r, { ...opts, priorReceiptHash: prior });
    if (!res.valid) failures.push({ receiptId: r.receiptId, failures: res.failures });
    prior = r.receiptHash;
  }
  return { valid: failures.length === 0, length: receipts.length, failures };
}
