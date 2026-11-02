import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

export interface SpendResult {
  accepted: boolean
  reason: string
}

// Host-local, cross-process atomic replay barrier for STEP_UP redemption.
// The operator must provision a persisted private directory. This is not a
// distributed consensus/transactional store for multi-region production.
export function consumeStepUpReceipt(
  opaqueReceiptId: string, directory = process.env.RUNTIME_AUTH_REPLAY_LEDGER_DIR
): SpendResult {
  if (!directory || !path.isAbsolute(directory)) {
    return { accepted: false, reason: "PERSISTENT_REPLAY_LEDGER_UNCONFIGURED" }
  }
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(opaqueReceiptId)) {
    return { accepted: false, reason: "INVALID_PRIOR_RECEIPT_ID" }
  }
  let fd: number | undefined
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    const stat = fs.lstatSync(directory)
    if (!stat.isDirectory() || stat.isSymbolicLink() ||
        (process.platform !== "win32" && ((stat.mode & 0o077) !== 0 ||
           (typeof process.getuid === "function" && stat.uid !== process.getuid())))) {
      return { accepted: false, reason: "UNTRUSTED_REPLAY_LEDGER_DIRECTORY" }
    }
    const digest = crypto.createHash("sha256").update(opaqueReceiptId).digest("hex")
    const record = path.join(directory, digest + ".spent")
    fd = fs.openSync(record, fs.constants.O_WRONLY | fs.constants.O_CREAT |
      fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600)
    fs.writeSync(fd, new Date().toISOString() + "\n")
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fd = undefined
    // Sync the directory entry before acknowledging authorization.
    if (process.platform !== "win32") {
      const dirfd = fs.openSync(directory, fs.constants.O_RDONLY)
      try { fs.fsyncSync(dirfd) } finally { fs.closeSync(dirfd) }
    }
    return { accepted: true, reason: "PRIOR_RECEIPT_CONSUMED" }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "EEXIST") return { accepted: false, reason: "STEP_UP_ALREADY_CONSUMED" }
    return { accepted: false, reason: "REPLAY_LEDGER_UNAVAILABLE" }
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
    // Do not delete partial records on an error; uncertain writes fail closed.
  }
}
