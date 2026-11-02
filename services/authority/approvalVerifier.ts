// Independent GitHub-side approval proof. Caller assertions never count as
// reviewer evidence. Network lookups always use the fixed api.github.com host.
export type ApprovalEntry = {
  state?: string
  environments?: Array<{ name?: string }>
  user?: { login?: string }
}
export interface ReviewClaim {
  repo: string
  workflowRunId: string
  commitSha: string
  branch: string
  resource: string
  invokingActor: string
  reviewer: string
}
export interface ReviewProof {
  verified: boolean
  reason: string
  reviewer?: string
}
export function assessApprovalHistory(
  entries: unknown, claim: ReviewClaim, author: string, sha: string, branch: string
): ReviewProof {
  if (!Array.isArray(entries)) return { verified: false, reason: "INVALID_GITHUB_APPROVAL_HISTORY" }
  if (sha !== claim.commitSha || branch !== claim.branch) {
    return { verified: false, reason: "GITHUB_PR_HEAD_CHANGED" }
  }
  const expected = claim.reviewer.toLowerCase()
  const blocked = [author, claim.invokingActor].map(s => s.toLowerCase())
  if (!expected || blocked.includes(expected)) return { verified: false, reason: "SELF_APPROVAL" }
  const matches = (entries as ApprovalEntry[]).filter(entry =>
    entry && typeof entry === "object" &&
    entry.state?.toLowerCase() === "approved" &&
    entry.user?.login?.toLowerCase() === expected &&
    Array.isArray(entry.environments) &&
    entry.environments.some(e => e?.name === "protected-execution")
  )
  return matches.length === 1
    ? { verified: true, reason: "GITHUB_APPROVAL_VERIFIED", reviewer: claim.reviewer }
    : { verified: false, reason: "INDEPENDENT_APPROVAL_NOT_VERIFIED" }
}
export async function verifyIndependentGithubApproval(claim: ReviewClaim): Promise<ReviewProof> {
  const token = process.env.GITHUB_APPROVAL_VERIFY_TOKEN
  if (!token || token.length < 20) return { verified: false, reason: "GITHUB_APPROVAL_VERIFIER_UNCONFIGURED" }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(claim.repo) ||
      !/^[0-9]+$/.test(claim.workflowRunId) ||
      !/^[0-9a-fA-F]{40}$/.test(claim.commitSha) ||
      !claim.reviewer || !claim.invokingActor) {
    return { verified: false, reason: "INVALID_GITHUB_APPROVAL_CLAIM" }
  }
  const match = /^repo:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+):pr\/([0-9]+)$/.exec(claim.resource)
  if (!match || match[1].toLowerCase() !== claim.repo.toLowerCase()) {
    return { verified: false, reason: "INVALID_PR_RESOURCE" }
  }
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28"
  }
  async function readJson(endpoint: string): Promise<unknown> {
    const response = await fetch("https://api.github.com" + endpoint, {
      headers, signal: AbortSignal.timeout(8000), redirect: "error"
    })
    if (!response.ok) throw new Error("GitHub API error")
    return response.json()
  }
  try {
    const base = "/repos/" + claim.repo
    const [history, pr] = await Promise.all([
      readJson(base + "/actions/runs/" + claim.workflowRunId + "/approvals"),
      readJson(base + "/pulls/" + match[2])
    ])
    if (!pr || typeof pr !== "object") return { verified:false, reason:"PR_NOT_VERIFIED" }
    const snapshot = pr as {
      state?: string
      user?: { login?: string }
      head?: { sha?: string, ref?: string }
      base?: { repo?: { full_name?: string } }
    }
    if (snapshot.state !== "open" || !snapshot.user?.login ||
        snapshot.base?.repo?.full_name?.toLowerCase() !== claim.repo.toLowerCase()) {
      return { verified: false, reason: "GITHUB_PR_IDENTITY_MISMATCH" }
    }
    return assessApprovalHistory(history, claim, snapshot.user.login,
      snapshot.head?.sha ?? "", snapshot.head?.ref ?? "")
  } catch {
    return { verified: false, reason: "GITHUB_APPROVAL_LOOKUP_UNAVAILABLE" }
  }
}
