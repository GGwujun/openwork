---
name: forge-verify
description: Use when validating that a Forge change is complete, correct, and coherent before archive.
---

# Forge Verify

## Overview

Verify that implementation matches Forge artifacts with a three-dimension report: completeness, correctness, and coherence.

**Core principle:** Evidence-driven verification before archive.

**Prerequisite:** Apply `verification-before-completion` before any "Ready" claim in the report.

## Flow

```
forge-verify
├── Step 0: Apply verification-before-completion principle
│   └── Run verification command fresh, read output, THEN claim
│
└── Step 1-7: Execute Forge three-dimension verification
    ├── Completeness
    ├── Correctness
    └── Coherence
```

## When to Use

- Before archiving a Forge change
- When a user asks if a change is ready
- When artifacts or code may have drifted

**Do not use when:** The change has no artifacts and no code changes.

## Inputs

- Optional change name. If unclear or ambiguous, prompt the user to select from `forge/tracks/`.

## Steps

### Step 0: Apply `verification-before-completion`

**BEFORE any verification claim:**

1. **IDENTIFY**: What command proves this claim?
2. **RUN**: Execute the FULL command (fresh, complete)
3. **READ**: Full output, check exit code, count failures
4. **VERIFY**: Does output confirm the claim?
5. **ONLY THEN**: Make the claim

**No shortcuts. No "should pass". Evidence before claims.**

### Step 1: Select the change

- If no change specified, list `forge/tracks/` and prompt for selection
- Do not guess

### Step 2: Load artifacts

- `forge/tracks/<change>/tasks.md` (if present)
- `forge/tracks/<change>/intent.md` (if present)
- `forge/tracks/<change>/design.md` (if present)
- `forge/tracks/<change>/contracts/<domain>/contract.md` (delta contracts)

### Step 3: Initialize report structure

- Completeness
- Correctness
- Coherence
- Severity: CRITICAL / WARNING / SUGGESTION

### Step 4: Verify Completeness

- Tasks: count `- [ ]` vs `- [x]`
- Delta contracts: ensure each requirement has an implementation signal
- Missing tasks or missing requirement coverage -> CRITICAL

### Step 5: Verify Correctness

- For each requirement and scenario in delta contracts:
  - Search codebase for evidence
  - Check tests for scenario coverage
  - Divergence -> WARNING

### Step 6: Verify Coherence

- Compare code against design decisions
- Flag mismatches as WARNING
- Pattern inconsistency -> SUGGESTION

### Step 7: Generate report

- Summary table
- Grouped issues with actionable recommendations
- Final assessment: Ready / Ready with warnings / Blocked

## Graceful Degradation

- Tasks only: verify completion only
- Tasks + contracts: verify completeness + correctness
- Full artifacts: verify all three dimensions
- Always state which checks were skipped

## Output Format

```
## Forge Verification: <change>

### Summary
| Dimension    | Status |
|--------------|--------|
| Completeness | X/Y tasks, N reqs |
| Correctness  | M/N reqs covered |
| Coherence    | Followed/Issues |

### CRITICAL
- <issue> -> <action>

### WARNING
- <issue> -> <action>

### SUGGESTION
- <issue> -> <action>

Final: <Ready | Ready with warnings | Blocked>
```

## Common Mistakes

- Verifying without reading artifacts
- Treating missing artifacts as pass
- Calling ready without evidence
