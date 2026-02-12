---
name: forge-archive
description: Use when a Forge change is complete and delta contracts must be merged into main contracts and the track archived.
---

# Forge Archive

## Overview

Archiving finalizes a change by merging delta contracts into the main contracts and moving the track into archives.

**Core principle:** The main contracts are the source of truth; archives preserve history.

## When to Use

- After tasks are complete and verification evidence exists
- When a change should become the new source of truth

**Do not use when:** Verification has not been completed or artifacts are out of date.

## Archive Steps

1. Confirm verification evidence exists
2. For each `forge/tracks/<change>/contracts/<domain>/contract.md`:
   - Apply `ADDED` requirements to the main contract
   - Replace `MODIFIED` requirements in the main contract
   - Remove `REMOVED` requirements from the main contract
3. Move `forge/tracks/<change>/` to `forge/archives/YYYY-MM-DD-<change>/`
4. Ensure main contracts now represent the new behavior

## Multi-Track Mode

If multiple tracks are ready to archive, use this skill as the entry point and follow the multi-track flow:

1. List `forge/tracks/` and prompt for multi-select
2. Detect contract conflicts by domain
3. Resolve conflicts using implementation evidence
4. Archive each selected track in resolved order

If the workflow explicitly requires the legacy bulk skill, use `forge-bulk-archive`.

## Delta Sections

- `## ADDED` introduces new requirements
- `## MODIFIED` replaces existing requirements
- `## REMOVED` deletes existing requirements

## Quick Reference

| Condition | Action |
|----------|--------|
| Verification missing | Stop and verify before archive |
| Multiple tracks complete | Archive each track independently |
| Conflict in main contract | Resolve before archive |

## Common Mistakes

- Archiving without verification evidence
- Merging deltas into the wrong domain contract
- Leaving active tracks in `forge/tracks/` after archive
