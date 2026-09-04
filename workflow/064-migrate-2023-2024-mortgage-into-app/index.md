---
id: 064
title: Migrate 2023–2024 Mortgage Payments Into The App
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

Extend `061`'s already-imported 2023–2024 expense records with the mortgage payments those years were missing. `060` found this is the single largest term in why 2025 looks roughly double 2023–2024: those years' record held no `Mortgage` category at all, and adding just 2023's twelve payments alone closes 35.2% of the apparent gap.

## User Stories

- As the captain, I want my 2023 and 2024 mortgage payments in the app, so those years' totals reflect a cost I was actually paying and Reports stops understating them.
- As the captain, I want the 2023-03 prepayment recorded as its own line, so the app shows the real cash that left my account that month rather than smoothing it away.
- As the captain, I want the same safety properties `061` earned — reviewable sheet, my approval before any write, staging rehearsed first, working undo — since this touches the same live records.

## Success

- 2023 and 2024 each gain twelve monthly `Mortgage` rows, sourced from column J of the `House` tab, dated by column D.
- The 2023-03-15 principal prepayment lands as its own row alongside that month's regular payment — decided by the captain: include it, not exclude or merely flag it.
- No pre-existing row altered or lost, proven by a before/after check.
- The same approval gate: nothing imports until the captain marks a normalization sheet APPROVED, staging rehearsed before production.
- No cell from the mortgage sheet's column A — which holds a bank name, branch, account number and personal name in one cell — reaches the app, a notes field, a report, or this repository.

### Out of Scope

- 2022's mortgage payments. Entity `062` owns 2022 in full, mortgage included, as one combined import — not this entity.
- Any year other than 2023 and 2024.
- Correcting 2025's or 2026's existing `Mortgage` rows, which `060`'s ideation found are a flat hand-entered estimate rather than the real varying payment. That is a separate, undecided question and not part of this entity.
- Any change to how the app defines or displays the `Mortgage` category.

## Plan

To be filled in at spec time. What prior entities already establish, so this does not re-derive it:

- **The source is read.** `060`'s ideation ensign fully characterized the `House` tab: workbook `Coast FIRE_ijac.wei`, spreadsheet `1oUCppCwkfw2BMG8gZwxb13Vq8KVXBQFrVoS57ZH9h6E`, tab gid `1358685274`, 255 rows × 28 cols, data from row 5. Column J `實際月付` is the monthly payment, numeric, 209 typed literals and 31 formulas. Column D `還款日期` is the adjacent date, populated on every row. Schedule spans 2014-11-17 to 2034-10-15, 240 monthly rows, zero non-monthly gaps. 2023 and 2024 each have exactly 12 rows.
- **Column choice is decided.** The captain chose J — the full payment — over H (interest only). Her own 2025 `Mortgage` rows already hold a full-payment estimate, so J keeps years measured consistently, even though 2025's figure is a flat estimate and J is the real varying payment. That inconsistency of method (real vs. estimated) is a fact spec should record, not a reason to reopen the column choice.
- **The prepayment is decided.** Column K `先還本金` (principal prepayment) is populated on 2023-03-15, sized at 0.72× that entire year's twelve regular payments — nearly an extra year of mortgage in one month. The captain chose to include it as its own row. The other five prepayment dates (2015, 2020, 2021, twice in 2025) fall outside this entity's 2023–2024 scope.
- **Both credentials read the source.** Unlike the archive workbook (staging only, production 403), both the staging and production service accounts read the mortgage sheet — confirmed live, not assumed. A single-credential design may be viable here; assert the read at startup rather than depend on it silently.
- **The PII hazard is known.** Column A row 2 of the `House` tab holds a bank name, branch, full account number and an account-holder personal name in one cell. Not reproduced anywhere on disk by any prior entity. Whatever this entity ships must assert, falsifiably, that no cell from column A reaches the app, a notes field, a report, or the repo.
- **Reuse `061`'s tooling.** `extract-historical-expenses.js` / `import-historical-expenses.js` already implement the split-approval shape this needs. Spec should propose extending them to read a second source per year rather than building a parallel pipeline — but that is spec's call, not a given.

Open questions for spec:

- **Sequencing against production.** `061`'s 2023 and 2024 rows are already live. Does this entity's normalization sheet cover only the mortgage additions, or does it need to re-read the existing app rows so the approval sheet shows the full resulting year? Spec decides the shape that keeps `061`'s existing rows untouched while adding these.
- **Notes/attribution.** `paid_by` and `created_by` for these rows — same resolution `061` used (the app's own `USERS` table), or does a mortgage payment need different attribution? Likely the same; confirm rather than assume.
- **Undo scope.** `061`'s undo pattern (id-prefix match) should extend cleanly to a new `exp-hist-mortgage-` (or similar) id prefix so this entity's rows can be undone independently of `061`'s, without touching them.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

### Feedback Cycles
