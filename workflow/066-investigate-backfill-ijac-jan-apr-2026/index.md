---
id: 066
title: Investigate and Backfill Ijac's Missing Jan-Apr 2026 Expenses
status: ideation
source: captain
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
---

It looks like "ijac" (one of the two payers) has no recorded expenses for January through April 2026, other than subscription charges — worth confirming against the live app data, and if the gap is real, backfilling it from a source spreadsheet the captain has identified.

## User Stories

- As the captain, I want to know for certain whether ijac's Jan-Apr 2026 expenses are genuinely missing from the app, or just look that way, before deciding a backfill is needed.
- As the captain, if the gap is real, I want ijac's actual Jan-Apr 2026 expenses added from the source spreadsheet, so those months' totals reflect what was actually spent.
- As the captain, I want the same safety properties prior historical backfills (`060`-`064`) used — reviewable sheet, my approval before any write, staging rehearsed before production.

## Success

- Confirmed, live against production app data (not assumption), whether ijac has any non-subscription expense rows for Jan-Apr 2026.
- If the gap is confirmed: ijac's real Jan-Apr 2026 expenses from the given spreadsheet's "migration" tab are added to the app.
- No pre-existing row (any payer, any month) altered or lost, proven by a before/after check.

### Out of Scope

- Any month outside Jan-Apr 2026.
- wei's expenses — this is specifically about ijac's own missing data, per the captain's observation.
- Any change to how subscriptions themselves work.

## Plan

To be filled in at spec time. Source given by the captain, not yet characterized:

- Spreadsheet: https://docs.google.com/spreadsheets/d/1F2gv7ZytfwIVHuaAkZGMTEnB8jG9GoeKx-CyyjTCKto/edit?gid=2065989204#gid=2065989204 — tab **"migration"** (gid `2065989204`). Spec must read this tab live (columns, headers, row count, date range, category/payer mapping) the same way `060`'s ideation characterized the House/Daily tabs before any of `061`-`064` were speced — do not assume its shape.

Open questions for spec:

- Is "ijac has no non-subscription expenses Jan-Apr 2026" actually true in production? Read live, don't assume — this is the entity's own first success criterion.
- What does the "migration" tab's schema look like, and does it already carry a payer/category mapping or does spec need to derive one (matching `061`'s USERS-table resolution, or something new)?
- Does this tab's data overlap with rows already in the app for the same months? If so, how should overlap be handled — same collision-safety approach `064` established (a distinct id namespace) rather than assuming it's safe?
- Any PII hazard in this source sheet (personal names, account numbers, bank details) that must be excluded, mirroring `064`'s House-tab column-A exclusion? Confirm before reading beyond the needed columns.
- id-namespace and undo-scoping design, so this entity's own rows can be undone independently without touching any other entity's or payer's rows — same question `061` and `064` each resolved for their own scope.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

### Feedback Cycles
