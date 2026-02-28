---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for architect review.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Load and Review Plan
1. Read plan file (`forge/tracks/<change>/tasks.md`)
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Check current task status in file, then proceed to mark next incomplete task as in_progress

### Step 2: Execute Batch
**Default: First 3 tasks**

For each task:
1. **Edit tasks.md** to mark task as in_progress: change `- [ ]` to `- [x]` for completed items
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. **Edit tasks.md** to mark task as completed: change `- [ ]` to `- [x]`
5. **Show progress** - After each completion, display current tasks.md status

**Forge note:** When plans live in `forge/tracks/<change>/tasks.md`, show progress as `N/M tasks complete` and pause if a task is unclear or artifacts are missing.

### Step 3: Report
When batch complete:
- Show what was implemented
- Show verification output
- Say: "Ready for feedback."

### Step 4: Continue
Based on feedback:
- Apply changes if needed
- Execute next batch
- Repeat until complete

### Step 5: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use forge:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## CRITICAL: Task State Management

**必须实时更新 tasks.md 文件：**
- ✅ DO: 每完成一个子步骤，立即编辑 tasks.md 中的 checkbox
- ✅ DO: 使用 edit 工具修改 `- [ ]` 为 `- [x]`
- ❌ DON'T: 只在 TodoWrite 中标记，不编辑 tasks.md 文件
- ❌ DON'T: 等所有任务完成后再批量更新

**Why:** tasks.md 是永久审计记录，TodoWrite 是临时会话状态。

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **forge:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **forge-plan** - Creates the plan this skill executes (design + tasks)
- **forge:finishing-a-development-branch** - Complete development after all tasks

**Typical entry:**
- `forge-execute` (routes to this skill for batch execution)
