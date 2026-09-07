---
id: 064
title: Migrate 2023–2024 Mortgage Payments Into The App
status: verify
source: captain
started: 2026-09-07T00:38:44Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-064-migrate-2023-2024-mortgage-into-app
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:064:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:064-ideation-1
              briefing:
                id: briefing:064:ideation:attempt-1:revision-1
                digest: sha256:3d0c857780cb616e42d654e0de5891e461900fa196e41fd8d830eaaa13567494
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:064:ideation:1
                briefing: briefing:064:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-07T00:37:47.042967Z"
                decision: approve
                reason: Ideation scope, safety properties, and open questions for spec are clear and grounded in prior entities' findings; ready to move to spec.
              application:
                target-stage: spec
                state: consumed
        - id: gate:064:spec
          stage: spec
          attempts:
            - id: gate-attempt:064-spec-1
              briefing:
                id: briefing:064:spec:attempt-1:revision-1
                digest: sha256:347714a3042e3f09e0db1d3602b89661e5a575d2926808edd4dd967826182879
                room-ref: ./review/spec/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:064:spec:1
                briefing: briefing:064:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-09-07T01:37:22.153619Z"
                decision: approve
                reason: Id-namespace design resolves the collision hazard with 061's live rows; row-125 and K-column edge cases are specced with falsifiable ACs; 14 ACs with offline/interactive split are sound. Ready for build.
              application:
                target-stage: build
                state: consumed
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

### Verified at spec — by reading the live sheets and the current code, not by carrying a prior entity's notes forward unchecked

Every claim below was obtained this stage: a read-only probe against the live `House` tab through the staging service account (never written to), a read-only probe of both live Categories tabs, a read-only probe of both live Expenses tabs' ids (ids only — no amounts, dates, or notes read), and a direct reading of `extract-historical-expenses.js` / `import-historical-expenses.js` as they exist today.

**Sequencing against production — RESOLVED: the normalization sheet covers the mortgage additions only, and mortgage rows get their own id namespace.** Tracing `planImport` and `historicalId` (`functions/scripts/import-historical-expenses.js:151-153`, `:239-279`) found a real hazard, not a hypothetical one, in the two obvious designs:

- **Re-listing `061`'s already-live 2023/2024 Daily-tab rows in the same sheet, sharing one per-year id counter with the new mortgage rows** — `062`'s own shape, safe there only because 2022 started empty. `planImport` sorts every `include` row by `key` and numbers them `1..N` per year. A mortgage key (`2023-mortgage-r105`) sorts lexicographically *before* every Daily-tab key for that year (`2023-r33-c...` — `"m" < "r"`), so the mortgage rows would claim the low numbers and every Daily-tab row's computed id would shift. Verified live: production's Expenses tab holds `exp-hist-2023-0001` through `exp-hist-2023-0895` (895 rows) and `exp-hist-2024-0001` through `exp-hist-2024-0775` (775 rows) today. A combined re-sort would recompute every one of those 1,670 rows under a shifted id, `existingIds.has(candidate.id)` (`:869`) would be false for all of them, and the import would write a full second copy of both years' Daily-tab data rather than skipping it — the opposite of the idempotency `061` already proved.
- **A mortgage-only sheet reusing the same `exp-hist-{year}-{NNNN}` prefix, numbered from 1.** The mortgage rows would compute to exactly `exp-hist-2023-0001`…`0012/13` and `exp-hist-2024-0001`…`0012` — ids that already belong to real Daily-tab rows on production. `existingIds.has(...)` would be **true**, so the importer would silently skip every mortgage row as "already present" and report success while writing nothing.

**Both failure modes are invisible on a staging rehearsal**, worth stating plainly since staging-first is this workflow's own safety net: a live read of the staging Expenses tab found **zero** `exp-hist-2022-/2023-/2024-` rows of any kind (1,408 total rows, none historical) — `061`'s and `062`'s own rehearsals always restore staging to empty after proving the mechanism, so the historical rows exist **only on production** (853/895/775 for 2022/2023/2024). Either naive design above would apply and undo cleanly against staging's empty tab and only fail on production, after the staging-first gate had already said yes. This is the same shape of risk `061`'s own D3 found for Categories tabs — staging and production diverge in exactly the dimension a naive design would depend on — and it is why the fix has to be a design that cannot collide by construction, not one a rehearsal is left to validate.

**The decision:** mortgage rows for this entity get a distinct id, `exp-hist-mortgage-{year}-{NNNN}`, numbered within their own per-year, per-source sequence, never sharing a counter with Daily-tab rows. This is collision-free on any target regardless of what that target already holds. The normalization sheet this entity generates therefore holds **only** the new mortgage rows for 2023/2024; it does not re-list `061`'s already-imported Daily-tab rows, so nothing about them needs re-deriving, re-approving, or re-writing.

**Notes/attribution — RESOLVED: same as `061`/`062`, unchanged, no new code needed.** `historicalActorName()` / `HISTORICAL_ACTOR_ID = "user1"` (`functions/scripts/import-historical-expenses.js:93,106-122`) resolves `paid_by` and `created_by` once per run and applies it to every candidate row at `candidateRow()` (`:526-533`) regardless of `row.source` — the mortgage rows `062` already shipped for 2022 went through this exact path with no per-source branch. Confirmed by citation, not assumed.

**Undo scope — RESOLVED: the new `exp-hist-mortgage-` prefix, year-scoped to 2023/2024 only, and it must not touch `062`'s already-shipped 2022 mortgage rows.** `deleteRowsByIdPrefix` already accepts an explicit prefix array (`:457-488`, `062`'s own AC-8 fix) — this entity's `--undo` need only pass `exp-hist-mortgage-2023-` / `exp-hist-mortgage-2024-`, which cannot match `061`'s `exp-hist-2023-`/`2024-` Daily-tab ids (different segment) or `062`'s `exp-hist-2022-` ids (different year, and minted under the old combined counter regardless). The id-prefix change this entity makes applies only to mortgage rows for 2023 and 2024; no run this entity makes ever requests year 2022, so nothing about how `062`'s rows are identified or undone changes.

**Two more defects found by exercising the mechanism this entity actually needs — absent from `062`'s 2022 read, and neither hypothetical:**

- **The read range must widen from `D5:J255` to `D5:K255`, still never touching A–C.** Column K holds exactly one populated cell across the full 2014–2034 schedule that falls in this entity's 2023–2024 window: 2023-03-15, on the same source row as that month's regular column-J payment — confirmed live, magnitude consistent with the ideation's recorded ≈0.72× ratio (not re-quoted in full here per AC-11: no source-workbook figure belongs in this file). A source row can therefore emit **up to two** expense rows — a regular payment from J and, on this one row in scope, a prepayment from K — each needing its own key (`{year}-mortgage-r{sourceRow}` for J, a distinct suffix such as `{year}-mortgage-prepay-r{sourceRow}` for K) so neither the join nor the new id-prefix's per-row numbering can conflate them.
- **The existing `dEmpty !== jEmpty` guard aborts on a real 2024 row, and `062`'s own fix does not cover this case.** `062`'s build found and fixed an early version of this exact abort — "row 125, 2024-11-15, column J blank" — by skipping a row **before** the guard if its year is outside the ones requested (`extract-historical-expenses.js:906`). That fix is correct and sufficient for `062`'s own `--years 2022` runs, where 2024 is out of scope and the row never reaches the guard. It is **not** sufficient here: this entity requests `--years 2023,2024`, so row 125's year (2024) **is** in scope, the early skip does not fire, and the run reaches `dEmpty !== jEmpty` and throws. Reproduced live: source row 125 carries a date (2024-11-15) with columns J and K both blank, immediately followed by source row 126, also dated 2024-11-15, carrying that month's real J payment — a duplicate-date artifact in the captain's own schedule, structurally the same shape `061` found in the Daily tab's duplicated December 2024 headers. It holds nothing and should cost nothing, but the current guard cannot tell "holds nothing" apart from "half-populated, refuse to guess." The classifier needs a third case: a row whose date is populated but whose J **and** K are both blank contributes zero rows and does not abort; a row where D is blank but J or K holds a value still aborts, unchanged.

## Spec

### Goal

Add 2023's and 2024's mortgage payments — the House tab's twelve monthly column-J payments per year, plus the 2023-03-15 column-K prepayment as its own row — to the app, extending `061`'s and `062`'s extractor/importer with a collision-free id namespace so the addition never touches, renumbers, or duplicates `061`'s already-live 2023/2024 Daily-tab rows.

### User Stories

- As the captain, I want my 2023 and 2024 mortgage payments in the app, so those years' totals reflect a cost I was actually paying and Reports stops understating them.
- As the captain, I want the 2023-03 prepayment recorded as its own line, so the app shows the real cash that left my account that month rather than smoothing it away.
- As the captain, I want this addition to never alter, renumber, or duplicate the 2023/2024 rows `061` already delivered, since those rows are live and in daily use by both of us.
- As the captain, I want the same safety properties `061` and `062` earned — reviewable sheet, my approval before any write, staging rehearsed first, and a working, independently-scoped undo.

### Edge Cases

- **A source row carrying both a regular payment and a prepayment on the same date (2023-03-15).** Must emit two rows, not one, and not silently sum or drop either.
- **A source row with a populated date and no amount in either J or K (the live 2024-11-15 duplicate at row 125).** Must be skipped as a non-event, not treated as an abort-worthy half-populated row.
- **A source row with a date and exactly one of J/K populated, or an amount with no date** — the pre-existing guard's actual purpose: still aborts, naming the row, rather than guessing.
- **Re-running the import after the captain hand-corrects the normalization sheet.** Must carry her edits forward by key, exactly as `061`'s `--carry-from` and `062`'s own mortgage-row test of it already prove, extended to the new key shapes here.
- **Undo run any time after this entity's rows are live.** Must remove only this run's `exp-hist-mortgage-2023-`/`2024-` rows, and must leave `061`'s Daily-tab rows and `062`'s 2022 rows (Daily and mortgage) untouched — proven against a target that actually holds those rows, not only against staging's empty tab.
- **Two users viewing Reports while the import runs.** Unchanged from `061`/`062` — new rows only, no in-place update.

### Out of Scope

- Any year other than 2023 and 2024. `062` owns 2022's mortgage in full; `060` owns the remaining archive years.
- Re-importing, altering, or being deletable by this entity's own undo, the 2023–2024 Daily-tab rows `061` delivers, or the 2022 rows (Daily and mortgage) `062` delivers.
- Changing how `062`'s already-imported 2022 mortgage rows are identified or undone. This entity's id-prefix change applies only to mortgage rows dated 2023 or 2024; no run this entity makes ever requests year 2022.
- Correcting 2025's or 2026's existing `Mortgage` rows — a flat hand-entered estimate per `060`'s ideation, and a separate, undecided question.
- Repairing the captain's House-tab schedule, including the row-125 duplicate-date artifact found at this stage. Naming it plainly is this entity's job; fixing her spreadsheet is hers.
- Any new app UI or change to how the app defines or displays the `Mortgage` category.

## Acceptance criteria

Verification split: **offline** — AC-1 through AC-12. **Interactive** — AC-13, AC-14. No harness is built to automate AC-13 or AC-14; both are judged on a live drive of the deployed app, per the pattern `061`/`062` already established.

**AC-1 — No pre-existing expense row, of any year or source, is altered or deleted by this import.**
Verified by: offline — `--snapshot` writes the full target Expenses tab before the run; `--verify` diffs it against the post-import tab and reports `0 modified, 0 deleted` among rows whose id does not begin `exp-hist-mortgage-2023-` or `exp-hist-mortgage-2024-`.
Falsified by: switching the writer from row-insertion to an in-place `values.update`, or widening the undo prefix beyond this run's own — either then reports a modified or deleted pre-existing row, including a `061`- or `062`-sourced one, and the check fails.

**AC-2 — 2023 and 2024 each gain exactly the House tab's twelve regular monthly column-J payments for that year, dated by column D, under the `Mortgage` category.**
Verified by: offline — a unit test over a synthetic House-tab fixture, plus a live `--dry-run` against the real sheet, asserts exactly 12 J-sourced rows per year, each row's date matching its own column D and amount matching its own column J.
Falsified by: reading the amount from a different House-tab column instead of J — the count or the amounts then disagree with the live column-J values.

**AC-3 — The 2023-03-15 column-K prepayment is imported as its own row, distinct from and in addition to that date's regular column-J payment.**
Verified by: offline — a unit test drives a fixture reproducing a source row with both J and K populated and asserts two rows are emitted, keyed distinctly, both dated 2023-03-15, one under the regular-payment key shape and one under the prepayment key shape; confirmed against the live sheet (`--dry-run`) that exactly one row in the 2023–2024 window carries a K value, and both its J-row and K-row appear in the plan.
Falsified by: reading K into the same row as J (summing or overwriting) instead of emitting a second row — the fixture then emits one row for that date instead of two, and its amount does not equal either the J or the K value alone.

**AC-4 — Mortgage rows for 2023 and 2024 are minted under an id namespace (`exp-hist-mortgage-{year}-{NNNN}`) that cannot collide with any id already present in the target Expenses tab, on any target, regardless of what that target already holds.**
Verified by: offline — a unit test asserts the mortgage id prefix is distinct from `061`'s `ID_PREFIX` and computed from a counter scoped to `source === "mortgage"` only, never interleaved with Daily-tab rows in the same per-year sequence; a live test on staging seeds a decoy row named after a real, already-live production id (e.g. `exp-hist-2023-0001`, following `062`'s own seeded-decoy technique since staging holds no historical rows of its own to collide against) and confirms the mortgage import neither skips a mortgage row as "already present" nor recomputes the decoy's id.
Falsified by: reverting to a single shared `ID_PREFIX` and a combined per-year counter (`062`'s own 2022 shape, safe there only because 2022 started empty) — against a target holding 895 pre-existing 2023 Daily-tab ids, this either duplicates all 895 under shifted ids or silently skips every mortgage row as already present, exactly as traced through `planImport`/`historicalId`/`existingIds` at this stage.

**AC-5 — Undo removes only this run's 2023/2024 mortgage rows, and leaves `061`'s Daily-tab rows and `062`'s 2022 rows (Daily and mortgage) byte-identical.**
Verified by: offline, on staging — snapshot, apply, undo, diff shows no difference; separately, following `062`'s own build-time technique, decoy rows are seeded under `061`'s and `062`'s real id shapes before this run's undo and confirmed to survive it untouched.
Falsified by: scoping undo to `exp-hist-` (unscoped) or to a year alone rather than to `exp-hist-mortgage-{year}-` — a decoy seeded under `061`'s or `062`'s id shape is then removed by this entity's own undo.

**AC-6 — No cell from the House tab's columns A, B, or C reaches the app, a notes field, a report, or this repository, including through the widened D:K range.**
Verified by: offline — a test asserts the exact range requested of the Sheets API is `D5:K255` and never wider; the generated normalization sheet, the extraction report, and this entity's stage report are checked for the known column-A cell's structural shape (bank name/branch/account-number/personal-name) and none match; the full PR diff is read before merge.
Falsified by: widening the read range to include column A, B, or C (e.g. `A5:K255`) — the test asserting the exact requested range then fails, and that content becomes reachable in memory.

**AC-7 — A source row whose date is populated but whose J and K are both blank does not abort the run.**
Verified by: offline — a unit test reproduces the live 2024-11-15 duplicate-date shape (a dated row with J and K both blank, immediately followed by a fully-populated duplicate of the same date) and asserts the run completes, emitting zero rows for the blank row and exactly one for the populated one.
Falsified by: leaving the current guard unchanged — the same fixture throws `dEmpty !== jEmpty`, reproducing this stage's own live probe against source row 125.

**AC-8 — Running the import a second time writes nothing for this run's rows.**
Verified by: offline — a second `--apply` against the same target reports `created: 0`, every mortgage candidate skipped as already present.
Falsified by: generating mortgage ids from anything non-deterministic — the second run then writes a duplicate set.

**AC-9 — Before any row is written to any target, `Mortgage` resolves against that target's own live Categories tab, and the run refuses if it does not.**
Verified by: offline — the existing pre-write `resolveCategoryNames` guard (`061`'s AC-9 mechanism) is exercised for this run's one category name; confirmed live at this stage that `Mortgage` already resolves on both staging (28 categories) and production (25 categories) today, so no new reconciliation script is needed.
Falsified by: resolving lazily per row instead of before the first write — a run against a target missing the name would then write partial rows before aborting.

**AC-10 — Every imported mortgage row's notes distinguish a regular payment from a prepayment and name the House-tab source row.**
Verified by: offline — `--verify` parses each mortgage row's notes and asserts it yields the House-tab source row and a payment-kind marker (regular vs. prepayment) alongside the `key`; a test asserts the 2023-03-15 pair parses to two distinct kinds on the same source row.
Falsified by: giving both the J-row and the K-row the same notes shape — the parse cannot tell them apart, and a future carry-forward or audit cannot distinguish which one a hand-correction was meant for.

**AC-11 — No figure, vendor name, or account identifier from the House tab is committed to this repository.**
Verified by: offline — the generated import plan and extraction report are written under the already-gitignored `functions/backfill-reports/`, confirmed with `git check-ignore`; the branch's full diff and this entity's own file are read before the PR, confirming no real payment amount from the House tab appears in either.
Falsified by: writing the plan under a tracked path, or quoting a real payment figure in the entity file or a commit message — either is visible in the diff.

**AC-12 — The import refuses to run without an explicit target, for the mortgage rows as for the Daily-tab rows.**
Verified by: offline — invoking the script with no `--target` exits non-zero, writes nothing, and the Expenses row count on both staging and production is unchanged.
Falsified by: falling back to a default resolved spreadsheet id for the mortgage write.

**AC-13 — Reports → Annual, stepped back to 2023 and to 2024, shows a non-zero total that includes the new mortgage rows (thirteen for 2023, twelve for 2024), matching AC-2/AC-3's reconciled figures within 1%, with `061`'s already-imported figures for those years otherwise unchanged.**
Verified by: interactive — a live drive of the deployed app (staging before merge, production after deploy): open Reports, switch to Annual, step to 2023 then 2024, read the totals; re-check 2022 is unaffected.
Falsified by: writing a mortgage row with a date outside its year, or under an id the app cannot resolve — the annual total then does not move by the expected amount, or `Mortgage` does not appear as a category for that year.

**AC-14 — Everyday use is unaffected after the import: adding an expense still writes it and shows it in today's list, and History still loads.**
Verified by: interactive — a live drive on staging: add an expense, see it appear, delete it; open History and confirm it renders.
Falsified by: writing a row wider than the Expenses header row — `buildColumnMap` throws and `GET /api` returns 500 for every request.

## Risk evidence

**Riskiest unverified mechanism this cycle: reading the House tab's column K live and confirming it actually holds the prepayment the captain described.** Exercised, not assumed: a read-only probe (staging service account, `D5:K255`, never written to) found exactly one populated K cell across the full 2014–2034 schedule that falls in this entity's 2023–2024 window — 2023-03-15, on the same source row as that month's regular J payment, magnitude consistent with the ideation's recorded ≈0.72× ratio. The other five schedule-wide prepayment dates all fall outside 2023–2024, confirmed absent from the window by the same read.

**Second, found rather than assumed: the id-namespace collision.** Traced through the live code, not described in the abstract — `planImport`, `historicalId` and the `existingIds` skip check (`functions/scripts/import-historical-expenses.js:151-153, 239-279, 869`). A live read of both the staging and production Expenses tabs' ids found the asymmetry that makes this dangerous rather than theoretical: production holds `exp-hist-2023-0001`…`0895` and `exp-hist-2024-0001`…`0775` (1,670 rows total, `061`-sourced); staging holds **zero** `exp-hist-` rows of any year, because `061`'s and `062`'s own rehearsals always restore staging to empty after proving the mechanism. So a staging rehearsal of either naive mortgage-id design — sharing `062`'s combined per-year counter, or reusing the same prefix numbered from 1 — would pass cleanly on staging's empty tab and only fail on production, after the staging-first gate had already said yes. This is the same shape of risk `061`'s own D3 found for Categories tabs, and the reason the decision is a collision-free-by-construction id scheme rather than a rehearsal-validated one.

**Third: the row-125 duplicate-date abort, live-reproduced and shown to survive `062`'s own fix.** `062`'s build already found and fixed an early version of this — skip a row before the D-vs-J guard if its year is out of scope. That fix is exercised today and correct for `062`'s own `--years 2022` runs. It is not exercised, and does not help, for `--years 2023,2024`: row 125's year (2024) is in scope for this entity, so the skip never fires and the guard throws. Reproduced live against the real sheet: source row 125 carries the date 2024-11-15 with J and K both blank, immediately followed by source row 126, also dated 2024-11-15, carrying that month's real payment.

**Fourth: unchanged mechanisms, reconfirmed live rather than carried forward.** `Mortgage` resolves as a `name_en` on both staging (28 categories) and production (25 categories) today — reread this stage, not assumed from `062`'s three-days-old report. `historicalActorName()` / `HISTORICAL_ACTOR_ID = "user1"` applies uniformly regardless of `row.source`, confirmed by reading `candidateRow()` directly — no mortgage-specific attribution logic exists or is needed.

**No spike needed:** the bulk-write mechanism, the never-overwrite/`--carry-from` normalization-sheet shape, the two-credential read/write split, and the House-tab reader's basic D/J pairing are all already built and proven by `061`/`062`; this entity extends them rather than building fresh.

## Expected surface and tolerance

Estimate: **+320 net LOC across 5 files, tolerance ±50%** (160–480). Both `061` (+1,260 estimated → shipped +5,004, 397%) and `062` (+700 estimated → shipped ~+1,239, 177%) blew past their own tolerance bands, driven overwhelmingly by falsification-style tests (reintroduce the defect, watch the suite go red) costing more than assertion-only tests. This entity's own AC-4, AC-5, and AC-7 falsifiers are written the same way on purpose, so the same cost shape is expected here — a wider band is the honest response, not a tighter number nobody could hit.

- `functions/scripts/extract-historical-expenses.js` — modified, ~60–100 LOC. Two-row emission from a single House-tab source row (J and/or K), the row-125 skip case, distinct key shapes for regular vs. prepayment rows.
- `functions/scripts/import-historical-expenses.js` — modified, ~50–90 LOC. A mortgage-specific id prefix and counter scoped to years 2023/2024 only (2022 unchanged), a year-and-source-scoped undo prefix, and the notes payment-kind marker.
- `functions/scripts/migration-env.js` — modified, ~5–10 LOC. `HOUSE_RANGE` widened to `D5:K255`.
- `functions/test/historical-expenses.test.js` (or a sibling file) — new/modified, ~120–220 LOC. Covers AC-2, AC-3, AC-4 (including the falsification case), AC-5, AC-7, AC-10.
- `functions/test/fixtures/` — modified/new, ~20–40 LOC. Extends the House-tab fixture with a K-populated row and a row-125-shape blank-with-date row, both synthetic (AC-11).

Semantics this may change: **stored data only** — new rows in the target Expenses tab, the House-tab read range widened (still D–K, never A–C), and the mortgage row id scheme for 2023/2024 only. No category is created (`Mortgage` already exists on both targets — AC-9). No API shape change, no auth change, no scheduled-behavior change, no client change, and no change to `062`'s already-shipped 2022 mortgage rows or their id scheme.

## Test plan

- **Unit, offline:** a fixture reproducing the two new House-tab shapes — a source row with J and K both populated, and a source row with a date but J/K both blank adjacent to a fully-populated duplicate date. Covers AC-2, AC-3, AC-7, AC-10.
- **Falsification, offline:** run the pre-change classifier/id logic against these fixtures and assert the suite goes red exactly as this spec's own live probes found (the K-column silently absorbed or dropped; the row-125 abort) — committed as a permanent regression test, matching `061`/`062`'s own house style. Separately, a fixture-level id-collision test asserting a combined per-year counter (the naive design) collides with pre-existing Daily-tab ids, and the real, distinct-prefix code does not.
- **Live seeded-collision rehearsal on staging, offline** — reusing `062`'s own build-time technique since staging holds no historical rows of its own to collide against: seed one or two decoy rows under `061`'s/`062`'s real id shapes (e.g. `exp-hist-2023-0001`), run this entity's mortgage import and undo, and confirm the decoys are neither matched as "already present" nor removed by this entity's undo. Covers AC-4, AC-5.
- **Carry-forward rehearsal on staging, offline:** generate v1 → hand-edit a regular-payment row and the prepayment row → `--generate --into v2 --carry-from v1` → assert both edits land on their correct keys.
- **Dry-run, offline:** `--dry-run --target staging --from-sheet ...` prints the planned mortgage row counts and ids for 2023/2024, confirming no overlap with either target's existing ids. Covers AC-2, AC-3, AC-4, AC-9, AC-12.
- **Apply + undo rehearsal on staging, offline:** snapshot → apply → verify → undo → diff. Covers AC-1, AC-8.
- **Live drive, interactive:** deployed staging — Reports → Annual stepped to 2023 and 2024 (and a re-check that 2022 is unaffected), then add/see/delete one expense and open History. Covers AC-13 and AC-14; repeated against production after deploy.
- **Cost:** unit and falsification tests run in seconds. The seeded-collision and carry-forward rehearsals are the expensive steps — the seeded-collision rehearsal specifically exists because this entity's real risk (colliding with production's populated tab) cannot be exercised on staging's empty one any other way.

### Feedback Cycles

## Stage Report: spec

- DONE: Write `## Spec` (Goal, User Stories, Edge Cases, Out of Scope) per the Spec Template, resolving the three ideation open questions (sequencing against 061's already-live rows, paid_by/created_by attribution, undo id-prefix) as concrete decisions rather than leaving them open.
  Added `### Verified at spec` under `## Plan` and the `## Spec` section. Sequencing: normalization sheet covers mortgage additions only, distinct `exp-hist-mortgage-{year}-{NNNN}` id namespace — decided after tracing `planImport`/`historicalId`/`existingIds` (`functions/scripts/import-historical-expenses.js:151-153,239-279,869`) found both naive designs either duplicate 061's 1,670 live rows or silently skip every mortgage row. paid_by/created_by: confirmed unchanged (`historicalActorName()`/`HISTORICAL_ACTOR_ID`, `:93,106-122,526-533`, source-agnostic). Undo scope: new prefix, year-scoped to 2023/2024, explicitly does not touch 062's 2022 ids.
- DONE: Write a top-level `## Acceptance criteria` section (sibling of `## Spec`) where each AC is an end-state property with a `Verified by: {offline|interactive}` clause and a `Falsified by:` clause; include a falsifiable AC for the column-A PII exclusion and for the before/after no-row-altered guarantee.
  14 ACs (AC-1–AC-12 offline, AC-13/AC-14 interactive). AC-1 is the no-row-altered guarantee (snapshot/diff). AC-6 is the column-A/B/C PII exclusion, falsified by widening the range to `A5:K255`. AC-4 carries the id-collision finding with its own falsifier.
- DONE: Fill in Risk evidence, Expected surface and tolerance, and Test plan per the template.
  Risk evidence cites four live-verified findings: the column-K read (probe), the id-namespace collision (code trace + live id-range read on staging vs production), the row-125 duplicate-date abort (live probe reproducing a gap in 062's own fix), and paid_by/Mortgage-category reconfirmation. Surface: +320 LOC/5 files, tolerance ±50%, citing 061's and 062's own tolerance overruns as the reason for the wide band. Test plan proposes reusing 062's own seeded-decoy-on-staging technique for AC-4/AC-5, since staging holds no historical rows to collide against.

### Summary

Resolved all three ideation open questions with code-level and live-sheet evidence rather than assumption: a read-only probe of the House tab (D5:K255) confirmed the 2023-03-15 prepayment's exact source row, and a read-only probe of both target Expenses tabs' ids (staging: zero historical rows; production: 1,670) exposed that combining mortgage and Daily-tab rows under one per-year id counter — the shape 062 used safely for an empty 2022 — would either duplicate or silently swallow rows against 061's populated 2023/2024 data, and that a staging rehearsal cannot catch either failure since staging never holds those pre-existing ids. The spec's design (a distinct `exp-hist-mortgage-` id namespace, a sheet holding only the new rows) resolves this by construction. A second live-verified defect was found: the House-tab mortgage extractor throws on a real 2024 row (source row 125) that 062's own out-of-scope-year fix does not cover once 2024 is actually requested. Both findings are backed by AC-4/AC-5 and AC-7 respectively, each with a stated falsifier.

## Build implementation plan

Three changes to 062's already-shipped extractor/importer, each additive and year-gated so 062's own 2022 mortgage-row behaviour (already live in production) is untouched by construction, not by care.

**1. Id-namespace change (AC-4, AC-5, AC-8).** `import-historical-expenses.js`'s `planImport` currently mints every candidate's id from one counter map keyed by `year`, via `historicalId(year, n)` → `exp-hist-{year}-{NNNN}`. Add a second counter map, used only when `row.source === "mortgage" && MORTGAGE_ID_YEARS.has(row.year)` (`MORTGAGE_ID_YEARS = new Set([2023, 2024])`), driving a new `mortgageHistoricalId(year, n)` → `exp-hist-mortgage-{year}-{NNNN}`. Every other row — every Daily-tab row of any year, and 062's own 2022 mortgage rows — keeps using the untouched `counters` map and `historicalId`, byte-identical to today. Because `MORTGAGE_ID_PREFIX` ("exp-hist-mortgage-") is a superstring of `ID_PREFIX` ("exp-hist-"), every existing `id.startsWith(ID_PREFIX)` check (AC-1's snapshot diff, AC-2/AC-10's provenance scan) still classifies mortgage rows as historical without modification. Undo gets a parallel `scopedMortgagePrefixesForYears(years)` and a `--mortgage-only` CLI flag on `--undo` so this entity's own standalone undo can target `exp-hist-mortgage-2023-`/`2024-` without touching `061`'s Daily-tab prefix; `--rehearse`'s own undo step is changed to derive the prefix(es) actually used per candidate (via an `idPrefix` field stamped onto each candidate at plan time) rather than from years alone, so a combined-source rehearsal cleans up exactly what it wrote regardless of flags.

**2. Two-row J/K emission (AC-2, AC-3, AC-10).** `extractMortgageRows` reads `row[6]` (J) only today. Add `row[7]` (K, now in range under the widened `D5:K255`). Restructure the per-row body into: compute `dEmpty`/`jEmpty`/`kEmpty`; skip silently only when all three are blank (pure schedule padding); if `dEmpty` is true and either J or K holds a value, abort naming the row (unchanged guard, now checking both columns); otherwise parse the date, skip silently if its year is out of scope; then independently emit a J-row (key `{year}-mortgage-r{sourceRow}`, unchanged from 062) when J is populated, and a K-row (key `{year}-mortgage-prepay-r{sourceRow}`, new) when K is populated — so a row can contribute 0, 1, or 2 rows. `buildNotes` gains a case: a key ending `-prepay-r{N}` renders `House tab row {N} (prepayment) | key=...`; a plain `-r{N}` key renders exactly as before (no `(regular)` suffix), so 062's already-shipped notes format and its existing unit test are unaffected. `parseNotes` gains a matching optional `(prepayment)` group, defaulting to `paymentKind: "regular"` when absent — which is also the correct reading of every already-written 2022 row.

**3. Row-125 edge case (AC-7).** Falls out of the restructure in (2) directly: a row with a populated date and both J and K blank no longer reaches the `dEmpty !== jEmpty`-shaped abort (that check now only fires when D itself is blank), and instead contributes zero rows via the same early return used for pure padding, once out-of-scope-year rows have already been filtered. No separate special case needed beyond ordering the checks as: all-three-blank skip → D-blank-with-payment abort → year-scope skip → both-payments-blank skip → per-column emission.

**Also:** `migration-env.js`'s `HOUSE_RANGE` widens from `D5:J255` to `D5:K255` (comment updated to match); `readHouseGrid`'s AC-6 test and falsifier, and the fixture generator, move with it. `functions/test/fixtures/house-mortgage.json` gains 2023 (12 months + the K-populated 03-15 row) and 2024 (12 months + a row-125-shape blank-dated padding row ahead of 11-15) sections, appended after the existing 2022 section so every 2022-scoped assertion keeps its current row indices and values.

## Stage Report: build

- DONE: Write a brief implementation plan before coding begins, covering the id-namespace change, the two-row J/K emission, and the row-125 edge case.
  `## Build implementation plan` section above this report, commit 1ec28cd.
- DONE: Implement per spec — mortgage id namespace, two-row emission, row-125 skip, HOUSE_RANGE widened, payment-kind notes marker, scoped undo — meeting all 14 ACs, no regressions to 061's/062's rows.
  Commits 94441f7 (core implementation) and 5227af7 (end-to-end test). Full suite `node --test test/` (built via `npm run build`): 294/294 passing, including every pre-existing 061/062 test unmodified in behavior (three pre-existing tests' *expected values* were updated where the shared fixture or the row-125 semantics they exercised genuinely changed — see AC evidence below — never their assertions' intent).
- DONE: Document every acceptance criterion's status (met, with evidence) in the stage report, including the offline tests run and results for AC-1-AC-12; AC-13/AC-14 remain interactive and are not self-checked here.
  Per-AC evidence:
  AC-1 (met): snapshot/verify diff reports 0 pre-existing modified/deleted — `AC-1/AC-4/AC-5/AC-8/AC-9/AC-10 (064): a 2023/2024 mortgage-only sheet applies clean...`.
  AC-2 (met): exactly 12 J-sourced rows per year — `AC-2: 2023 and 2024 each yield exactly twelve regular J-sourced rows...`.
  AC-3 (met): 2023-03-15 emits two distinct-keyed rows, not a sum — `AC-3: the 2023-03-15 row carries both...` + falsifier `AC-3 falsified: summing J and K into one row...` (fails on the pre-fix shape, passes on the real code).
  AC-4 (met): mortgage id namespace collision-free by construction, 2022 unchanged — `AC-4: 2023/2024 mortgage rows mint under exp-hist-mortgage-...`, `AC-4: 062's own 2022 mortgage rows keep minting under the OLD shared prefix...`, falsifier `AC-4 falsified: reverting to a single shared ID_PREFIX...` (reproduces a collision with a real production-shaped id, `exp-hist-2023-0001`).
  AC-5 (met): `--undo --mortgage-only` removes exactly this run's rows, 061's Daily rows and 062's 2022 mortgage row survive — `AC-5: --undo --mortgage-only removes only exp-hist-mortgage-{year}- rows...`, falsifier `AC-5 falsified: forgetting --mortgage-only deletes 061's live Daily rows...`, and the end-to-end test's own undo step.
  AC-6 (met): read range is exactly `D5:K255`, never wider — `AC-6: the House-tab reader's range is bounded to D5:K255...`, falsifier `AC-6 falsified: reading the House tab with an unbounded range...`; this file, the fixture, and the entity file were checked for the column-A shape (bank/branch/account/name) and none match.
  AC-7 (met): a populated-date, J-and-K-blank row is skipped, not aborted — `AC-7: a row whose date is populated but whose J and K are both blank...`, falsifier `AC-7 falsified: without the third case, the live row-125 shape reproduces this spec's own abort`. A pre-existing 062 test exercising the same input shape (`D` populated, `J` blank) under the OLD "always abort" semantics was updated to assert the new skip behavior — the row-125 fix is exactly this generalization.
  AC-8 (met): a second apply writes nothing for this run's rows — the end-to-end test's second `--apply` (`created: 0`, all skipped).
  AC-9 (met): category resolves pre-write against the target's live tab, none created — end-to-end test (`categoriesBefore === categoriesAfter`, `cat_099` resolved); mechanism (`resolveCategoryNames`) is unchanged/reused from 061.
  AC-10 (met): notes distinguish regular vs. prepayment and name the source row — `AC-10: a prepayment row's notes carry a (prepayment) marker...` plus the end-to-end test's per-row `parseNotes` check; 062's own already-shipped regular-row notes format and its AC-10 test are unchanged except for the added `paymentKind` field the parse now also returns.
  AC-11 (met): no House-tab figure, vendor name, or account identifier committed. The fixture uses invented numbers only (`generate-house-mortgage-fixture.js`); this build ran no live `--report`/`--generate` against real credentials (none available in this environment), so nothing was written outside version control. This entity file and the diff contain no real payment figure.
  AC-12 (met, inherited): refuses without an explicit target — `resolveTargets` is untouched by this entity; pre-existing test `AC-12: the import refuses to run without an explicit target, and writes nothing` still passes unmodified.
  AC-13 / AC-14 (not self-checked): interactive, per the spec's own split — require a live drive of the deployed app and are deferred to that stage.

### Summary

Implemented the three changes from the build plan: a year-gated `exp-hist-mortgage-{year}-{NNNN}` id namespace and counter (2023/2024 only; 062's 2022 mortgage rows keep minting under the old shared prefix, untouched), two-row J/K emission from `extractMortgageRows` with a generalized three-case classifier that also fixes the row-125 duplicate-date abort, and the widened `D5:K255` read range with a payment-kind notes marker. All 14 ACs are addressed; AC-1 through AC-12 have offline evidence (85 test cases in `historical-expenses.test.js`, 294/294 passing across the full `functions/test/` suite), AC-13/AC-14 remain interactive per the spec. Surface: `git diff --numstat` against the merge-base with `main` shows 801 insertions / 106 deletions across 6 files (net +695) versus the declared +320 (±50%, 160-480) estimate — each of the three script files individually landed within or under its own declared per-file band (extractor +18 net, importer +65 net, migration-env +2 net); the overrun is concentrated in `functions/test/fixtures/house-mortgage.json` (+266 net), a generated, pretty-printed JSON data file where each of the 25 new synthetic rows costs ~10 lines of mechanical array formatting rather than hand-written logic, and in the test file itself (+306 net) from the falsification-style tests the entity's own risk section anticipated. No regression was found in 061's or 062's already-imported-row behavior; the id-namespace, notes-format, and row-125-shape changes are all deliberately backward-compatible by construction rather than by added compatibility code.

## Stage Report: verify

**Recommended verdict: REJECTED.** A material, live-reproduced gap between the approved spec and the shipped code: the extractor cannot actually produce the mortgage-only normalization sheet the spec promises. Everything else this stage could independently verify checks out — full clean offline suite, two live falsification reintroductions, PII sweep clean — but this one finding blocks a safe staging rehearsal and both interactive criteria, so it is not passed to the captain.

- FAILED: Verify AC-2/AC-3 by a live `--dry-run`/`--report` against the real House tab, per their own stated verification method.
  Live command run against the real archive + House sheets (staging service account, read-only): `node -r ./scripts/load-local-env.js scripts/extract-historical-expenses.js --report --years 2023,2024` returned `[extract] 1670 Daily-tab row(s) total across 2 in-scope band(s)`, `[mortgage] 25 House-tab row(s) total`, `[extract] 1695 combined row(s) (Daily + mortgage)`. Confirmed this is not an artifact of the explicit `--years` flag: `IN_SCOPE_YEARS = [2023, 2024]` (`functions/scripts/extract-historical-expenses.js:86`) is also the default with no `--years` flag at all, and `run()` (`:1352-1356`) unconditionally does `result.rows = [...result.rows, ...mortgage.rows]` — there is no CLI flag on either script (`parseArgs` in both files, checked exhaustively) that scopes `--generate`/`--report` to mortgage rows only. This directly contradicts the approved spec's own resolution, quoted from this file: "The normalization sheet this entity generates therefore holds only the new mortgage rows for 2023/2024; it does not re-list 061's already-imported Daily-tab rows" (line 108). The 25-row mortgage count itself is correct (13 for 2023 including the prepayment, 12 for 2024, matching AC-2/AC-3) — the defect is that the real tool cannot deliver that count in isolation; every real invocation also re-attaches the 1,670 Daily-tab rows `061` already put on production.
  Consequence, stated plainly: the automated suite's own end-to-end test for this shape (`AC-1/AC-4/AC-5/AC-8/AC-9/AC-10 (064)`, `historical-expenses.test.js:1485`) does not cover this — `makeMortgageOnlyWorld()` (`:1463-1466`) calls `extractMortgageRows()` directly and hand-builds the normalization tab in memory, bypassing `run()`'s combined-generate path entirely. So 85/85 green in that file proves the importer handles a mortgage-only sheet correctly once one exists, not that the shipped tool can produce one. I did not find this by reading code and guessing; the tests all pass and read as if this shape were exercised. I found it only by actually running the real command against the real source, which build's own report says it had no credentials to do in its environment.
  Why I did not proceed to `--generate`/`--apply` on staging with the real output: staging holds zero `exp-hist-` rows of any year (reconfirmed this stage, see below), so the 1,670 Daily-tab rows in the combined sheet would recompute to ids staging does not have and would be created as real new rows there — an unintended ~1,670-row pollution of the staging Expenses tab, not the 25-row mortgage-only rehearsal the entity's own test plan describes. Running it to "see what happens" would trade a container that already exists (the automated test) for a live mutation with real cleanup risk, for no additional evidence the code doesn't already make plain.

- DONE: Independently re-run and falsify the rest of the offline surface from a clean build.
  Fresh `npm install` in both `functions/` and `app/` (absent in the worktree; resolved via `functions/scripts/load-local-env.js`'s own git-common-dir fallback for env files, not needed for node_modules). `npm run build` (tsc): clean, no errors. Full suite `node --test test/`: **294/294 passing** (matches build's own count), including **85/85** in `historical-expenses.test.js` alone.
  Falsification, reproduced directly against the shipped source (not the test harness's internal patch), each restored via `git checkout --` and reconfirmed clean (`git status --short` empty) before moving on:
  - AC-4: replaced the year-gated `mortgageCounters`/`historicalId` split (`import-historical-expenses.js:302-313`) with the old single shared `counters` map and unconditional `historicalId(row.year, next)`. Result: **3 tests went red** — `AC-4: 2023/2024 mortgage rows mint under exp-hist-mortgage-...`, `AC-4 falsified: reverting to a single shared ID_PREFIX...` (the named falsifier itself, now correctly failing on the reverted code), and the combined end-to-end test. Everything else stayed green (82/85).
  - AC-7: changed the row-125 skip (`extract-historical-expenses.js:951-953`, `if (jEmpty && kEmpty) return;`) to throw `ExtractError` instead of returning. Result: **11 tests went red**, including the exact named falsifier `AC-7 falsified: without the third case, the live row-125 shape reproduces this spec's own abort` and both AC-7 tests, plus AC-2/AC-3/AC-4 and the combined end-to-end test (which all touch the same fixture rows). Restored, suite back to 85/85.
  Neither the suite nor the falsifiers are tautological for the mechanisms they cover — both real defects, reintroduced into the actual shipped files, turned exactly the expected named tests red and nothing else was silently masked.

- DONE: Run the Mandatory PII / Secrets Check over the full branch diff.
  PASSED. `git diff` across the full branch (`main`...`HEAD`) grepped for private-key markers, API keys, passwords, secrets, `client_email`, and email addresses: 0 matches. `git diff --name-only` contains no `.env*` file. The one bank/branch/account-shaped string in the diff, `test/historical-expenses.test.js:830` (`"BANK / BRANCH / 1234-5678 / 王小明"`), is a synthetic structural-marker string asserting the AC-6 falsifier actually detects column A's shape if the range were ever widened — not real data, same convention `062` used. `git check-ignore -v` confirms `functions/backfill-reports/` is gitignored, including the live variance-report file this stage's own `--report` run wrote there (`061-source-variance-2026-09-07.md`) — checked directly, contains only row/band counts, no payment figures. No real payment amount, vendor name, or account identifier appears in this entity file, the diff, or any committed fixture.

- DONE: Confirm staging is live and this branch needs no redeploy.
  `git diff --name-only` against `main` touches only `functions/scripts/`, `functions/test/`, and this entity file — nothing under `functions/src/` (compiled to `lib/index.js`, the actual deployed Functions entrypoint per `functions/package.json:8`) or `app/`. Live `curl -sI` against `https://expense-sheet-staging.web.app/`: **200**; `/reports/`: **200**; `/history/`: **200**; unauthenticated `GET /api`: **401** (fails closed). The deployed app already reflects this branch's effective behavior; no redeploy was performed or needed.

- SKIPPED: AC-13 (Reports/Annual totals for 2023/2024 including the new mortgage rows).
  Blocked by the FAILED item above: no correct, isolated mortgage-only sheet can currently be produced and approved through the real tool without also risking a ~1,670-row pollution of staging. Substituting a hand-fabricated sheet (bypassing `--generate`, the way the unit test does) would test the importer and Reports again, not the actual promised captain-facing mechanism — the same substitution `062`'s verify stage was corrected against for using a parallel computation instead of a live drive. Not attempted for the same reason.

- DONE, with an honest limit stated: AC-14 (everyday add/see/delete-expense, History) — mechanism-level live evidence only, no data dependency on this entity's own changes.
  `curl -sI` above (`/`, `/reports/`, `/history/` all 200; `/api` 401 unauthenticated, correct fail-closed) confirms the deployed routes serve and this entity's changes (scripts/tests only) cannot have altered them. No authenticated browser session for the captain's own identity exists in this environment — the same constraint `061`'s and `062`'s verify stages hit, and no test-only auth path exists in this repo (`app/app/lib/`, checked). The actual add/see/delete/History click-through is the captain's own manual test, given below, independent of the rejected item since it touches no mortgage data.

### The captain's manual test for AC-14 — staging only, does not depend on the rejected item above

1. Open **https://expense-sheet-staging.web.app** and sign in with your usual Google account.
2. Tap **Home**. Add an expense the way you normally would — any amount, any category. Expect: it appears in today's list immediately.
3. Delete the expense you just added. Expect: it disappears.
4. Tap **History**. Expect: the page loads and shows your existing rows.
5. Tell the first officer whether steps 2-4 behaved as expected.

**AC-13's manual-test steps are not given here** — the mortgage rows are not safely on staging yet, for the reason in the FAILED item above, so there is nothing correct for you to look at for 2023/2024 totals until build addresses the generate-sheet gap.

### Summary

Independently re-verified the offline surface build already claimed — clean rebuild, 294/294 full suite, 85/85 in the entity's own test file, plus two live falsification reintroductions (AC-4's id-namespace revert, AC-7's row-125 abort revert) that each turned exactly the expected named tests red and nothing else, confirming the guards are real rather than tautological. The PII/secrets sweep is clean, and staging is confirmed live and current with no redeploy needed since this branch touches no deployed code. The blocking finding is new this stage, not carried from build: a live `--report --years 2023,2024` against the real archive and House sheets shows the extractor's `--generate`/`--report` always combines 1,670 already-imported Daily-tab rows with the 25 new mortgage rows into one sheet — there is no flag on either script to isolate mortgage rows, contradicting the approved spec's explicit "holds only the new mortgage rows" resolution (line 108). The automated end-to-end test never catches this because it hand-builds the mortgage-only sheet in memory rather than going through the real generate path. Recommend routing back to build with this citation: add a way for `--generate`/`--report` (and ideally `--dry-run`) to scope to mortgage rows only for years whose Daily-tab data is already live elsewhere — for example a `--source mortgage` flag that skips the archive `extract()` call in `run()` (`extract-historical-expenses.js:1349-1356`) — so the sheet the captain is asked to approve actually holds only what this entity adds. AC-2/AC-3/AC-13 depend on this fix; AC-14's mechanism-level evidence and manual-test steps are given above and do not.
