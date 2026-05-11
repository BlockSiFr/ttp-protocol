import { readFile } from "node:fs/promises";
import { parseTtp } from "./parser.js";
import { evaluate } from "./evaluator.js";
import { TtpError } from "./error.js";

export { parseTtp } from "./parser.js";
export { evaluate, calculateEffectiveScore, parseDuration } from "./evaluator.js";
export { TtpError } from "./error.js";

export async function loadTtpFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new TtpError("FILE_NOT_FOUND", `File not found: ${filePath}`);
    }
    throw error;
  }
}

export async function checkFile(filePath) {
  const source = await loadTtpFile(filePath);
  const ast = parseTtp(source);
  return {
    ok: true,
    file: filePath,
    subjects: ast.subjects.length,
    trust_claims: ast.trustClaims.length,
    proofs: ast.proofs.length,
    authority_contexts: ast.authorityContexts.length,
    delegations: ast.delegations.length
  };
}

export async function evalFile(filePath, options) {
  const source = await loadTtpFile(filePath);
  const ast = parseTtp(source);
  return evaluate(ast, options);
}
