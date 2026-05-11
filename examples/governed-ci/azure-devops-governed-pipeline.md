# Example: Azure DevOps Governed Pipeline

```yaml
trigger: none
pool:
  vmImage: ubuntu-latest

steps:
- bash: |
    curl -sS -X POST http://localhost:8080/re/authorize \
      -H 'content-type: application/json' \
      -d '{
        "requestId":"ado-001",
        "principal":{"id":"azure-devops","type":"ci-agent"},
        "action":"pipeline.deploy",
        "resource":{"type":"environment","id":"prod"},
        "context":{"trustScore":0.72},
        "authorityGrant":{"grantId":"grant-local-001","expiresAt":"2030-01-01T00:00:00Z","scope":["pipeline.deploy:prod"]}
      }' > decision.json

    cat decision.json
    jq -e '.decision=="PERMIT" or .decision=="STEP_UP"' decision.json
  displayName: 'Authorize deployment action'

- bash: echo "Deploying after runtime authority decision"
  displayName: 'Governed deploy'
```
