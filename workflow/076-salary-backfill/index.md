---
title: Backfill InfuseAI salary, 所得稅預扣 and 勞退自提 from 2025-01
status: ideation
source: captain, 2026-10-12 — "backfill my InfuseAI salary, 所得稅預扣 and 勞退自提"
score: 0.7
id: 076
---

Salary, tax withholding and the voluntary pension contribution are entered as monthly subscriptions starting 2025-01-01, but the daily logger only writes the day it runs, so Income & earnings shows no salary for any past month and Life spending misses the two payroll deductions.

## User Stories

- As the captain, I want every month of InfuseAI salary since 2025-01 in the Income tab so that Money in and Left over are true from the start.
- As the captain, I want 所得稅預扣 and 勞退自提 logged as expenses for the same months so that the deductions show next to the salary.

## Success

- One row per subscription per month, 2025-01 through the last due date before today, on its due day, with the daily logger's own ids (a rerun writes nothing; the logger never doubles a month).
- Staging rehearsal first; nothing written to production before the captain approves the list.

## Plan

Source (read-only look at production, 2026-10-12; amounts live in the sheet, not in this public repo):

- `sub-1791783006663` InfuseAI Salary — cat_027 Salary (income), monthly, 5th, from 2025-01-01. Note: pays the previous month's salary.
- `sub-1791782940909` 所得稅預扣 — cat_025 Tax (expense), monthly, 5th, from 2025-01-01.
- `sub-1791782874403` 勞退自提 — cat_024 (expense), monthly, 5th, from 2025-01-01.
- Nothing logged yet: no salary income rows; the only Tax expenses are the two yearly 綜合所得稅 payments (2025-05, 2026-05), which are separate from monthly withholding.

Approach: generalize `functions/scripts/backfill-rent-075.js` (pinned list → logger ids → verify → undo) to this entity's three subscriptions. Keep amounts out of the committed script (read them from the sheet at apply time, or a gitignored file), since the remote is public.

Open questions for ideation:

1. Has the salary (and so the withholding and pension) stayed the same since 2025-01, or did it change — and from which month?

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles
