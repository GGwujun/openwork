---
name: forge-plan
description: Use when an idea or intent must be turned into Forge design and tasks, or when a track is missing design/tasks artifacts
---

# Forge Plan

## Overview

Turn a change idea into a ready-to-execute plan by producing design and tasks artifacts in order.

**Core principle:** Clarity before execution.

## When to Use

- Starting a new change after `forge-start`
- A track has intent but is missing `design.md` or `tasks.md`
- You want a single guided flow from idea to tasks

**Do not use when:** You only need to manage or sync contracts (use `forge-contracts`).

## Flow

1. **Select or create the track**
   - If unspecified, list `forge/tracks/` and prompt for selection
2. **Ensure intent exists**
   - If `intent.md` missing, draft it (why, scope, success)
3. **Ensure delta contracts exist**
   - If no delta contracts exist, pause and run `forge-contracts` to create them
4. **Draft design**
   - Create `design.md` (architecture, data flow, error handling, testing)
5. **Write tasks**
   - Create `tasks.md` with bite-sized, TDD-oriented steps

## Outputs

- `forge/tracks/<change>/intent.md` (if missing)
- `forge/tracks/<change>/design.md`
- `forge/tracks/<change>/tasks.md`

## Quick Reference

| Situation | Action |
|-----------|--------|
| No intent | Draft `intent.md` first |
| No delta contracts | Run `forge-contracts` to create them |
| Missing design | Create `design.md` |
| Missing tasks | Create `tasks.md` |
| Tasks already complete | Stop; hand off to execution |

## Example

```
Change: login-rate-limit

Created:
- intent.md (why: prevent abuse, scope: login only)
- design.md (rate limit per IP, storage, errors)
- tasks.md (tests → minimal code → verify)

Next: choose execution method
```

## Common Mistakes

- Writing tasks before design
- Skipping delta contracts and forcing design without requirements
- Writing large, vague tasks instead of small, testable steps

## Next Steps

- Choose execution: `forge:subagent-driven-development` or `forge:executing-plans`
- If implementation will run now, use `forge:using-git-worktrees` first
