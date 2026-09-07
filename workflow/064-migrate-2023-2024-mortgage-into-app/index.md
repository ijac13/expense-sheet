---
id: 064
title: Migrate 2023–2024 Mortgage Payments Into The App
status: spec
source: captain
started: 2026-09-07T00:38:44Z
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
