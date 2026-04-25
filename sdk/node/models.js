/** @readonly */
export const Decision = Object.freeze({
  PERMIT: 'PERMIT',
  DENY: 'DENY',
  STEP_UP: 'STEP_UP',
  ESCALATE: 'ESCALATE'
});

/** @readonly */
export const DecisionMode = Object.freeze({
  FULL: 'FULL',
  CONSTRAINED: 'CONSTRAINED',
  REQUIRES_REATTESTATION: 'REQUIRES_REATTESTATION',
  REQUIRES_HUMAN_APPROVAL: 'REQUIRES_HUMAN_APPROVAL',
  FAILED_CLOSED: 'FAILED_CLOSED'
});

/**
 * @typedef {{ id: string, type: string }} Principal
 * @typedef {{ type: string, id: string }} Resource
 * @typedef {{ trustScore?: number, intent?: string, [k: string]: unknown }} Context
 * @typedef {{ grantId: string, expiresAt: string, scope?: string[] }} AuthorityGrant
 * @typedef {{
 *   baseUrl: string,
 *   requestId: string,
 *   principal: Principal,
 *   action: string,
 *   resource: Resource,
 *   context?: Context,
 *   authorityGrant?: AuthorityGrant
 * }} AuthorizeRequest
 * @typedef {{
 *   decision: keyof typeof Decision,
 *   mode: keyof typeof DecisionMode,
 *   reasonCodes?: string[],
 *   constraintsApplied?: string[],
 *   receipt: {
 *     receiptId: string,
 *     decision: {
 *       outcome: keyof typeof Decision,
 *       mode: keyof typeof DecisionMode
 *     },
 *     integrity: {
 *       hash: string,
 *       chainHash: string
 *     }
 *   }
 * }} AuthorizeResponse
 */
