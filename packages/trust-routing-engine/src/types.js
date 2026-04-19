/** @typedef {'PERMIT'|'DENY'|'STEP_UP'|'ESCALATE'|'THROTTLE'|'CONSTRAIN'} Decision */

/** @typedef {{subject:string, action:string, resource:string, context:Record<string,unknown>, attestationRef?:string, requestedBy:string, paramsHash:string, bindingHash:string, timestamp:string, delegationHopCount?:number}} ExecutionRequest */

/** @typedef {{issuerType:'behavioral'|'supervisor'|'domain'|'workload', issuerId:string, proofRef:string, trustScore:number, lastVerifiedAt:string, freshnessSeconds:number, revoked:boolean, delegationAllowed:boolean, maxHops:number, currentHopCount:number, grantId:string, minTrustScore:number, requiresStepUp:boolean, environmentConstraints?:Record<string,string>}} RouteCandidate */

/** @typedef {{strategy:'require_all'|'require_any'|'strongest_path_wins'|'freshest_path_wins'|'supervisor_override'|'domain_hard_deny_overrides_all', maxFreshnessSeconds:number, minTrustScore:number, highRiskActions:string[], denyOverrides:string[], stepUpActions:string[], throttleActions:string[], constrainActions:string[]}} RoutingPolicy */

export {}
