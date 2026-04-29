---
title: "OpenAI Agents SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# OpenAI Agents SCIM-RE API Developer Guide

## Purpose

This document explains how to apply **SCIM-RE runtime execution governance** to OpenAI Agents SDK and Responses API tool workflows. SCIM-RE does not replace native platform identity, API, workflow, or runtime controls. It adds an **Authority Plane** in front of protected execution so each high-impact action is evaluated before execution and each decision emits an **ExecutionReceipt**.

## Platform Context

OpenAI Agents SDK supports agent planning, tool calls, handoffs, and multi-step orchestration. Recommended protection points include external tool invocations, handoffs, API mutations, file actions, computer-use actions, and sandbox commands.

## Core Execution Invariant

```text
OpenAI agent tool call/handoff → SCIM-RE tool wrapper → /re/authorize → execute tool only if authorized → tool_result with receipt metadata
```
