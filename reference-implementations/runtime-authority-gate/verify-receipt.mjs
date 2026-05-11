import fs from 'node:fs';
import { verifyHash } from './signing.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node verify-receipt.mjs <receipt-json-file>');
  process.exit(1);
}

const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = receipt.integrity?.hash;
const signature = receipt.integrity?.signature;
const signatureAlg = receipt.integrity?.signatureAlg;

if (!hash || !signature || !signatureAlg) {
  console.error('Receipt missing integrity.hash/signature/signatureAlg');
  process.exit(1);
}

if (!verifyHash(hash, signature, signatureAlg)) {
  console.error('Signature verification failed');
  process.exit(1);
}

console.log('Receipt signature verification passed');
