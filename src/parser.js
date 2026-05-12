import { createAst } from "./ast.js";
import { TtpError } from "./error.js";

const TOP_LEVEL_BLOCKS = new Set([
  "subject",
  "trust",
  "proof",
  "authority_context",
  "delegation"
]);

export function parseTtp(source) {
  const ast = createAst();
  const blocks = parseBlocks(source);

  for (const block of blocks) {
    const fields = parseFields(block.body);

    if (block.type === "subject") {
      ast.subjects.push({ id: block.name, ...fields });
    } else if (block.type === "trust") {
      ast.trustClaims.push({ subject: block.name, ...fields });
    } else if (block.type === "proof") {
      ast.proofs.push({ id: block.name, ...fields });
    } else if (block.type === "authority_context") {
      ast.authorityContexts.push({ id: block.name, ...fields });
    } else if (block.type === "delegation") {
      ast.delegations.push({ id: block.name, ...fields });
    }
  }

  validateAst(ast);
  return ast;
}

function parseBlocks(source) {
  const blocks = [];
  let index = 0;
  const blockPattern = /\b(subject|trust|proof|authority_context|delegation)\s+"([^"]+)"\s*\{/g;

  while (index < source.length) {
    blockPattern.lastIndex = index;
    const match = blockPattern.exec(source);
    if (!match) {
      const trailing = source.slice(index).replace(/\/\/.*$/gm, "").trim();
      if (trailing) {
        throw new TtpError("SYNTAX_ERROR", `Unexpected content near: ${trailing.slice(0, 40)}`);
      }
      break;
    }

    const type = match[1];
    const name = match[2];
    if (!TOP_LEVEL_BLOCKS.has(type)) {
      throw new TtpError("SYNTAX_ERROR", `Unsupported block type: ${type}`);
    }

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findMatchingBrace(source, bodyStart - 1);
    blocks.push({
      type,
      name,
      body: source.slice(bodyStart, bodyEnd)
    });
    index = bodyEnd + 1;
  }

  return blocks;
}

function findMatchingBrace(source, openBraceIndex) {
  let depth = 0;
  let inString = false;

  for (let i = openBraceIndex; i < source.length; i += 1) {
    const char = source[i];
    const previous = source[i - 1];

    if (char === "\"" && previous !== "\\") {
      inString = !inString;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  throw new TtpError("SYNTAX_ERROR", "Unclosed block");
}

function parseFields(body) {
  const fields = {};
  let remaining = body;

  const decayMatch = /\bdecay\s*\{([\s\S]*?)\}/m.exec(remaining);
  if (decayMatch) {
    fields.decay = parseFields(decayMatch[1]);
    remaining = remaining.replace(decayMatch[0], "");
  }

  const arrayPattern = /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\[([\s\S]*?)\]/gm;
  remaining = remaining.replace(arrayPattern, (_match, _space, key, values) => {
    fields[key] = [...values.matchAll(/"([^"]+)"/g)].map((value) => value[1]);
    return "";
  });

  const scalarPattern = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+?)\s*$/gm;
  let scalarMatch;
  while ((scalarMatch = scalarPattern.exec(remaining)) !== null) {
    fields[scalarMatch[1]] = parseValue(scalarMatch[2]);
  }

  const leftovers = remaining
    .replace(scalarPattern, "")
    .replace(/\/\/.*$/gm, "")
    .trim();

  if (leftovers) {
    throw new TtpError("SYNTAX_ERROR", `Could not parse field content: ${leftovers.slice(0, 60)}`);
  }

  return fields;
}

function parseValue(rawValue) {
  const value = rawValue.trim().replace(/,$/, "");

  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1);
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  if (/^proof\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new TtpError("SYNTAX_ERROR", `Unsupported value: ${value}`);
}

function validateAst(ast) {
  if (ast.subjects.length === 0) {
    throw new TtpError("MISSING_SUBJECT", "At least one subject block is required");
  }

  if (ast.trustClaims.length === 0) {
    throw new TtpError("MISSING_TRUST", "At least one trust block is required");
  }

  if (ast.proofs.length === 0) {
    throw new TtpError("MISSING_PROOF", "At least one proof block is required");
  }

  for (const claim of ast.trustClaims) {
    if (!ast.subjects.some((subject) => subject.id === claim.subject)) {
      throw new TtpError("INVALID_REFERENCE", `Trust block references unknown subject: ${claim.subject}`);
    }
    requireFields(claim, ["issuer", "score", "issued_at", "expires_at"], "trust");
  }

  for (const proof of ast.proofs) {
    requireFields(proof, ["subject", "required_score", "mode"], "proof");
    if (!ast.subjects.some((subject) => subject.id === proof.subject)) {
      throw new TtpError("INVALID_REFERENCE", `Proof references unknown subject: ${proof.subject}`);
    }
  }

  for (const context of ast.authorityContexts) {
    if (context.requires && !ast.proofs.some((proof) => `proof.${proof.id}` === context.requires)) {
      throw new TtpError("INVALID_REFERENCE", `Authority context references unknown proof: ${context.requires}`);
    }
  }
}

function requireFields(object, fields, blockType) {
  for (const field of fields) {
    if (object[field] === undefined || object[field] === null || object[field] === "") {
      throw new TtpError("SYNTAX_ERROR", `${blockType} block is missing required field: ${field}`);
    }
  }
}
