---
commissioned-by: spacedock@0.27.1
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
      context-sections:
        - Review-finding disposition
    - name: verify
      gate: true
      fresh: true
      feedback-to: build
      context-sections:
        - Review-finding disposition
    - name: done
      terminal: true
---

# Personal Expense Tracker

Build a personal expense tracking app for daily spending capture — quick manual entry on mobile for two users, and automatic recurring expense logging so every spend in life is accounted for, whether entered manually or created on schedule.

## File Naming

Each feature is a markdown file named `{id}-{slug}.md` — zero-padded id prefix, lowercase slug, hyphens, no spaces. Example: `010-edit-delete-expense.md`. This makes the id visible without opening the file or running `status`.

`spacedock new <slug>` mints the id, stamps it into the frontmatter, and writes a flat `{slug}.md` — it does not know the id-prefix convention. Immediately after filing, rename the file to add the `{id}-` prefix (`mv`/`git mv` + `git add`) before committing. Once renamed, the full filename stem — id prefix included — is the slug used everywhere else (`--set`, `--entity-path`, worktree paths, branch names). Do not rename a file while its `worktree:` field is set — the worktree, branch, and dispatch names are already keyed to the pre-rename slug; rename only after the entity reaches a terminal or worktree-free state.

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
| `worktree` | string | Worktree path while a build agent is active, empty otherwise. Once set on first dispatch into a `worktree: true` stage, it stays set across all non-terminal advancements (stickiness) and clears at terminal merge. |
| `issue` | string | GitHub issue reference (e.g., `#42`) |
| `pr` | string | GitHub PR reference (e.g., `#57`) |
| `mod-block` | string | Pending mod-declared blocking action, format `{lifecycle_point}:{mod_name}` |

## Stages

### `ideation`

Captain captures an observation, a pain point, or a goal. No agent work happens here — this is raw thinking. The captain gates this stage: only features worth speccing move forward.

- **Inputs:** Captain's observations, pain points, or goals written directly into the feature body
- **Outputs:** A clear statement of what problem this feature solves, why it matters, and what success looks like in daily use
- **Good:** Grounded in real situations — something that actually happened or a habit you want to build. Concrete enough that someone else could understand why this matters.
- **Bad:** Vague or abstract without a real use case. Technical without a user perspective.
- **Gate content:** Show the seed outcome, included and excluded scope, and the proof needed to decide whether speccing should start.

### `spec`

Agent takes the ideation content and writes a structured spec using the Spec Template. Captain reviews and approves before any code is written. If rejected, the captain adds feedback to the ideation body and it returns here for revision.

- **Inputs:** Approved ideation body — the problem statement and success criteria the captain wrote
- **Outputs:** A completed spec (see Spec Template) covering goal, user stories, edge cases, and what is explicitly out of scope, plus a top-level `## Acceptance criteria` section. Every acceptance criterion must be independently testable.
- **Good:** Acceptance criteria are binary — either met or not, no interpretation needed. Edge cases cover the real messiness of daily use (offline, wrong input, two users logging at once).
- **Bad:** Criteria that require judgment to evaluate. Scope that bleeds into other features. Missing the "out of scope" section.
- **Gate content:** Show the chosen approach, the riskiest unverified mechanism and what exercising it showed, expected files and lines with tolerance, and the proposed proof for each acceptance criterion.

Split each acceptance criterion by how it is verified: **offline** (a test, command, or on-disk state a fresh agent reproduces) or **interactive** (requires the captain or a live drive to judge). Declare the split at spec. A plan that would build a harness to automate an interactive AC is visible here, at the gate, before the harness is built — interactive ACs are validated by a live drive or the captain, not by new automation.

### `build`

Agent reads the approved spec, plans the implementation, writes the code, and self-checks against every acceptance criterion before marking complete. Runs in an isolated branch.

- **Inputs:** Approved spec with acceptance criteria and edge cases
- **Outputs:** Working implementation on a dedicated branch, with every acceptance criterion from the spec met and documented in the stage report. A brief implementation plan written before coding begins.
- **Good:** Each acceptance criterion explicitly checked off with evidence. Code handles all documented edge cases. No regressions on existing features.
- **Bad:** Criteria left unchecked in the report. Implementation that interprets rather than implements the spec. Side effects on other features not documented.

When a finding arrives, follow `## Review-finding disposition`: investigate read-only, preserve its evidence, propose materiality/ownership/disposition, and obtain distinct FO authorization before any candidate edit, commit, or reviewer rerun.

### `verify`

A fresh agent (no context from build) deploys the feature to the staging environment, verifies each acceptance criterion from the spec, walks Captain through the frontend, and explains how the backend works. Captain then does their own manual test in staging and approves.

- **Inputs:** Approved spec (acceptance criteria), build branch deployed to staging
- **Outputs:** Verification report mapping each acceptance criterion to a pass/fail result with evidence. Staging URL for Captain's manual test. Plain-language explanation of frontend behavior and backend flow.
- **Good:** Every acceptance criterion has a concrete result — screenshot, test output, or observed behavior. Staging is live and accessible for Captain's manual test. Backend explanation is in plain language, not code.
- **Bad:** Criteria marked as passed without evidence. Staging not deployed or inaccessible. A report that just restates what was built rather than verifying it works.
- **Gate content:** Show non-empty Stage Report results, checks run, evidence for each acceptance criterion, reviewer findings under workflow labels, and whether delivery can proceed.

**Small-change fast path.** Scale the verify checks to the diff's blast radius. A routine, low-blast-radius change (a copy tweak, a one-line fix, a rename) does not need the full checklist — match the rigor to the change. The Live Evidence Requirement below still applies: even a one-line fix needs one real staging observation.

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
3. Runs the acceptance-criteria cross-check (`status --read <ref> --ac-scan`) so every `**AC-N**` has an evidence citation, and re-anchors each mechanism-only AC to the end value it serves
4. Presents the gate summary **with concrete manual-test steps for the captain, unprompted — not only when asked.** Numbered, plain-language, no jargon: the URL to open (staging pre-merge, production post-deploy), exactly what to tap, and what should happen at each step. Pull these from the verify report's own ACs and any browser-only items it flagged as unconfirmed — don't make the captain ask for this every time.
5. Waits for captain approval before merging. **Every time the FO asks "approve to merge" — not just the first time — that ask carries its own manual-test steps or an explicit pointer to steps already given for this exact deploy.** A captain who tested once and reported success, then asked for something else, then comes back to "approve to merge" still gets a self-contained approval ask: either fresh steps (if anything changed — a redeploy, a new build) or "same as above, still current" — never a bare "approve?" that assumes the captain remembers what to check. This applies to every approval point in a merge/deploy flow, not only the gate summary immediately after verify passes.

#### Rejection Protocol

If any acceptance criterion fails, the verify agent MUST set the stage report verdict to REJECTED. Each failure must be listed with concrete evidence (file path, line number, observed vs. expected behaviour). Do not pass a failing AC silently to the captain. The FO will automatically route the findings back to build via the `feedback-to: build` mechanism. The build agent fixes the issues and re-commits; the verify agent then runs again from scratch. The captain only sees the feature once all ACs pass.

#### Mandatory PII / Secrets Check

Before marking verify complete, the agent must confirm all of the following. If any item fails, set verdict to REJECTED and cite the exact file and line.

- No `.env` files containing real values are committed to the branch
- No API keys, tokens, passwords, or secrets appear in any committed file
- No personal data (real names, email addresses, phone numbers) appears in test fixtures, seed data, or comments
- No private URLs or internal identifiers that should not be in a public repository appear in any committed file

### `done`

Feature is shipped — verified, approved by Captain, merged, and deployed to production. Reached via real merge, not a manual flag flip: the `pr` field plus the `pr-merge` mod's merge hook completes it.

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

## Review-finding disposition

Every finding enters this checkpoint when it arrives during build, verify, consequential FO quick work, or a correction routed from a rejected gate.

1. The reviewer owns observation, not task ownership or authorization.
2. The worker preserves the finding, investigates without candidate mutation, records the four evidence fields, and proposes materiality, task ownership, and disposition separately. Its `actor:ensign` round Resolution is advisory.
3. The FO sends a distinct `fix`, `decline`, `hold`, or `route for decision` authorization through the runtime's addressable-worker boundary.
4. The verifier recommends `PASSED` or `REJECTED`; a new finding re-enters step 1.
5. Only the captain changes approved scope, accepted value, thresholds, tolerance, or acceptance criteria.
6. After revise is selected, rejection routing transports the evidence, workflow classifications, authorized dispositions, and concrete assignment unchanged; it never re-triages.

Before FO authorization, candidate bytes and Git HEAD stay unchanged, no candidate commit is made, and no reviewer rerun starts. Read-only file/history inspection, non-mutating reproductions, existing tests, and adversarial work in a throwaway checkout are allowed. After authorization, perform only that disposition; `hold` and `route for decision` forbid mutation and rerun. Changed evidence re-enters the checkpoint, and an unobservable runtime authorization means hold and re-consult.

The four evidence fields are released user and normal workflow; observable harm; affected value AC or non-negotiable boundary; and trigger evidence. Field 3 uses `value-ac[AC-N]`, `captain-ruling[YYYY-MM-DD]`, or `contract[repo/relative/path#anchor]` plus a nonblank claim; `none:` plus a rationale cannot establish Material.

- **Material:** all four fields establish supported-workflow harm to a value AC or protected boundary.
- **Deferred risk:** the trigger is hypothetical, unsupported, unobserved, or outside current promises; record its promote-to-material condition.
- **Polish:** no current user-visible loss or protected boundary is at risk.
- **Needs decision:** the feature cannot own the required scope, product, or compatibility decision.

Materiality and feature ownership are independent. Owned Material is eligible for an FO-authorized fix; out-of-scope Material holds unchanged as Needs decision. Deferred risk or Polish may be declined only after FO authorization.

After reviewer and worker entries and FO consultation, the First Officer appends the Cycle line directly from the authorized package, then invokes `${SPACEDOCK_BIN:-spacedock} gate record --round` with the canonical Briefing/log before reviewer re-run or next-gate preparation. Cycle line format:

`- Cycle {N}: {verdict} — {reviewer/loop}; surface {files}/{LOC} vs estimate {declared} ({P}%); AC {unchanged | narrowed: <note>}`

Compare `git diff --numstat "$(git merge-base main HEAD)"..HEAD` with the spec estimate; beyond declared tolerance or on narrowed AC, require a captain-visible design reset. Cycle 3 escalates.

## Workflow-specific rules

The FO/ensign operating contract already governs generic stage semantics and proof discipline: prefer the cheapest check that can fail, prove by exercising rather than re-reading, and reject any AC whose only proof is a review of its own prose. The rules below add only this workflow's specifics.

- **Review surface is Subspace.** Gate reviews are presented as prepared Spacedock gate rooms in the Subspace TUI, not as chat text. The FO runs `spacedock gate prepare <entity>` and presents the room via the `subspace:r` skill in `gate` mode; the captain's decision comes back through `spacedock gate record --decision`. Subspace is a presentation channel, not a second recorder — a failed or partial presentation never becomes an approval. If `subspace-tui --supports spacedock-gate-room-v1` exits non-zero, the binary is too old (`brew upgrade spacedock-dev/tap/subspace-beta`); fall back to presenting the gate in chat and say so explicitly rather than silently degrading.

- **One gate at a time.** Present gate reviews individually and wait for the captain's response before presenting the next. Never open a second review while one is open.

- **Worker dispatch cap.** Cap concurrent ensigns at 2–3. Heavy stages (`verify`, `build`) cost far more than light ones (`spec`) — factor that in when batching. Before dispatching, state which features can run in parallel and which must wait, and why.

- **Acceptance criteria are machine-readable.** Each feature body carries a top-level `## Acceptance criteria` section whose entries are `**AC-N — {property}**` followed by a `Verified by:` clause. This is what `status --read <ref> --ac-scan` and the FO's gate cross-check read. Criteria buried under a nested heading are invisible to that machinery and do not count.

- **Evidence must be able to fail.** Each AC's cited evidence names the concrete change that would flip it — the falsifying edit. An author who cannot name what would make the evidence fail has not shown it can fail, and the criterion does not count.

- **Live evidence for runtime claims.** When an AC's truth is what the app actually *does* — a screen, an API response, a scheduled job firing — prove it against live staging, with the negative case that would red it. An offline proxy or a code reading proves the words, never the behavior. This is the general form of the `verify` stage's Live Evidence Requirement.

- **No prose-grep over instruction files.** A string or regex match over an instruction file the model reads (the FO/ensign contract, this README, a skill) never proves a behavioral claim — the matched text was written by the same implementer the check polices. A valid paraphrase fails it; an inverted clause passes it. Such a grep is one-off validation evidence at most, never a committed test. Presence or absence is an existence fact and a grep establishes it soundly when that fact is the claim; when the claim is about what a program or agent does, express it in a form that can be exercised instead.

- **Repo-mutation worktree layer.** `build` runs in a worktree against the codebase, and `verify` is `fresh` so an independent agent checks the ACs. PR state lives on the `pr` field, managed by the `pr-merge` mod — there is no `pr_open` or `awaiting_merge` stage.

- **Posture: product, two real users.** This app is used daily by two people with real financial data. Data loss, silent write failures, and PII leakage are Material by default. Test depth is proportionate to blast radius; a worker does not add a CI lane, lint, or new standing check unasked — that needs explicit captain approval and is normally its own feature.

## Spec Template

When writing a spec in the `spec` stage, use this structure. Note that `## Acceptance criteria` is a **top-level** section, a sibling of `## Spec` — not nested inside it — because the gate's AC cross-check reads it there.

```markdown
## Spec

### Goal
One sentence: what this feature does and why it exists.

### User Stories
- As [user], I want [action] so that [outcome].
- (2–4 stories covering the main use cases)

### Edge Cases
- What happens when [unusual input or situation]?
- (Cover real scenarios: offline, two users at once, empty state, wrong input)

### Out of Scope
- Explicitly list what this feature does NOT cover

## Acceptance criteria

Each AC names a property of the finished feature (not a stage action) and how it is verified. At least one measures the end value against a baseline that can move the wrong way.

**AC-1 — {End-state property, phrased as something true of the shipped feature.}**
Verified by: {offline | interactive} — {test name / curl output and status / observed staging behaviour / resulting on-disk state}. Falsified by: {the concrete change that would make this evidence fail}.

**AC-2 — {...}**
Verified by: ...

## Risk evidence

{The riskiest unverified mechanism and what exercising it showed, or `no spike needed: {the proven mechanisms this relies on}`.}

## Expected surface and tolerance

Estimate: {+NNN} net LOC across {M} files, tolerance {±NN%}.
Semantics this may change: {stored formats, API shape, auth, scheduled behavior, or `none`}.

## Test plan

{What verifies the implementation, estimated cost, whether a live staging drive is needed.}
```

## Workflow State

View the workflow overview:

```bash
spacedock status
```

Output columns: ID, SLUG, STATUS, TITLE, SCORE, SOURCE.

Include archived features with `--archived`:

```bash
spacedock status --archived
```

Find features ready for their next stage:

```bash
spacedock status --next
```

Read one feature's stage report, checklist, or acceptance criteria:

```bash
spacedock status --read <id> --stage verify --ac-scan
spacedock status --read <id> --stage verify --checklist
```

Validate the workflow's entities and ids:

```bash
spacedock status --validate
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
mod-block:
---

One sentence: why this feature exists and what problem it solves.

## User Stories

- As [user], I want [action] so that [outcome].
- (2–4 stories covering the main use cases)

## Success

What done looks like — specific, scoped to this feature only. Not the whole app.

- Criterion 1
- Criterion 2

### Out of Scope

What this feature explicitly does not cover.

## Plan

How to make it happen — architecture, decisions, constraints, open questions.

## Acceptance criteria

{Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see Spec Template.}

### Feedback Cycles

{First officer appends one `- Cycle {N}: ...` line per correction round; the verify gate reads reviewer findings from here.}
```

## Commit Discipline

- Commit status changes at dispatch and merge boundaries
- Commit feature body updates when substantive
- Build commits land on the worktree branch; merge to main happens via the `pr-merge` mod after PR review
- Production deploy is a separate manual step after merge — see the `done` stage
