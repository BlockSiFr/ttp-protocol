---
title: "Microsoft Foundry SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# Microsoft Foundry SCIM-RE API Developer Guide

## Purpose

This document explains how to apply **SCIM-RE runtime execution governance** to Microsoft Foundry / Azure AI Foundry Agent Service workflows. SCIM-RE does not replace native platform identity, API, workflow, or runtime controls. It adds an **Authority Plane** in front of protected execution so each high-impact action is evaluated before execution and each decision emits an **ExecutionReceipt**.

## Platform Context

Microsoft Foundry is used to build, host, evaluate, monitor, and govern AI apps and agents. Recommended protection points include agent deployment, tool execution, thread/run execution, enterprise data access, and workflow mutations.

## Core Execution Invariant

```text
Foundry agent run/tool call → Azure Function or APIM SCIM-RE middleware → /re/authorize → Foundry tool/action execution → ExecutionReceipt
```
