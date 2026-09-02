---
id: 062
title: Migrate 2022 Historical Expense Data Into The App
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

Extend the historical import to 2022, so the app holds a third year alongside the 2023–2024 records delivered by `061`. Expected to be small: `061`'s extractor already discovers the 2022 band and reads it only to find the boundary.

## User Stories

- As the captain, I want 2022 in the app alongside 2023 and 2024, so year-over-year comparison in Reports covers three years instead of two.
- As the captain, I want this to reuse what `061` built rather than being a second implementation, so it costs a fraction of what `061` cost.
- As the captain, I want the same safety properties `061` earned — reviewable sheet, my approval before any write, staging rehearsed first, and a working undo.

## Success

- 2022 expense records present in the app, attributed correctly, alongside the 2023–2024 rows.
- No existing row altered or lost, proven by a before/after check rather than asserted.
- The same approval gate: nothing imports until the captain marks the normalization sheet APPROVED.
- An exercised undo.

### Out of Scope

- Any year other than 2022. `060` owns the 2006–2025 analysis and the remaining archive years.
- Re-importing or altering the 2023–2024 rows `061` delivers.
- Any new app UI. This lands data, not screens.
- Fixing the captain's workbook formulas. `061` Finding 6 documents the boundary range errors; repairing them is hers and is not a deliverable here.

## Plan

To be filled in at spec time. What `061` already establishes, so this does not re-derive it:

- **The band is known.** 2022 occupies rows 63–88 of tab `gid=1209807047` (`Daily`) in the archive workbook, the same 26-row day-level shape as 2023 and 2024. `061`'s extractor discovers it already and reports `2022: OUT OF SCOPE (rows 63-88) — read only to find the boundary`.
- **Access is solved.** The staging service account reads that workbook; the production service account gets 403. `061`'s two-credential design handles this.
- **The taxonomy is identical.** Columns A–C are byte-identical across all three bands, which is why `061`'s band guard discovers bands from header rows rather than row numbers.
- **The tooling may already be a flag away.** `061` notes that reversing its 2022 exclusion is a `--years` flag. Spec should verify that claim by exercising it rather than trusting the note, and say plainly if more is needed.

Open questions for spec:

- **Does 2022 have the same formula range errors?** `061` Finding 6 found five of twelve month formulas per year carrying boundary errors in both 2023 and 2024, in the same pattern. If 2022 repeats it, the same reconciliation caveat applies and the captain should be told before she reads the totals.
- **What is 2022's actual date span?** `061` found 2024's record stops on 2024-11-08, which nothing had recorded. Do not assume 2022 is a complete year — measure it, and set the captain's expectations from the measurement.
- **Row volume and its effect on the app.** `061` measured ~1,670 rows for two years with no pagination anywhere in the app. Confirm a third year stays comfortable.
- **Whether `061`'s deferred-risk findings promote.** Findings 5 and 7 both promote on conditions a new year could trigger — an eighteenth taxonomy pair, or a numeric cell in a label row.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

### Feedback Cycles
