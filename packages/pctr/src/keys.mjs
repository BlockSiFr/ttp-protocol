import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Ed25519 signing, so a receipt can be verified by someone who cannot mint one.
// The key id is derived from the public key, which binds an embedded key to its id:
// swapping in another public key changes the id and breaks any pin against it.

export const keyIdFor = (publicKey) =>
  `ed25519:${crypto.createHash('sha256').update(exportPublic(publicKey)).digest('hex').slice(0, 32)}`;

export function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return { privateKey, publicKey, keyId: keyIdFor(publicKey) };
}

export const exportPublic = (publicKey) =>
  (typeof publicKey === 'string' ? publicKey : publicKey.export({ type: 'spki', format: 'pem' })).trim();

export const exportPrivate = (privateKey) =>
  privateKey.export({ type: 'pkcs8', format: 'pem' });

export const publicKeyFrom = (pem) =>
  (typeof pem === 'string' ? crypto.createPublicKey(pem) : pem);

export function keyPairFromPrivatePem(pem) {
  const privateKey = crypto.createPrivateKey(pem);
  const publicKey = crypto.createPublicKey(privateKey);
  return { privateKey, publicKey, keyId: keyIdFor(publicKey) };
}

// Keys live beside the run store. The private key is written 0600 and is the one file
// in .pctr that must never be committed or shared.
export function loadOrCreateKeyPair(dir) {
  const privatePath = path.join(dir, 'signing-key.pem');
  const publicPath = path.join(dir, 'verification-key.pem');
  if (fs.existsSync(privatePath)) return { ...keyPairFromPrivatePem(fs.readFileSync(privatePath, 'utf8')), path: privatePath, created: false };

  const pair = generateKeyPair();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(privatePath, exportPrivate(pair.privateKey), { mode: 0o600 });
  fs.writeFileSync(publicPath, `${exportPublic(pair.publicKey)}\n`);
  return { ...pair, path: privatePath, created: true };
}

let cached = null;
// Resolution order: an explicit PEM in the environment, then the local key store, then
// an ephemeral in-memory key. An ephemeral key still produces valid signatures — they
// just cannot be verified after the process exits, so it is reported as such.
export function defaultKeyPair({ cwd = process.cwd(), reset = false } = {}) {
  if (reset) cached = null;
  if (cached) return cached;
  if (process.env.PCTR_PRIVATE_KEY) {
    cached = { ...keyPairFromPrivatePem(process.env.PCTR_PRIVATE_KEY), source: 'env:PCTR_PRIVATE_KEY', ephemeral: false };
    return cached;
  }
  try {
    const pair = loadOrCreateKeyPair(path.join(cwd, '.pctr', 'keys'));
    cached = { ...pair, source: pair.path, ephemeral: false };
  } catch {
    cached = { ...generateKeyPair(), source: 'ephemeral (no writable key store)', ephemeral: true };
  }
  return cached;
}

export function signHash(hash, keyPair = defaultKeyPair()) {
  const signature = crypto.sign(null, Buffer.from(hash), keyPair.privateKey).toString('base64');
  return { alg: 'ed25519', keyId: keyPair.keyId ?? keyIdFor(keyPair.publicKey), value: signature };
}

export function verifyHash(hash, signature, publicKey) {
  if (!signature || signature.alg !== 'ed25519' || !signature.value) return false;
  try {
    return crypto.verify(null, Buffer.from(hash), publicKeyFrom(publicKey), Buffer.from(signature.value, 'base64'));
  } catch {
    return false;
  }
}
