---
name: forge-start
description: Use when starting a Forge change or when unsure whether Forge is initialized or tracks are active
---

# Forge Start

## Overview

Unified entry point for all Forge work. One skill handles:
- First-time setup (skeleton + optional tutorial)
- Structure validation
- Active tracks detection
- Transition to planning or continuing work

**Core principle:** Single entry, smart defaults, minimal friction.

## Quick Decision Tree

```
forge/ exists? 
├── No → Create skeleton → Ask "5-min tutorial?" 
│       ├── YES: Mini tutorial → forge-plan
│       └── NO: Directly to forge-plan  
└── Yes → Active tracks?
    ├── Yes → Show tracks → Ask "Continue, archive, or new?"
    └── No → Directly to forge-plan
```

## The Flow

### Step 1: Structure Validation

```bash
# Check forge/ structure
if [ ! -d "forge/" ]; then
  STATUS="new_project"
elif [ ! -d "forge/tracks/" ] || [ ! -d "forge/contracts/" ] || [ ! -d "forge/archives/" ]; then
  STATUS="incomplete"
elif [ -n "$(ls -A forge/tracks/ 2>/dev/null)" ]; then
  STATUS="has_tracks"
else
  STATUS="clean"
fi
```

### Step 2: Handle by Status

| Status | Condition | Action |
|--------|-----------|--------|
| **new_project** | `forge/` missing | Create full skeleton, ask for tutorial |
| **incomplete** | Missing subdirectories | Create missing directories, ask for tutorial |
| **has_tracks** | Active tracks exist | List tracks with status, prompt for action |
| **clean** | Structure ready, no tracks | Confirm state, proceed to new work |

#### New/Incomplete Project

```
Creating Forge structure:
✓ forge/
✓ forge/tracks/
✓ forge/contracts/
✓ forge/archives/

[Optional] Quick Forge tutorial (5 minutes)?
- What are tracks and artifacts
- Walk through a tiny example
- Understand the workflow

1. Yes, show me (recommended for first-time)
2. No, I know Forge already
```

#### Has Active Tracks

```
Active tracks in this project:
- auth-refactor (3 days ago) — 2/5 tasks complete
- bugfix-login (1 week ago) — completed, not archived

What would you like to do?
1. Continue auth-refactor → Use forge:executing-plans
2. Archive completed tracks → Use forge:forge-archive  
3. Start a new change → Use forge-plan
```

### Step 3: Mini Tutorial (Optional, 5 min)

**Concepts (1 min):**
```
Forge organizes work into tracks:
• Track: A container for one change (feature, bugfix, refactor)
• Artifacts: Documents describing intent, design, and tasks
• Verification: Tests prove the change works before archiving
```

**Demo (3 min):**  
Walk through a concrete 3-line code change:
1. Create track → Write intent → Quick design → 2 small tasks
2. Implement with TDD (red-green-refactor)
3. Verify and archive

**Summary (1 min):**
```
Your workflow:
forge-start → forge-plan → forge-execute → verification → archive
```

### Step 4: Transition to Work

Always end with clear handoff:

| Scenario | Handoff |
|----------|---------|
| New change | "Using forge-plan to create design and tasks" |
| Continue track | "Using forge:executing-plans to continue implementation" |
| Archive | "Using forge:forge-archive to complete and clean up" |

## Forge Skeleton Structure

```
forge/
├── tracks/           # Active work in progress
│   └── <change>/     # One directory per change
│       ├── intent.md
│       ├── design.md
│       ├── tasks.md
│       └── contracts/
├── contracts/        # Main contracts (system-level)
└── archives/         # Completed and verified work
```

## Quick Reference

| You want to... | Entry Point |
|----------------|-------------|
| Start completely fresh | `forge-start` → Initialize → Optional tutorial |
| Start new feature | `forge-start` → forge-plan |
| Continue existing work | `forge-start` → Select track → executing-plans |
| Check project status | `forge-start` (shows status, offers actions) |

## Common Mistakes

| Mistake | Why It's Wrong | Correct Approach |
|---------|----------------|------------------|
| Skip forge-start | Misses structure validation and active track detection | Always start with forge-start |
| Create artifacts manually | May miss required structure or put in wrong location | Let forge-start set up skeleton first |
| Ignore active tracks | Lose context on what was in progress | Review and decide: continue, archive, or abandon |
| Skip tutorial as first-time user | Miss foundational concepts | Take 5 minutes to understand the workflow |

## Integration

**Leads to:**
- `forge-plan` — For new changes (design + tasks)
- `forge-contracts` — Create or sync delta contracts for a track
- `forge-execute` — Set up execution stage and choose run mode
- `forge:forge-archive` — Complete and archive finished work

**Prerequisites:**
- None (self-contained entry point)

**Replaces:**
- `forge:forge-preflight` — Structure validation included here
- `forge:forge-onboard` — Tutorial and guidance included here
- `forge:using-forge` (Forge-specific parts) — Unified into this skill

## Red Flags

**Never:**
- Create `forge/tracks/<change>/` manually without running forge-start first
- Skip checking for active tracks before starting new work
- Assume project state without validation
- Skip the tutorial on first use and then struggle with concepts later

**Always:**
- Run forge-start at the beginning of any Forge workflow session
- Review active tracks list carefully
- Choose appropriate next step based on current state
- Take the tutorial if unfamiliar with Forge concepts

## Example Sessions

### First-time User

```
User: I want to add a new feature

AI: I'll start the Forge workflow for you.
[Running forge-start]

AI: This project doesn't have Forge initialized yet. 
    Creating structure... ✓

AI: [Optional] Quick tutorial (5 min)?
User: Yes

AI: [Delivers tutorial]

AI: Ready to plan your feature. Using forge-plan...
```

### Returning User with Active Work

```
User: Continue working on auth

AI: [Running forge-start]

AI: Found active tracks:
    - auth-refactor (2/5 tasks done)
    - ui-cleanup (completed)

AI: For auth-refactor, I can continue implementation. 
    Using forge:executing-plans...
```

### Clean Project, New Feature

```
User: Fix the login bug

AI: [Running forge-start]

AI: Forge structure ready, no active tracks.

AI: Using forge-plan to plan the login bug fix...
```
