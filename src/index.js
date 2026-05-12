#!/usr/bin/env node
import { checkFile, evalFile } from "./lib.js";
import { toCliError, TtpError } from "./error.js";

const VERSION = "0.1.0-mvp";

export async function runCli(argv, io = console) {
  const [command, ...args] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    io.log(helpText());
    return 0;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    io.log(`ttp ${VERSION}`);
    return 0;
  }

  if (command === "check") {
    const file = args[0];
    if (!file) {
      throw new TtpError("INVALID_ARGUMENT", "Usage: ttp check <file>");
    }
    io.log(JSON.stringify(await checkFile(file), null, 2));
    return 0;
  }

  if (command === "eval") {
    const file = args[0];
    if (!file) {
      throw new TtpError("INVALID_ARGUMENT", "Usage: ttp eval <file> --subject <subject> --at <timestamp|now>");
    }

    const subject = readFlag(args, "--subject");
    if (!subject) {
      throw new TtpError("INVALID_ARGUMENT", "ttp eval requires --subject <subject>");
    }

    const at = readFlag(args, "--at") ?? "now";
    io.log(JSON.stringify(await evalFile(file, { subject, at }), null, 2));
    return 0;
  }

  throw new TtpError("INVALID_ARGUMENT", `Unknown command: ${command}`);
}

function readFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

function helpText() {
  return `Trust Transfer Protocol CLI

Usage:
  ttp check <file>
  ttp eval <file> --subject <subject> --at <timestamp|now>
  ttp version
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(JSON.stringify(toCliError(error), null, 2));
    process.exitCode = 1;
  });
}
