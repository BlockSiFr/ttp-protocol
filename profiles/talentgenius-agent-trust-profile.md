# TalentGenius Agent Trust Profile

## Supported TalentGenius Agents

- Candidate sourcing agents
- Resume screening agents
- Talent matching agents
- Interview scheduling agents
- Candidate communication agents
- Hiring workflow agents
- Onboarding transition agents

## Trust Route (Recruiting Mission Example)

```
Enterprise Tenant: tenant_enterprise_globex
  → Recruiting Mission: mission_recruiting_q2
  → Recruiting Mission Pack: pack_talentgenius_recruiting
  → TalentGenius Matching Agent: externalAgentId=tg_match_001
  → TalentGenius Connector: connectorId=conn_tg_globex (VerifiedTrust required)
  → VerifiedTrust: nhiId=svc_tg_api → trustScore=0.88, lifecycle=active
  → RAP: action=candidates.rank → PERMIT
  → Platform evidence: tg_event_rank_candidate_77a1
  → ExecutionReceipt: tenantId=tenant_enterprise_globex, externalAgentId=tg_match_001
```

## Sensitive TalentGenius Actions (Always STEP_UP)

```
candidates.outreach.send
hiring.stage.reject
hiring.stage.advance
candidates.profile.export
offer.packet.prepare
candidate.bulk_message
candidate.data.share_external
```

## Compliance Binding

TalentGenius receipts include compliance mappings for:
- GDPR Art.22 (automated decision-making in hiring must have human oversight)
- EU AI Act Art.14 (human oversight for high-risk AI in employment)
- EEOC fair hiring evidence

Every `hiring.stage.reject` and `hiring.stage.advance` receipt must include `approvedBy` from the step-up approval.

## Interception Mode

TalentGenius uses `api_gateway` interception mode — FrontDesk wraps API calls through its gateway before they reach TalentGenius.
