---
id: 061
title: Migrate 2023–2024 Historical Expense Data Into The App
status: spec
source: captain
started: 2026-08-31T02:26:05Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:061:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:061-ideation-1
              briefing:
                id: briefing:061:ideation:attempt-1:revision-1
                digest: sha256:90c429a00191a5d21bfb921d288df43483503ef28ccf426975c16e81967923fe
                request-digest: sha256:616238f67c2e32a98590eb748fd3d55a0029d1b13b4af4c11e49a0129596d81b
                room-ref: ./review/ideation/briefing-1
              withdrawal:
                by: agent:first-officer
                at: "2026-08-28T14:39:26.491363Z"
                reason: Bound Briefing omits the first officer's recommendation and the concrete decision effect, which the gate-presentation contract requires the captain to see in the presentation channel. This workflow declares Subspace as its review surface, so the room itself must carry them rather than relying on surrounding chat. Inputs are unchanged; only the Briefing's completeness is at fault.
            - id: gate-attempt:061-ideation-2
              briefing:
                id: briefing:061:ideation:attempt-2:revision-1
                digest: sha256:f9c2cf21c57f70dc9f65739e3e54596ca31649c6eb70e313114c5cff13897358
                request-digest: sha256:0df636f568ce44ae9440694e05a7d87a64c52388cdf1302933d28f9d1f2abd05
                room-ref: ./review/ideation/briefing-2
              withdrawal:
                by: agent:first-officer
                at: "2026-08-28T14:48:46.071606Z"
                reason: Room briefing-2 was written by the spacedock 0.27.0 binary, which emits no index.json and is therefore unreadable by Subspace gate mode — the presentation failed its preflight. The binary is now 0.27.1, which does emit index.json. Rebinding so the room is readable in Subspace, this workflow's declared review surface. Briefing content is unchanged; only the room format is at fault.
            - id: gate-attempt:061-ideation-3
              briefing:
                id: briefing:061:ideation:attempt-3:revision-1
                digest: sha256:7d80892f81a50f494679959179b1c5c06fd3f727c2cd0b9cf06695db42f8038a
                room-ref: ./review/ideation/briefing-3
              resolution:
                type: Resolution
                id: resolution:spacedock:061:ideation:3
                briefing: briefing:061:ideation:attempt-3:revision-1
                by: person:captain
                at: "2026-08-31T02:24:07.567092Z"
                decision: approve
                reason: 'Captain approved the ideation direction: migrate 2023-2024 historical expense records into the app, feasibility judged and reported before any write. Scope bounded to those two years; all other archive years remain with 060. Spec must settle whether 2023 data exists by inspecting tab gid=0, surface the 25-bucket to flat gov_category mismatch as a captain decision rather than resolving it, and state the undo and blast-radius plan before any import.'
              application:
                target-stage: spec
                state: consumed
---

Evaluate whether the captain's 2023 and 2024 historical expense records can be migrated into the live app, and if so, migrate them — so the app itself holds those two years instead of them living only in Google Sheets. Feasibility is judged before any write is attempted.

This feature blocks `060-historical-expense-analysis`: the captain chose migration-first, so the 2006–2025 growth report is specced only after this lands and may read the migrated data as a source.

## User Stories

- As the captain, I want my 2023 and 2024 spending to live inside the app, so I can see those years alongside the data I log day to day instead of opening old spreadsheets.
- As the captain, I want to be told honestly whether this is even possible before anyone writes to my live data, so I am not left with a half-migrated app.
- As the captain, I want the migration to be reversible, so a bad import does not cost me the records two of us use every day.

## Success

- A written feasibility verdict, delivered before any write: possible, possible-with-caveats, or not possible, with the reason.
- If feasible: 2023 and 2024 expense records present in the app, attributed to the correct categories, dates, and amounts.
- The live data two people use daily is intact — no existing row altered or lost, verified against a before/after check, not asserted.
- A stated, exercised way to undo the migration.

### Out of Scope

- Years other than 2023 and 2024. The remaining archive years are inventoried and analysed by `060`, not imported here.
- The growth analysis itself — that is `060`'s deliverable.
- Any new app UI for browsing historical years. This feature lands data, not screens.
- Changing what the app does with categories going forward, beyond what landing these two years requires.

## Plan

To be filled in at spec time. Open questions this must resolve:

- **Does 2023 data actually exist?** `060`'s recorded spec finding states the archive holds no 2023 record at all. The captain has since pointed at tab `gid=0` of the 2024 workbook and asked to migrate "2024, 2023". Spec settles this by inspecting the tab, not by assuming either side is right. If 2023 genuinely has no record, this feature covers 2024 only and says so.
- **The taxonomy does not map 1:1.** The historical records carry 25 top-level buckets over 61 sub-categories with four row-kind tags (monthly, annual, irregular, rental-property). The app uses a flat `gov_category` set in `app/app/lib/categories.ts`. Spec decides what happens to buckets with no app equivalent, and whether the app's category set changes or the import approximates — this is a captain decision, not an implementer's.
- **Rental-property and income rows.** The source tables interleave income rows and rental-property pass-through flows with household expense rows. Spec decides whether these are imported, excluded, or marked, since importing them silently distorts every total the app shows.
- **Aggregate rows are interleaved with data rows.** Section totals and per-kind subtotals sit in the same columns as real line items; importing them double-counts. The row-kind tag in column A is the filter.
- **Reversibility and blast radius.** The target sheets are production data in daily use. Spec states how the migration is undone, how the before/after integrity check is performed, and whether it runs against staging first.
- **Which source file per year.** Several years have duplicate, template, and legacy `.xls` variants. Spec states the pick rule.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

### Feedback Cycles
