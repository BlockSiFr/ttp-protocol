# Example: GitHub Actions Governed Step

```yaml
name: governed-build
on: [workflow_dispatch]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Authorize governed action
        id: auth
        run: |
          curl -sS -X POST http://localhost:8080/re/authorize \
            -H 'content-type: application/json' \
            -d '{
              "requestId":"gha-001",
              "principal":{"id":"github-actions","type":"ci-agent"},
              "action":"github.workflow.run",
              "resource":{"type":"repo","id":"org/repo"},
              "context":{"trustScore":0.88},
              "authorityGrant":{"grantId":"grant-local-001","expiresAt":"2030-01-01T00:00:00Z","scope":["github.workflow.run:org/repo"]}
            }' > decision.json
          cat decision.json
      - name: Run governed step
        run: |
          jq -e '.decision=="PERMIT"' decision.json
          echo "Executing protected step"
```
