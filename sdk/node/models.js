/** @readonly */
export const Decision = Object.freeze({
  PERMIT: 'PERMIT',
  DENY: 'DENY',
  STEP_UP: 'STEP_UP',
  ESCALATE: 'ESCALATE',
  CONSTRAIN: 'CONSTRAIN'
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
 *   reason: string,
 *   constraints?: string[],
 *   receipt: {
 *     receiptId: string,
 *     requestId: string,
 *     decision: keyof typeof Decision,
 *     chainHash: string,
 *     prevChainHash?: string | null,
 *     timestamp: string
 *   }
 * }} AuthorizeResponse
 */
