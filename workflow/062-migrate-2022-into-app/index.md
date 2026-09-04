---
id: 062
title: Migrate 2022 Historical Expense Data Into The App
status: ideation
source: captain
started: 2026-09-04T01:11:34Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
---

Extend the historical import to 2022, so the app holds a third year alongside the 2023–2024 records delivered by `061` — and, in the same pass, 2022's twelve mortgage payments, so 2022 lands as one complete year rather than an expenses-only or mortgage-only partial import. This is decided scope, not an open question: the captain ruled that this entity imports 2022's regular Daily-tab expenses AND 2022's twelve mortgage payments (column J of the `House` tab, dated by column D, spreadsheet `1oUCppCwkfw2BMG8gZwxb13Vq8KVXBQFrVoS57ZH9h6E`) together, in one pass. Expected to be small: `061`'s extractor already discovers the 2022 band and reads it only to find the boundary.

## User Stories

- As the captain, I want 2022 in the app alongside 2023 and 2024, so year-over-year comparison in Reports covers three years instead of two.
- As the captain, I want 2022's mortgage payments included in the same import as its regular expenses, so 2022 is never a partial year missing one or the other.
- As the captain, I want this to reuse what `061` built rather than being a second implementation, so it costs a fraction of what `061` cost.
- As the captain, I want the same safety properties `061` earned — reviewable sheet, my approval before any write, staging rehearsed first, and a working undo.

## Success

- 2022 expense records present in the app, attributed correctly, alongside the 2023–2024 rows.
- 2022's twelve mortgage payments (column J of the `House` tab, dated by column D) present in the app from the same import pass — 2022 never appears in the app as a mortgage-only or expenses-only partial year.
- No existing row altered or lost, proven by a before/after check rather than asserted.
- The same approval gate: nothing imports until the captain marks the normalization sheet APPROVED.
- An exercised undo.

### Out of Scope

- Any year other than 2022. `060` owns the 2006–2025 analysis and the remaining archive years.
- 2023–2024 mortgage payments — entity `064`'s job, not this entity's.
- Re-importing or altering the 2023–2024 rows `061` delivers.
- Any new app UI. This lands data, not screens.
- Fixing the captain's workbook formulas. `061` Finding 6 documents the boundary range errors; repairing them is hers and is not a deliverable here.

## Plan

To be filled in at spec time. What `061` already establishes, so this does not re-derive it:

- **The band is known.** 2022 occupies rows 63–88 of tab `gid=1209807047` (`Daily`) in the archive workbook, the same 26-row day-level shape as 2023 and 2024. `061`'s extractor discovers it already and reports `2022: OUT OF SCOPE (rows 63-88) — read only to find the boundary`.
- **Access is solved.** The staging service account reads that workbook; the production service account gets 403. `061`'s two-credential design handles this.
- **The taxonomy is identical.** Columns A–C are byte-identical across all three bands, which is why `061`'s band guard discovers bands from header rows rather than row numbers.
- **The tooling may already be a flag away.** `061` notes that reversing its 2022 exclusion is a `--years` flag. Spec should verify that claim by exercising it rather than trusting the note, and say plainly if more is needed.
- **2022 has no principal prepayment.** The mortgage schedule's six prepayment dates are 2015-07-15, 2020-02-15, 2021-02-15, 2023-03-15, 2025-03-15 and 2025-11-15 — none fall in 2022. So 2022's twelve mortgage rows are all regular monthly payments; the prepayment-treatment decision the captain made for `064`'s 2023-03 row does not apply here.
- **The PII hard constraint extends to the mortgage sheet.** `061` established that no cell from the archive workbook's sensitive columns reaches the app, a notes field, a report, or the repo. `060`'s ideation ensign confirmed the same hazard on the mortgage sheet: column A row 2 of the `House` tab holds a bank name, branch, full account number and an account-holder personal name in a single cell. Any acceptance criterion this entity writes must assert, falsifiably, that no cell from that column reaches the app, a notes field, a report, or the repo.
- **Access to the mortgage sheet is broader than the archive workbook's.** Both the staging and production service accounts read the mortgage sheet — confirmed working for both, unlike the archive workbook where only staging reads. A single-credential design may be viable here, but this is a fact about which accounts the captain granted rather than about the code, and should be asserted at runtime rather than assumed.

Open questions for spec:

- **Does 2022 have the same formula range errors?** `061` Finding 6 found five of twelve month formulas per year carrying boundary errors in both 2023 and 2024, in the same pattern. If 2022 repeats it, the same reconciliation caveat applies and the captain should be told before she reads the totals.
- **What is 2022's actual date span?** `061` found 2024's record stops on 2024-11-08, which nothing had recorded. Do not assume 2022 is a complete year — measure it, and set the captain's expectations from the measurement.
- **Row volume and its effect on the app.** `061` measured ~1,670 rows for two years with no pagination anywhere in the app. Confirm a third year stays comfortable.
- **Whether `061`'s deferred-risk findings promote.** Findings 5 and 7 both promote on conditions a new year could trigger — an eighteenth taxonomy pair, or a numeric cell in a label row.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

### Feedback Cycles

## Stage Report: ideation

- DONE: Fold the captain's ruling into scope — 062 imports 2022's Daily-tab expenses AND 2022's twelve mortgage payments (`House` tab column J, dated by column D, spreadsheet `1oUCppCwkfw2BMG8gZwxb13Vq8KVXBQFrVoS57ZH9h6E`) in one pass, so 2022 never lands as a mortgage-only or expenses-only partial year.
  Stated as decided in the opening paragraph, a new User Story, a new Success bullet, and a new Out of Scope line pointing 2023–2024 mortgage to `064`.
- DONE: Record that 2022 has no principal prepayment.
  Plan bullet lists all six schedule prepayment dates (2015-07-15, 2020-02-15, 2021-02-15, 2023-03-15, 2025-03-15, 2025-11-15); none in 2022, so `064`'s prepayment-treatment decision for 2023-03 does not apply here.
- DONE: Carry forward and extend the PII hard constraint to the mortgage sheet.
  New Plan bullet ties `061`'s archive-workbook constraint to `060`'s ideation-ensign finding on the `House` tab: column A row 2 holds a bank name, branch, full account number and an account-holder personal name in one cell. States the falsifiable requirement — no cell from that column reaches the app, a notes field, a report, or the repo.
- DONE: Confirm both service accounts read the mortgage sheet and record it as an access fact, not a code fact.
  New Plan bullet: staging and production both confirmed working on the mortgage sheet, unlike the archive workbook (staging only). Notes a single-credential design may be viable, to be asserted at runtime rather than assumed.

### Summary

Read `060`'s ideation entity and the sibling `064` (2023–2024 mortgage) entity to source the prepayment schedule, the PII hazard, and the dual-credential access fact rather than re-deriving them. The four checklist items are now stated as decided facts in the entity body — the mortgage-inclusion ruling reshapes the opening paragraph, User Stories, Success, and Out of Scope; the other three are new Plan bullets. No open question in the body was left implying these are still undecided.