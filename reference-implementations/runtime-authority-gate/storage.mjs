import fs from 'node:fs';
import path from 'node:path';

const STORE_MODE = process.env.RECEIPT_STORE_MODE ?? 'memory';
const STORE_FILE = process.env.RECEIPT_STORE_FILE ?? '.runtime-authority-receipts.json';

export function loadReceipts() {
  if (STORE_MODE !== 'file') return [];
  if (!fs.existsSync(STORE_FILE)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReceipts(receipts) {
  if (STORE_MODE !== 'file') return;
  const dir = path.dirname(STORE_FILE);
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(receipts, null, 2));
}

export function storeMetadata() {
  return {
    mode: STORE_MODE,
    file: STORE_FILE
  };
}
