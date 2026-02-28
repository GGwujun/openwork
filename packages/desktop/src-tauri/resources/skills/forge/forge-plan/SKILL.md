---
name: forge-plan
description: Use when an idea or intent must be turned into Forge design and tasks, or when a track is missing design/tasks artifacts
---

# Forge Plan

## Overview

Turn a change idea into a ready-to-execute plan by producing design and tasks artifacts in order.

**Core principle:** Clarity before execution.

**Prerequisite:** Run `forge-start` before planning a new change.

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
3. **Validate repo paths and conventions**
   - Identify existing source roots (e.g., `packages/app/src/app`, `packages/app/src`)
   - Find similar modules before naming new paths (e.g., search for existing `lib/` or `context/`)
   - If a referenced path does not exist, do **not** invent a new root; use the nearest existing convention
   - If still ambiguous, mark the path as `PATH_TBD` and ask the user to confirm before writing tasks
4. **Create delta contracts FIRST** (before design)
   - Identify all domains affected by this change: types, store, lib, ui, api, db, etc.
   - Create `contracts/<domain>/contract.md` for each domain
   - Define: ADDED types/interfaces, MODIFIED methods, REMOVED functionality
   - Review contracts for completeness before proceeding
5. **Draft design** (reference contracts)
   - Create `design.md` describing architecture and data flow
   - Reference contracts for precise interface definitions
   - Include: error handling, testing strategy, performance considerations
6. **Write tasks** (organized by contracts)
   - Create `tasks.md` with tasks grouped by contract domain
   - Each task references specific contract requirements
   - Tasks should be small, testable, with clear acceptance criteria

## Outputs

- `forge/tracks/<change>/contracts/<domain>/contract.md` (REQUIRED - create first)
- `forge/tracks/<change>/intent.md` (if missing)
- `forge/tracks/<change>/design.md`
- `forge/tracks/<change>/tasks.md`

## Quick Reference

| Situation | Action |
|-----------|--------|
| No intent | Draft `intent.md` first |
| No delta contracts | **Create contracts BEFORE design** |
| Paths unclear | Scan repo and confirm conventions |
| Missing design | Create `design.md` |
| Missing tasks | Create `tasks.md` |
| Tasks already complete | Stop; hand off to `forge-execute` |

## Example

```
Change: login-rate-limit

Created:
- intent.md (why: prevent abuse, scope: login only)
- contracts/
  - types/contract.md (RateLimitConfig, AttemptRecord)
  - store/contract.md (rateLimit state, checkLimit method)
  - lib/contract.md (RateLimiter class)
  - ui/contract.md (RateLimitError component)
- design.md (references contracts for interfaces)
- tasks.md (organized by contract domains)

Next: use forge-execute
```

## Common Mistakes

- Creating design before contracts (leads to unclear interfaces)
- Creating tasks before design (leads to implementation without architecture)
- Skipping contracts and forcing design without requirements
- Writing large, vague tasks instead of small, testable steps
- Hardcoding file paths without checking repo structure

## Path Validation Checklist

- [ ] Identify the actual source root(s) used in this repo
- [ ] Locate similar modules and mirror their directory structure
- [ ] Avoid inventing new top-level roots (e.g., `src/lib` if `src/app/lib` exists)
- [ ] Use `PATH_TBD` and ask when uncertain

## Why Contracts First?

Contracts act as the **interface specification** between modules. By creating them first, you:

1. **Clarify boundaries** - Define what each module exposes and consumes
2. **Enable parallel development** - Team members can code against contracts
3. **Catch integration issues early** - Before writing implementation
4. **Provide test targets** - Mock against contracts for unit tests

## Contracts Checklist

Before creating design, ensure contracts cover:

- [ ] **types** - New/modified data structures and interfaces
- [ ] **store** - State changes, method signatures, selectors
- [ ] **lib** - Public APIs for utility modules
- [ ] **ui** - Component props, events, state requirements
- [ ] **api** - External service interfaces (if applicable)
- [ ] **db** - Schema changes (if applicable)

## Task Organization

Organize tasks.md by contract domains to enable parallel work:

```
## Phase 1: Infrastructure
- Task 1.1: Implement types (contracts/types)
- Task 1.2: Implement lib APIs (contracts/lib)

## Phase 2: Core Logic
- Task 2.1: Extend store (contracts/store)
- Task 2.2: Integrate modules

## Phase 3: UI
- Task 3.1: Build components (contracts/ui)
- Task 3.2: Integration and testing
```

## Next Steps

- Use `forge-execute` to set up worktree and select execution mode
