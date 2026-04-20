/** @param {any} policy */
export function validateRoutingPolicy(policy) {
  const required = ['strategy', 'maxFreshnessSeconds', 'minTrustScore', 'highRiskActions', 'denyOverrides', 'stepUpActions', 'throttleActions', 'constrainActions']
  for (const k of required) {
    if (!(k in policy)) throw new Error(`invalid_policy_missing_${k}`)
  }
  return policy
}

export const defaultRoutingPolicy = {
  strategy: 'strongest_path_wins',
  maxFreshnessSeconds: 900,
  minTrustScore: 0.65,
  highRiskActions: ['deploy.production', 'terraform.apply', 'merge.main'],
  denyOverrides: ['environment_disallowed', 'binding_mismatch', 'revoked_subject'],
  stepUpActions: ['deploy.production', 'merge.main'],
  throttleActions: ['bulk.write'],
  constrainActions: ['shell.exec']
}
