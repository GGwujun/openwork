# Development Workflow Skills

This document explains the OpenWork development workflow as a sequence of skills. It focuses on process and usage, not implementation detail.

## When to Use This Workflow

Use this workflow for any AI-assisted development change in this repo that modifies behavior, UX, or release artifacts.

## Workflow at a Glance

1) Start: `forge-start`
2) Plan: `forge-plan`
3) Contracts (as needed): `forge-contracts`
4) Execute: `forge-execute`
5) Verify: `verification-before-completion` + `forge-verify`
6) Archive: `forge-archive`
7) Finish branch: `finishing-a-development-branch`
8) Release (when applicable): `forge/release`
   - Recovery publish: `forge/openwrk-npm-publish`

## Step-by-Step Usage

### 1) Start (entry)
- **Skill**: `forge-start`
- **Purpose**: Initialize Forge structure, detect active tracks, route to planning.
- **Use when**: Starting any Forge change or unsure of project state.

### 2) Plan
- **Skill**: `forge-plan`
- **Purpose**: Produce `intent.md`, `design.md`, `tasks.md` in order.
- **Use when**: An idea must become a concrete plan.
- **Output**: `forge/tracks/<change>/tasks.md`

### 3) Contracts (as needed)
- **Skill**: `forge-contracts`
- **Purpose**: Create delta contracts or sync to main contracts without archiving.
- **Use when**: Requirements need to be captured or updated.

### 4) Execute
- **Skill**: `forge-execute`
- **Purpose**: Set up an isolated worktree and choose execution mode.
- **Modes**:
  - Same session + independent tasks: `forge:subagent-driven-development`
  - Batch checkpoints / separate session: `forge:executing-plans`

### 5) Verify
- **Skills**:
  - `verification-before-completion` (universal gate before any completion claim)
  - `forge-verify` (Forge artifacts consistency check before archive)
- **User-facing changes**:
  - Run `openwork-docker-chrome-mcp` for end-to-end validation.

### 6) Archive
- **Skill**: `forge-archive`
- **Purpose**: Merge delta contracts to main and move track to archives.
- **Multi-track**: Use the multi-track mode within `forge-archive`.

### 7) Finish Branch
- **Skill**: `finishing-a-development-branch`
- **Purpose**: Tests pass -> choose merge/PR/keep/discard -> cleanup worktree.

### 8) Release
- **Skill**: `release`
- **Purpose**: Version bump -> tag -> verify release.
- **Recovery path**: `openwrk-npm-publish` when the workflow fails to publish.

## Decision Points

### Choose Execution Mode
- Stay in this session + tasks independent -> `forge:subagent-driven-development`
- Need checkpoints or separate session -> `forge:executing-plans`

### User-Facing Change
- If UI/UX changes: `openwork-docker-chrome-mcp` is required before declaring done.

## Legacy Skills (Removed)

Legacy skills were removed after consolidation into `forge-plan`, `forge-contracts`, and `forge-archive`. See git history if needed.

## Minimal Example

```
forge-start
forge-plan
forge-execute
verification-before-completion
forge-verify
forge-archive
finishing-a-development-branch
```
