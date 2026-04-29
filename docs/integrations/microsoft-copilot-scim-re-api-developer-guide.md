---
title: "Microsoft Copilot SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# Microsoft Copilot SCIM-RE API Developer Guide

## Purpose

This document explains how to apply **SCIM-RE runtime execution governance** to Microsoft Copilot Studio and Microsoft 365 Copilot workflows. SCIM-RE does not replace native platform identity, API, workflow, or runtime controls. It adds an **Authority Plane** in front of protected execution so each high-impact action is evaluated before execution and each decision emits an **ExecutionReceipt**.

## Platform Context

Copilot Studio agents can combine connectors, APIs, prompts, and knowledge sources. Microsoft 365 Copilot connectors include synced connectors and federated MCP connectors. Recommended protection points include REST actions, custom connectors, MCP tools, Microsoft Graph mutations, and downstream business operations.

## Core Execution Invariant

```text
Copilot agent/action/connector → FrontDesk Copilot Authority Middleware → /re/authorize → connector/API/tool execution → ExecutionReceipt
```
