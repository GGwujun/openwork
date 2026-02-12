---
name: forge-workflow-guard
description: Use when running AI-assisted development to validate Forge workflow steps and prompt for missing requirements
---

# Forge Workflow Guard

## Overview

Real-time workflow checker for AI-assisted development. It validates stage prerequisites and prompts when steps are missing.

**Core principle:** Enforce the workflow before code, before claims, before release.

## When to Use

- Any AI-driven development task in this repo
- When you want continuous workflow validation and reminders

## Required Inputs

- Change name (track)
- Plan path (`forge/tracks/<change>/tasks.md`)
- Whether the change is user-facing (UI/UX)
- Whether multiple tracks are being archived

## Workflow Checks

Use the following checkpoints in order. If a requirement is missing, stop and prompt for it.

### 1) Start
- **Required**: `forge-start`
- **Check**: Forge structure exists and track selected

### 2) Plan
- **Required**: `forge-plan`
- **Check**: `intent.md`, `design.md`, and `tasks.md` exist

### 3) Contracts (as needed)
- **Required**: `forge-contracts`
- **Check**: Delta contracts exist when requirements changed

### 4) Execute
- **Required**: `forge-execute`
- **Check**: Worktree created and execution mode chosen

### 5) Verify
- **Required**: `verification-before-completion`
- **Required**: `forge-verify` before archive
- **Required for user-facing change**: `openwork-docker-chrome-mcp`

### 6) Archive
- **Required**: `forge-archive` (use multi-track mode if needed)

### 7) Finish Branch
- **Required**: `finishing-a-development-branch`

### 8) Release (if publishing)
- **Required**: `release`
- **Recovery**: `openwrk-npm-publish` only if release workflow failed to publish

## Output Format

```
## Workflow Check
Stage: <start | plan | contracts | execute | verify | archive | finish | release>
Status: PASS | NEEDS-ACTION
Missing: <skills or artifacts>
Next: <prompt the user for the required step>
```

## Common Prompts

- "I need the track name to continue. Which change are we working on?"
- "No tasks file found at forge/tracks/<change>/tasks.md. Run forge-plan first."
- "This is a user-facing change. Run openwork-docker-chrome-mcp before claiming done."
- "Archive requires verification evidence. Run forge-verify and verification-before-completion."

## Guardrails

- Never execute tasks without `tasks.md`
- Never claim completion without verification evidence
- Never archive without `forge-verify`
- Never skip `openwork-docker-chrome-mcp` for user-facing changes
