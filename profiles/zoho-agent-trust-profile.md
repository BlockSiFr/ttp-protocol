# Zoho Agent Trust Profile

## Supported Zoho Agents

- Zoho CRM (leads, contacts, deals, tasks)
- Zoho Desk (tickets, escalations)
- Zoho SalesIQ (chat, visitor tracking)
- Zoho Campaigns (email sequences)
- Zoho Books (invoices, payments)
- Zoho People (HR records)
- Zoho Flow (workflow automation)
- Zoho Creator (custom apps and records)
- Zoho Analytics (reports, dashboards)

## Trust Route (Zoho CRM Example)

```
SMB Tenant: tenant_smb_acme
  → Revenue Growth Mission: mission_revenue_q1
  → Zoho Revenue Pack: pack_zoho_revenue
  → Zoho CRM Follow-up Agent: externalAgentId=zoho_crm_followup_001
  → Zoho Platform Connector: connectorId=conn_zoho_acme (VerifiedTrust required)
  → VerifiedTrust: nhiId=svc_zoho_frontdesk_prod → trustScore=0.91, lifecycle=active, credFreshness=valid
  → RAP: action=crm.contacts.update → PERMIT
  → Zoho CRM API call (intercepted via webhook)
  → Platform evidence: zoho_event_crm_contact_update_98a1
  → ExecutionReceipt: tenantId=tenant_smb_acme, externalAgentId=zoho_crm_followup_001, platformEvidenceRef=zoho_event_98a1
```

## Sensitive Zoho Actions (Always STEP_UP)

```
campaigns.email.send
crm.deals.delete
crm.contacts.export
books.invoices.create
people.employee.update
creator.record.bulk_update
flow.workflow.trigger  (for finance/HR/customer-impacting flows)
```

## Trust Decay Factors

- Zoho OAuth token expiry → credentialFreshness becomes `expiring_soon` → STEP_UP
- Zoho API rate limit breach → connector marked `degraded` → THROTTLE
- Zoho org suspension → connector marked `suspended` → DENY
- Agent not synced in 24h → `stale` → attestation required

## Interception Mode

Zoho agents use `webhook` interception mode. FrontDesk receives Zoho event webhooks and validates them against the authority decision before the event is considered governed.
