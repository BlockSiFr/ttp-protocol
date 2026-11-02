import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import type { ExecutionReceipt } from "./schemas"
import { chainHash, signReceipt } from "./receiptSigner"

function secureMode(stat: fs.Stats): boolean {
  return process.platform === "win32" ||
    ((stat.mode & 0o077) === 0 &&
     (typeof process.getuid !== "function" || stat.uid === process.getuid()))
}
function trustedDirectory(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const st = fs.lstatSync(dir)
  if (!st.isDirectory() || st.isSymbolicLink() || !secureMode(st)) {
    throw new Error("UNTRUSTED_RECEIPT_LEDGER_DIRECTORY")
  }
}
function verifyRecord(record: ExecutionReceipt, previous: string | null): void {
  if (!record || typeof record !== "object" || typeof record.receiptId !== "string" ||
      !/^er-[0-9a-f-]{36}$/i.test(record.receiptId) ||
      typeof record.signature !== "string" || typeof record.chainHash !== "string") {
    throw new Error("INVALID_RECEIPT_LEDGER_RECORD")
  }
  const { signature, chainHash: claimedHash, ...partial } = record
  const hash = chainHash(previous, partial)
  if (hash !== claimedHash) throw new Error("RECEIPT_LEDGER_CHAIN_BROKEN")
  const expected = Buffer.from(signReceipt({ ...partial, chainHash: claimedHash }))
  const supplied = Buffer.from(signature)
  if (supplied.length !== expected.length ||
      !crypto.timingSafeEqual(supplied, expected)) {
    throw new Error("RECEIPT_LEDGER_SIGNATURE_INVALID")
  }
}

export interface ReceiptLedger {
  get(id: string): ExecutionReceipt | undefined
  append(receipt: ExecutionReceipt): void
  lastHash(): string | null
  count(): number
  close(): void
}

// Exact single-process, host-local, signed append-only receipt ledger.
// A live exclusive lock prevents independent processes from forking the chain.
// Unclean termination intentionally requires operator-reviewed lock recovery.
export function openReceiptLedger(file = process.env.RUNTIME_AUTH_RECEIPT_LEDGER_PATH): ReceiptLedger {
  if (!file || !path.isAbsolute(file)) throw new Error("PERSISTENT_RECEIPT_LEDGER_UNCONFIGURED")
  trustedDirectory(path.dirname(file))
  const lockFile = file + ".lock"
  let lockFd: number | undefined
  let fd: number | undefined
  let released = false
  const previousRecords = new Map<string, ExecutionReceipt>()
  let last: string | null = null
  let bytes = 0
  try {
    lockFd = fs.openSync(lockFile, fs.constants.O_WRONLY | fs.constants.O_CREAT |
      fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600)
    fs.writeSync(lockFd, String(process.pid) + "\n")
    fs.fsyncSync(lockFd)
    fd = fs.openSync(file, fs.constants.O_RDWR | fs.constants.O_APPEND |
      fs.constants.O_CREAT | (fs.constants.O_NOFOLLOW ?? 0), 0o600)
    const fileStat = fs.fstatSync(fd)
    if (!fileStat.isFile() || !secureMode(fileStat)) throw new Error("UNTRUSTED_RECEIPT_LEDGER_FILE")
    const raw = fs.readFileSync(fd, "utf8")
    const size = Buffer.byteLength(raw)
    if (size !== fileStat.size || (size > 0 && !raw.endsWith("\n"))) {
      throw new Error("TRUNCATED_OR_CHANGED_RECEIPT_LEDGER")
    }
    for (const line of raw.split("\n").filter(Boolean)) {
      let receipt: ExecutionReceipt
      try { receipt = JSON.parse(line) as ExecutionReceipt }
      catch { throw new Error("MALFORMED_RECEIPT_LEDGER") }
      if (previousRecords.has(receipt.receiptId)) throw new Error("DUPLICATE_RECEIPT_ID")
      verifyRecord(receipt, last)
      previousRecords.set(receipt.receiptId, receipt)
      last = receipt.chainHash
    }
    bytes = size
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd)
    if (lockFd !== undefined) {
      fs.closeSync(lockFd)
      fs.unlinkSync(lockFile)
    }
    throw error
  }

  const fileFd = fd!
  const ownedLockFd = lockFd!
  function close(): void {
    if (released) return
    released = true
    fs.closeSync(fileFd)
    fs.closeSync(ownedLockFd)
    fs.unlinkSync(lockFile)
  }
  return {
    get: id => previousRecords.get(id),
    lastHash: () => last,
    count: () => previousRecords.size,
    append(receipt: ExecutionReceipt): void {
      if (released) throw new Error("RECEIPT_LEDGER_CLOSED")
      if (previousRecords.has(receipt.receiptId)) throw new Error("DUPLICATE_RECEIPT_ID")
      const stat = fs.fstatSync(fileFd)
      if (!stat.isFile() || !secureMode(stat) || stat.size !== bytes) {
        throw new Error("RECEIPT_LEDGER_CHANGED_EXTERNALLY")
      }
      verifyRecord(receipt, last)
      const buffer = Buffer.from(JSON.stringify(receipt) + "\n")
      const written = fs.writeSync(fileFd, buffer)
      if (written !== buffer.length) throw new Error("SHORT_RECEIPT_LEDGER_WRITE")
      fs.fsyncSync(fileFd)
      // A newly opened file's directory entry must be durable as well.
      if (process.platform !== "win32") {
        const parentFd = fs.openSync(path.dirname(file), fs.constants.O_RDONLY)
        try { fs.fsyncSync(parentFd) } finally { fs.closeSync(parentFd) }
      }
      bytes += buffer.length
      last = receipt.chainHash
      previousRecords.set(receipt.receiptId, receipt)
    },
    close
  }
}
