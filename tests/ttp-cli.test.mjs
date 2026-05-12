import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkFile, evalFile } from "../src/lib.js";
import { parseTtp } from "../src/parser.js";
import { TtpError } from "../src/error.js";
import { runCli } from "../src/index.js";

test("valid basic example parses", async () => {
  const result = await checkFile("examples/01-basic-agent.ttp");

  assert.equal(result.ok, true);
  assert.equal(result.subjects, 1);
  assert.equal(result.trust_claims, 1);
  assert.equal(result.proofs, 1);
});

test("missing subject fails", () => {
  assert.throws(
    () => parseTtp(`
trust "agent:missing" {
  issuer = "verifiedtrust:tenant_123"
  score = 0.9
  issued_at = "2026-05-11T12:00:00Z"
  expires_at = "2026-05-11T13:00:00Z"
}

proof "p" {
  subject = "agent:missing"
  required_score = 0.7
  mode = "cleartext-dev"
}
`),
    (error) => error instanceof TtpError && error.code === "MISSING_SUBJECT"
  );
});

test("expired trust fails evaluation", async () => {
  const result = await evalFile("examples/01-basic-agent.ttp", {
    subject: "agent:invoice_reviewer",
    at: "2026-05-11T19:00:00Z"
  });

  assert.equal(result.result, "TRUST_PROOF_EXPIRED");
});

test("decayed trust below threshold fails", async () => {
  const result = await evalFile("examples/02-trust-decay.ttp", {
    subject: "agent:invoice_reviewer",
    at: "2026-05-11T19:30:00Z"
  });

  assert.equal(result.result, "TRUST_PROOF_INSUFFICIENT");
  assert.ok(result.effective_score < result.required_score);
});

test("threshold met returns valid evaluation", async () => {
  const result = await evalFile("examples/01-basic-agent.ttp", {
    subject: "agent:invoice_reviewer",
    at: "2026-05-11T12:30:00Z"
  });

  assert.equal(result.result, "TRUST_PROOF_VALID");
  assert.ok(result.effective_score >= result.required_score);
});

test("CLI check returns success for examples", async () => {
  const output = [];
  const code = await runCli(["check", "examples/01-basic-agent.ttp"], {
    log: (line) => output.push(line),
    error: (line) => output.push(line)
  });
  const result = JSON.parse(output.join("\n"));

  assert.equal(code, 0);
  assert.equal(result.ok, true);
});

test("invalid syntax returns useful errors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ttp-test-"));
  const fixture = join(dir, "invalid.ttp");
  await writeFile(fixture, `subject "agent:broken" {\n  type = "ai_agent"\n`, "utf8");

  await assert.rejects(
    () => runCli(["check", fixture], { log: () => {}, error: () => {} }),
    (error) => {
      return error instanceof TtpError && error.code === "SYNTAX_ERROR" && /Unclosed block/.test(error.message);
    }
  );
});
