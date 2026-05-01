# MCP Tool Trust Profile

## Overview

Model Context Protocol (MCP) tools are registered as FrontDesk governed capabilities. Each MCP server is registered as a platform (`platformType: mcp`), and each tool is registered as an `ExternalAgent`.

## Trust Route

```
FrontDesk Mission (tenantId, missionId)
  → MCP Server Platform: platformId=mcp_server_001, platformType=mcp
  → MCP Tool Registration: externalAgentId=mcp_tool_search_001
  → Risk Classification: riskTier=low|medium|high|critical
  → RAP Authorization before tool call: action=mcp.tool.invoke, resource=mcp_tool_search
  → Governed Tool Execution (interceptionMode=mcp_proxy)
  → ExecutionReceipt (externalAgentId=mcp_tool_search_001, platformId=mcp_server_001)
```

## Rules

1. Every MCP tool call must be pre-authorized by RAP. Unregistered tool calls → DENY.
2. MCP tools with `riskTier=high` or `critical` require STEP_UP before execution.
3. `mcp_proxy` interception mode wraps the tool call — FrontDesk sees the request before it reaches the MCP server.
4. If `mcp_proxy` is unavailable, fall back to `audit_log_ingestion` with `coverage: limited` noted in the receipt.

## Failure Modes

| Failure | Decision |
|---|---|
| MCP tool not registered | DENY |
| Mission scope does not cover tool's action | DENY |
| MCP server disconnected | DENY |
| Tool risk tier above mission's max allowed | STEP_UP |
