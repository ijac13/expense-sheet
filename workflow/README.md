---
commissioned-by: spacedock@0.9.6
entity-type: feature
entity-label: feature
entity-label-plural: features
id-style: sequential
stages:
  defaults:
    worktree: false
    concurrency: 2
  states:
    - name: ideation
      initial: true
      gate: true
    - name: spec
      gate: true
      feedback-to: ideation
    - name: build
      worktree: true
    - name: verify
      gate: true
      fresh: true
      feedback-to: build
    - name: done
      terminal: true
---

# Personal Expense Tracker

Build a personal expense tracking app for daily spending capture — quick manual entry on mobile for two users, and automatic recurring expense logging so every spend in life is accounted for, whether entered manually or created on schedule.

## File Naming

Each feature is a markdown file named `{slug}.md` — lowercase, hyphens, no spaces. Example: `expense-entry.md`.

## Schema

Every feature file has YAML frontmatter. Fields are documented below; see **Feature Template** for a copy-paste starter.

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier, zero-padded sequential (e.g., `001`) |
| `title` | string | Human-readable feature name |
| `status` | enum | One of: `ideation`, `spec`, `build`, `verify`, `done` |
| `source` | string | Where this feature came from |
| `started` | ISO 8601 | When active work began |
| `completed` | ISO 8601 | When the feature reached terminal status |
| `verdict` | enum | PASSED or REJECTED — set at final stage |
| `score` | number | Priority score, 0.0–1.0 |
| `worktree` | string | Worktree path while a build agent is active, empty otherwise |
| `issue` | string | GitHub issue reference (e.g., `#42`) |
| `pr` | string | GitHub PR reference (e.g., `#57`) |

## Stages

### `ideation`

Captain captures an observation, a pain point, or a goal. No agent work happens here — this is raw thinking. The captain gates this stage: only features worth speccing move forward.

- **Inputs:** Captain's observations, pain points, or goals written directly into the feature body
- **Outputs:** A clear statement of what problem this feature solves, why it matters, and what success looks like in daily use
- **Good:** Grounded in real situations — something that actually happened or a habit you want to build. Concrete enough that someone else could understand why this matters.
- **Bad:** Vague or abstract without a real use case. Technical without a user perspective.

### `spec`

Agent takes the ideation content and writes a structured spec using the Spec Template. Captain reviews and approves before any code is written. If rejected, the captain adds feedback to the ideation body and it returns here for revision.

- **Inputs:** Approved ideation body — the problem statement and success criteria the captain wrote
- **Outputs:** A completed spec (see Spec Template) covering goal, user stories, acceptance criteria, edge cases, and what is explicitly out of scope. Every acceptance criterion must be independently testable.
- **Good:** Acceptance criteria are binary — either met or not, no interpretation needed. Edge cases cover the real messiness of daily use (offline, wrong input, two users logging at once).
- **Bad:** Criteria that require judgment to evaluate. Scope that bleeds into other features. Missing the "out of scope" section.

### `build`

Agent reads the approved spec, plans the implementation, writes the code, and self-checks against every acceptance criterion before marking complete. Runs in an isolated branch.

- **Inputs:** Approved spec with acceptance criteria and edge cases
- **Outputs:** Working implementation on a dedicated branch, with every acceptance criterion from the spec met and documented in the stage report. A brief implementation plan written before coding begins.
- **Good:** Each acceptance criterion explicitly checked off with evidence. Code handles all documented edge cases. No regressions on existing features.
- **Bad:** Criteria left unchecked in the report. Implementation that interprets rather than implements the spec. Side effects on other features not documented.

### `verify`

A fresh agent (no context from build) deploys the feature to the staging environment, verifies each acceptance criterion from the spec, walks Captain through the frontend, and explains how the backend works. Captain then does their own manual test in staging and approves.

- **Inputs:** Approved spec (acceptance criteria), build branch deployed to staging
- **Outputs:** Verification report mapping each acceptance criterion to a pass/fail result with evidence. Staging URL for Captain's manual test. Plain-language explanation of frontend behavior and backend flow.
- **Good:** Every acceptance criterion has a concrete result — screenshot, test output, or observed behavior. Staging is live and accessible for Captain's manual test. Backend explanation is in plain language, not code.
- **Bad:** Criteria marked as passed without evidence. Staging not deployed or inaccessible. A report that just restates what was built rather than verifying it works.

### `done`

Feature is shipped — verified, approved by Captain, and merged.

## Spec Template

When writing a spec in the `spec` stage, use this structure:

```markdown
## Spec

### Goal
One sentence: what this feature does and why it exists.

### User Stories
- As [user], I want [action] so that [outcome].
- (2–4 stories covering the main use cases)

### Acceptance Criteria
- [ ] Criterion 1 — specific, binary, testable
- [ ] Criterion 2
- [ ] ...

### Edge Cases
- What happens when [unusual input or situation]?
- (Cover real scenarios: offline, two users at once, empty state, wrong input)

### Out of Scope
- Explicitly list what this feature does NOT cover
```

## Workflow State

View the workflow overview:

```bash
/Users/ijac/.claude-personal/plugins/cache/spacedock/spacedock/0.9.6/skills/commission/bin/status --workflow-dir expense-sheet/workflow
```

Output columns: ID, SLUG, STATUS, TITLE, SCORE, SOURCE.

Include archived features with `--archived`:

```bash
/Users/ijac/.claude-personal/plugins/cache/spacedock/spacedock/0.9.6/skills/commission/bin/status --workflow-dir expense-sheet/workflow --archived
```

Find features ready for their next stage:

```bash
/Users/ijac/.claude-personal/plugins/cache/spacedock/spacedock/0.9.6/skills/commission/bin/status --workflow-dir expense-sheet/workflow --next
```

Find features in a specific stage:

```bash
grep -l "status: ideation" expense-sheet/workflow/*.md
```

## Feature Template

Every feature body follows this structure: **why → success → plan**. Start with purpose, then define what done looks like, then describe the approach.

```yaml
---
id:
title: Feature name here
status: ideation
source:
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

One sentence: why this feature exists and what problem it solves.

## User Stories

- As [user], I want [action] so that [outcome].
- (2–4 stories covering the main use cases)

## Success

What done looks like — specific, scoped to this feature only. Not the whole app.

- Criterion 1
- Criterion 2
- ...

### Out of Scope

What this feature explicitly does not cover.

## Plan

How to make it happen — architecture, decisions, constraints, open questions.
```

## Commit Discipline

- Commit status changes at dispatch and merge boundaries
- Commit feature body updates when substantive
