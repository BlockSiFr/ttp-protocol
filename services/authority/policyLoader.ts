import fs from "node:fs"

export interface ProtectedPolicy {
  protectedPaths: string[]
}

// Minimal YAML list reader for starter use (expects `- value` lines).
function readListFromYaml(filePath: string, rootKey: string): string[] {
  const txt = fs.readFileSync(filePath, "utf8")
  const lines = txt.split(/\r?\n/)
  const out: string[] = []
  let inSection = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith(`${rootKey}:`)) {
      inSection = true
      continue
    }
    if (inSection && trimmed.startsWith("- ")) {
      out.push(trimmed.slice(2).trim())
      continue
    }
    if (inSection && trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("- ")) {
      break
    }
  }

  return out
}

export function loadProtectedPolicy(): ProtectedPolicy {
  return {
    protectedPaths: readListFromYaml("policy/protected-actions.yaml", "protected_paths")
  }
}

export function isProtectedPath(path: string, patterns: string[]): boolean {
  return patterns.some(p => {
    if (p.endsWith("/**")) {
      return path.startsWith(p.slice(0, -3))
    }
    return path === p
  })
}
