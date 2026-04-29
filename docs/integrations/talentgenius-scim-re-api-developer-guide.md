---
title: "TalentGenius SCIM-RE API Developer Guide"
product: "BlockSiFr SCIM-RE"
version: "v0.1 integration draft"
date: "2026-04-29"
status: "Developer documentation draft"
---

# TalentGenius SCIM-RE API Developer Guide

## Purpose

This document explains how to apply **SCIM-RE runtime execution governance** to TalentGenius agent workflows. SCIM-RE does not replace native platform identity, API, workflow, or runtime controls. It adds an **Authority Plane** in front of protected execution so each high-impact action is evaluated before execution and each decision emits an **ExecutionReceipt**.

## Platform Context

TalentGenius public materials describe AI agents for talent discovery, matching, and workflow automation. Public API details appear limited, so this guide is a provisional adapter contract pending partner API specifics.

## Core Execution Invariant

```text
TalentGenius agent action → TalentGenius SCIM-RE Adapter → /re/authorize → TalentGenius workflow/API → ExecutionReceipt
```
