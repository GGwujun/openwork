---
name: forge-contracts
description: Use when a Forge track needs delta contracts created or main contracts synced without archiving
---

# Forge Contracts

## Overview

Manage contract artifacts for a track: create missing delta contracts or sync them into main contracts.

**Core principle:** Preserve existing contracts unless explicitly changed by delta.

## When to Use

- A track needs delta contracts created
- You want to sync delta contracts into main contracts without archiving

**Do not use when:** You are archiving a track (use `forge-archive`).

## Flow

1. **Select the track**
   - If unspecified, list `forge/tracks/` and prompt for selection
2. **Ensure intent exists**
   - If `intent.md` missing, prompt to create it or run `forge-plan`
3. **Delta contracts present?**
   - **No:** create `forge/tracks/<change>/contracts/<domain>/contract.md`
   - **Yes:** sync deltas into `forge/contracts/<domain>/contract.md`
4. **Summarize changes**
   - List updated domains and counts (added/modified/removed)

## Delta Sections

- `## ADDED`
- `## MODIFIED`
- `## REMOVED`
- `## RENAMED`

## Quick Reference

| Situation | Action |
|-----------|--------|
| No delta contract | Create delta contract stub |
| Delta exists | Sync into main contracts |
| Main contract missing | Create with Purpose + Requirements |
| No changes to apply | Report "no changes" |

## Example

```
Delta contract:
## ADDED
- Requirement: Limit login attempts to 5 per minute per IP

Result:
forge/contracts/auth/contract.md updated (added 1)
```

## Common Mistakes

- Overwriting main contracts instead of patching
- Syncing without a delta contract
- Forgetting to create a missing main contract

## Output Format

```
## Contracts Synced: <change>

Updated domains:
- <domain>: added X, modified Y, removed Z
```
