---
id: 065
title: Backfill 3 Recurring Expenses for Feb–Aug 2026
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

The captain just set up 3 real recurring costs as app Subscriptions with a start date of 2026-09-07, but each was already being paid before that date — so February through August 2026 have no record of them, and those months' totals understate what she actually spent.

## User Stories

- As the captain, I want these 3 recurring expenses backfilled for each month from February through August 2026, so those months' totals and category breakdowns reflect costs I was actually paying before I started tracking them as subscriptions.
- As the captain, I want September 2026 onward left untouched, since the Subscriptions feature (start date 2026-09-07) already owns those months going forward.
- As the captain, I want the same reviewable safety this app's other historical backfills use, since this touches live expense records.

## Success

- Each of the 3 expenses below gets one row per month for February through August 2026 (7 months × 3 expenses = 21 rows), matching the amount/category/payer of the captain's own subscription setup:

  | reference id (subscription-generated, 2026-09-07) | amount | category | paid_by | created_by | notes |
  |---|---|---|---|---|---|
  | exp-1788759233590 | 2105 | cat_024 | wei | wei | 勞保 |
  | exp-1788759216521 | 2745 | cat_024 | wei | wei | 三人健保 |
  | exp-1788759176279 | 150 | cat_006 | wei | wei | (none) |

- September 2026 onward is left alone — this entity does not duplicate or interfere with the live Subscriptions mechanism.
- No pre-existing row altered or lost, proven by a before/after check.

### Out of Scope

- Any month before February 2026 for these 3 expenses.
- Any change to the Subscriptions feature itself, its start date, or its future behavior.
- Any other subscription/recurring expense not named above.

## Plan

To be filled in at spec time. Open questions for spec:

- All 3 captain-supplied reference rows carry `date: 2026-01-01` despite being created 2026-09-07 — understand how the Subscriptions feature actually computes/stores its occurrence date and id before designing the backfill, so the 7 new months' rows are shaped the way the live feature itself would have produced them, not a guess.
- Confirm `cat_024` and `cat_006`'s category names against the live Categories tab/app data.
- Confirm which day-of-month to use for each backfilled row (all 3 reference rows show the 1st — confirm whether that is meaningful to the Subscriptions feature or an artifact of the reference data given).
- Confirm this is a direct app-data backfill (writing via the app's own data path/API, matching whatever the Subscriptions feature itself writes), not a spreadsheet-import backfill like `060`–`064` — the source here is the captain's own subscription config, not an external spreadsheet.
- id scheme for the 21 new rows, avoiding collision with existing `exp-` ids — subscription-generated ids look like `exp-{timestamp}`, not the `exp-hist-...` prefix `060`–`064` use, so the collision-safety approach those entities established may not directly apply.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

### Feedback Cycles
