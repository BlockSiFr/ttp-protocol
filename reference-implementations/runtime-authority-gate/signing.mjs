import crypto from 'node:crypto';
import fs from 'node:fs';

const SIGNING_MODE = process.env.RECEIPT_SIGNING_MODE ?? 'HMAC';
const HMAC_SECRET = process.env.RECEIPT_HMAC_SECRET ?? 'local-dev-secret';
const PRIVATE_KEY_PATH = process.env.RECEIPT_PRIVATE_KEY_PATH ?? '';
const PUBLIC_KEY_PATH = process.env.RECEIPT_PUBLIC_KEY_PATH ?? '';

function readKey(pathValue) {
  if (!pathValue || !fs.existsSync(pathValue)) return null;
  return fs.readFileSync(pathValue, 'utf8');
}

export function signHash(hash) {
  if (SIGNING_MODE === 'RS256') {
    const privateKey = readKey(PRIVATE_KEY_PATH);
    if (!privateKey) {
      return {
        signatureStatus: 'FAILED_VERIFICATION',
        signature: '',
        signatureAlg: 'RS256',
        signatureRef: 'missing-private-key',
        signingKeyRef: PRIVATE_KEY_PATH
      };
    }

    return {
      signatureStatus: 'SIGNED',
      signature: crypto.sign('RSA-SHA256', Buffer.from(hash), privateKey).toString('base64'),
      signatureAlg: 'RS256',
      signatureRef: 'local-rs256',
      signingKeyRef: PRIVATE_KEY_PATH
    };
  }

  return {
    signatureStatus: 'SIGNED',
    signature: crypto.createHmac('sha256', HMAC_SECRET).update(hash).digest('base64'),
    signatureAlg: 'HMAC-SHA256',
    signatureRef: 'local-hmac',
    signingKeyRef: 'RECEIPT_HMAC_SECRET'
  };
}

export function verifyHash(hash, signature, signatureAlg) {
  if (signatureAlg === 'HMAC-SHA256') {
    const expected = crypto.createHmac('sha256', HMAC_SECRET).update(hash).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  if (signatureAlg === 'RS256') {
    const publicKey = readKey(PUBLIC_KEY_PATH);
    if (!publicKey) return false;
    return crypto.verify('RSA-SHA256', Buffer.from(hash), publicKey, Buffer.from(signature, 'base64'));
  }

  return false;
}

export function signingMetadata() {
  return {
    mode: SIGNING_MODE,
    algorithm: SIGNING_MODE === 'RS256' ? 'RS256' : 'HMAC-SHA256',
    keyConfigured: SIGNING_MODE === 'RS256' ? Boolean(readKey(PRIVATE_KEY_PATH)) : Boolean(HMAC_SECRET)
  };
}
