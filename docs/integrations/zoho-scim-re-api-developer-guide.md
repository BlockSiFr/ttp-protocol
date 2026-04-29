---
title: "Zoho SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# Zoho SCIM-RE API Developer Guide

## Purpose

This document explains how to apply **SCIM-RE runtime execution governance** to Zoho CRM and related Zoho business applications. SCIM-RE does not replace native platform identity, API, workflow, or runtime controls. It adds an **Authority Plane** in front of protected execution so each high-impact action is evaluated before execution and each decision emits an **ExecutionReceipt**.

## Platform Context

Zoho CRM APIs rely on OAuth 2.0 and scope controls, and Zoho webhooks provide real-time event delivery. Recommended protection points include CRM record mutations, email sends, exports, owner transfers, workflow actions, and webhook-triggered downstream operations.

## Core Execution Invariant

```text
Zoho workflow / custom function / API client → Zoho Execution Gateway → /re/authorize → Zoho API call → ExecutionReceipt
```
