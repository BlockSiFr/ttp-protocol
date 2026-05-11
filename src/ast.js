export function createAst() {
  return {
    subjects: [],
    trustClaims: [],
    proofs: [],
    authorityContexts: [],
    delegations: []
  };
}

export function findSubject(ast, subjectId) {
  return ast.subjects.find((subject) => subject.id === subjectId);
}

export function findTrustClaim(ast, subjectId) {
  return ast.trustClaims.find((claim) => claim.subject === subjectId);
}

export function findProof(ast, subjectId) {
  return ast.proofs.find((proof) => proof.subject === subjectId);
}
