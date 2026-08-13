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

Each feature is a markdown file named `{id}-{slug}.md` — zero-padded id prefix, lowercase slug, hyphens, no spaces. Example: `010-edit-delete-expense.md`. This makes the id visible without opening the file or running `status`.

`spacedock new <slug>` writes a flat `{slug}.md` — it does not know the id-prefix convention. Immediately after filing, rename the file to add the `{id}-` prefix (`mv`/`git mv` + `git add`) before committing. Once renamed, the full filename stem — id prefix included — is the slug used everywhere else (`--set`, `--entity-path`, worktree paths, branch names). Do not rename a file while its `worktree:` field is set — the worktree, branch, and dispatch names are already keyed to the pre-rename slug; rename only after the entity reaches a terminal or worktree-free state.

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

#### Live Evidence Requirement

A verify report is invalid — and the FO must reject it and re-dispatch — if it contains no live evidence. Every verify report must include at least one of:
- An actual HTTP response from the staging API (curl output, status code, response body)
- An observed UI behaviour on the live staging URL (not inferred from code)

"I read the code and it looks correct" is not evidence. Code inspection belongs in build, not verify.

If the verify ensign cannot run shell commands (Bash permission denied), it must fail the stage immediately with `verdict: REJECTED` and note the missing permission — not substitute code inspection.

#### First Officer Gate Flow

When verify passes, the FO:
1. Confirms the verify report contains live evidence (HTTP calls or observed staging behaviour) — rejects immediately if not
2. Checks that the deployed chunk hashes on staging match the built output — if they differ, the deploy didn't go through
3. Presents the gate summary **with concrete manual-test steps for the captain, unprompted — not only when asked.** Numbered, plain-language, no jargon: the URL to open (staging pre-merge, production post-deploy), exactly what to tap, and what should happen at each step. Pull these from the verify report's own ACs and any browser-only items it flagged as unconfirmed — don't make the captain ask for this every time.
4. Waits for captain approval before merging

#### Rejection Protocol

If any acceptance criterion fails, the verify agent MUST set the stage report verdict to REJECTED. Each failure must be listed with concrete evidence (file path, line number, observed vs. expected behaviour). Do not pass a failing AC silently to the captain. The FO will automatically route the findings back to build via the `feedback-to: build` mechanism. The build agent fixes the issues and re-commits; the verify agent then runs again from scratch. The captain only sees the feature once all ACs pass.

#### Mandatory PII / Secrets Check

Before marking verify complete, the agent must confirm all of the following. If any item fails, set verdict to REJECTED and cite the exact file and line.

- No `.env` files containing real values are committed to the branch
- No API keys, tokens, passwords, or secrets appear in any committed file
- No personal data (real names, email addresses, phone numbers) appears in test fixtures, seed data, or comments
- No private URLs or internal identifiers that should not be in a public repository appear in any committed file

### `done`

Feature is shipped — verified, approved by Captain, and merged.

**Merging to `main` does not deploy anything.** This repo has no CI/CD — production only runs what was last manually deployed there. A feature is not actually live until someone runs the deploy commands below, no matter how long ago it merged.

**Before marking an entity `done`, deploy it to production and confirm it's live:**

1. Determine blast radius from the diff: hosting-only (`app/` changed, `functions/` untouched) or both.
   - Hosting only: `firebase deploy --only hosting --project production`
   - Both: `firebase deploy --only functions,hosting --project production`
2. Confirm it's actually live — don't trust the deploy command's exit code alone:
   - Hosting: `curl -sI https://expense-sheet-b2db8.web.app` and check `Last-Modified` is recent, not stale from a prior deploy.
   - Functions: hit an endpoint whose behavior changed and confirm the new behavior, not just HTTP 200 (e.g. a field that used to return `null` now returns a real value).
3. Record the deploy in the entity's body (a short note near the top, above the original ideation text) with the command run, timestamp, and the concrete evidence from step 2 — see any recent `_archive/*.md` entity for the pattern.
4. Only then set `status: done`.

If a functions deploy fails on an orphaned function that no longer exists in the source (a leftover from some earlier, unrelated cleanup), that's a pre-existing deploy hygiene issue, not something to route around — delete the orphaned function (`firebase functions:delete <name> --region us-central1 --project production`) and redeploy.

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
