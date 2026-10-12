---
id: 075
title: Backfill rent income (and rent paid) from 2025-01
status: ideation
source: captain, 2026-10-12 — "add rent income ... see my subscription about rent and recent receive from 2025 Jan. Add the historical records back"
started:
completed:
verdict:
score: 0.8
worktree:
issue:
pr:
mod-block:
---

The Rent earnings view starts empty: no rent received has ever been logged (production has no Income tab yet), so Rent shows only costs and reads as a loss. The captain has entered each lease as a subscription with real start/end dates back to 2025-01; those dates are the source for filling the history.

## User Stories

- As the captain, I want every month of rent received since 2025-01 in the Income tab so that Rent earnings and its trend are true from the start.
- As the captain, I want each lease's amount and dates to follow what I entered in Subscriptions, so rent changes (16,000 → 17,000 on 6號1樓 in 2026-02) land in the right months.
- As the captain, I want to review the generated rows before anything is written.

## Success

- One Rent received income row per lease per month it was active, 2025-01 through the last due date before today, on its due day, idempotent (a rerun writes nothing; the daily logger never doubles a month).
- The Earnings page Rent card shows non-zero income for every past month a lease was active.
- Nothing written to production before the captain approves the generated list; staging rehearsal first.

### Out of Scope

- Changing the leases themselves (amounts, dates) — the captain owns Subscriptions.

## Plan

Source data (read-only look at production, 2026-10-12):

- Rent-received subscriptions, category cat_029 Rent received, all due day 5 unless noted:
  - 6號1樓 16,000 (2025-01-01 → 2026-01-31), then 17,000 from 2026-02-01
  - 4號3樓 17,000 from 2025-01-01
  - 4號2樓 17,000 (2025-01-01 → 2026-01-31), then 19,000 from 2026-02-01
  - 4號1樓 18,000 due day 10 (2025-01-01 → 2026-09-30), then 20,000 from 2026-11-01 (October 2026 empty: renovation month)
- Rent-paid subscriptions use **cat_017 Rent (房租)**, not cat_026 Rent paid: 6號1樓 12,000, 4號1樓 13,000, 4號3樓 10,000, 4號2樓 12,000, all from 2025-01-01. Expenses holds **no** rent-paid rows since 2025, so rent paid history is missing too.

Approach: reuse `functions/scripts/backfill-subscription-history.js` (entities 051/065/067): its analyze → captain-edits-report → apply flow and the scheduler's own occurrence logic, extended to write income subscriptions to the Income tab with `inc-auto-<sub>-<date>` ids (the same id the daily logger uses, so it never doubles).

Open questions for ideation:

1. Backfill **rent paid** too (needed for true Rent earnings), or income only as asked?
2. cat_017 Rent has no Fills in default, and the 4號3樓 rent-paid subscription has no Rent tag — so its expenses would count as Life. Set cat_017 to fill in Rent (fixes all four), or move those subscriptions to cat_026 Rent paid?
3. 4號1樓 is due on the 10th until 2026-09 and the 5th after — confirm.

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles
