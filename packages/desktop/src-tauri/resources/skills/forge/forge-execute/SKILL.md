---
name: forge-execute
description: Use when executing a Forge plan and you want a single entry point for the execution stage
---

# Forge Execute

## Overview

Single entry for the execution stage: ensure an isolated workspace, pick an execution mode, and complete the branch when tasks finish.

**Core principle:** Safe isolation before execution, disciplined finish after.

## When to Use

- A Forge plan exists at `forge/tracks/<change>/tasks.md`
- You are ready to implement the plan and want one entry point

**Do not use when:** No plan exists yet (use `forge-plan`).

## Flow

1. **Select the change / plan**
   - If unclear, list `forge/tracks/` and prompt for selection
2. **Ensure isolated workspace**
   - Use `forge:using-git-worktrees`
   - If a worktree already exists for this change, reuse it and skip creation
3. **Choose execution mode**
   - Tasks mostly independent + stay in this session → `forge:subagent-driven-development`
   - Need batch checkpoints or separate session → `forge:executing-plans`
4. **Execute tasks**
   - Follow the chosen skill exactly
   - **CRITICAL**: Update tasks.md checkbox status after each task/sub-task completion
   - Verify tasks.md reflects actual progress before moving to next batch
5. **Finish the branch**
   - Use `forge:finishing-a-development-branch`
   - If using Forge, ensure `forge-archive` is complete before finishing

## Quick Reference

| Situation | Action |
|-----------|--------|
| No plan yet | Use `forge-plan` |
| Need isolated workspace | Use `forge:using-git-worktrees` |
| Worktree already exists | Reuse it and verify status |
| Same session, tasks independent | Use `forge:subagent-driven-development` |
| Batch execution + checkpoints | Use `forge:executing-plans` |
| Tasks done, ready to integrate | Use `forge:finishing-a-development-branch` |

## Decision Checklist

Answer these in order:

1. **Do you want to stay in this session?**
   - Yes → go to 2
   - No → use `forge:executing-plans`
2. **Are tasks mostly independent?**
   - Yes → use `forge:subagent-driven-development`
   - No → use `forge:executing-plans`
3. **Do you need batch checkpoints with human feedback?**
   - Yes → use `forge:executing-plans`
   - No → keep the choice from step 2

## Resume an Existing Worktree

Use this when the change already has a worktree and you are continuing later.

1. **Open the existing worktree** (often `.worktrees/<change>/`)
2. **Verify you are on the correct branch** (`git status`)
3. **Confirm the plan exists** at `forge/tracks/<change>/tasks.md`
4. **Update progress** in `tasks.md` and pick the next unchecked task
5. **Continue at Flow step 3** (execution mode)

**Example commands**:

```bash
git worktree list
cd .worktrees/<change>
git status
```

## Common Mistakes

- Executing on main/master without a worktree
- Starting execution without a plan
- Creating a second worktree for the same change
- Skipping finish workflow after tasks complete
- **Not updating tasks.md checkbox status after task completion (only updating TodoWrite)**

## Integration

**Requires:**
- `forge-plan` (produces `tasks.md`)
- `forge:using-git-worktrees` (isolated workspace)
- `forge:subagent-driven-development` or `forge:executing-plans`
- `forge:finishing-a-development-branch`

**Related:**
- `forge:forge-verify` and `forge:forge-archive` (before finishing branch)
