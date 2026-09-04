---
id: 062
title: Migrate 2022 Historical Expense Data Into The App
status: spec
source: captain
started: 2026-09-04T01:11:34Z
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
        - id: gate:062:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:062-ideation-1
              briefing:
                id: briefing:062:ideation:attempt-1:revision-1
                digest: sha256:0db600c44ec2971dcb453e9d1f378e00e31613f32ea19ebfc545493e234414ec
                room-ref: ./review/ideation/briefing-1
              withdrawal:
                by: agent:first-officer
                at: "2026-09-04T01:15:18.806988Z"
                reason: Entity body amended after this gate was bound. Commit e4a88da landed between the state commit that produced the bound Briefing and now, adding the captain's stated reason for the combined-import ruling, a pointer to reusing 061's two-source extractor/importer shape, 060's full House tab recon so spec does not re-derive it, and the column-J-over-interest-only decision with its reversal reasoning. All additive context that strengthens the gate; nothing contradicted. The bound Briefing predates all of it.
            - id: gate-attempt:062-ideation-2
              briefing:
                id: briefing:062:ideation:attempt-2:revision-1
                digest: sha256:cd423d495442715eb7a61dbc077ca343e92d2f589e2d5d70dadb3662a12e9600
                room-ref: ./review/ideation/briefing-2
              resolution:
                type: Resolution
                id: resolution:spacedock:062:ideation:2
                briefing: briefing:062:ideation:attempt-2:revision-1
                by: person:captain
                at: "2026-09-04T01:36:10.76962Z"
                decision: approve
                reason: 'Captain approved the combined 2022 import: regular Daily-tab expenses and the year''s twelve mortgage payments together, so 2022 never appears in the app as a partial year. Both prior open questions settled: column J dated by column D (same as 064), and no prepayment complication in 2022. Spec is instructed to verify whether 2022 repeats 061''s formula boundary errors before the captain reads any 2022 totals, and to propose extending 061''s extractor/importer to a two-source-per-year shape rather than a parallel pipeline.'
              application:
                target-stage: spec
                state: consumed
---

Extend the historical import to 2022, so the app holds a third year alongside the 2023–2024 records delivered by `061` — and, in the same pass, 2022's twelve mortgage payments, so 2022 lands as one complete year rather than an expenses-only or mortgage-only partial import. This is decided scope, not an open question: the captain ruled that this entity imports 2022's regular Daily-tab expenses AND 2022's twelve mortgage payments (column J of the `House` tab, dated by column D, spreadsheet `1oUCppCwkfw2BMG8gZwxb13Vq8KVXBQFrVoS57ZH9h6E`) together, in one pass. She was asked directly whether 2022 should land as base expenses only with mortgage added later, or as one combined import, and chose combined for a stated reason: a mortgage-only or expenses-only partial year would misrepresent 2022 in every Reports screen that reads it. This is her reasoning, not scope creep. Expected to be small: `061`'s extractor already discovers the 2022 band and reads it only to find the boundary.

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
- **The tooling may already be a flag away.** `061` notes that reversing its 2022 exclusion is a `--years` flag. Spec should verify that claim by exercising it rather than trusting the note, and say plainly if more is needed. `061` built `extract-historical-expenses.js` / `import-historical-expenses.js` with a human-approval step structurally between reading the source and writing to the app; since this entity's import now spans two sources (the `Daily` tab and the `House` tab), spec should propose extending that tooling to read a second source per year — one normalization sheet fed by both — rather than inventing a parallel pipeline. That shape is spec's call, not decided here.
- **The `House` tab is already fully characterized — cite it, do not re-read it.** `060`'s ideation ensign read it in full: workbook `Coast FIRE_ijac.wei`, spreadsheet `1oUCppCwkfw2BMG8gZwxb13Vq8KVXBQFrVoS57ZH9h6E`, tab gid `1358685274`, 255 rows × 28 cols, data from row 5. Column J `實際月付` (actual monthly payment) is numeric, 209 typed literals and 31 formulas. Column D `還款日期` is the adjacent date column, populated on every row. The schedule spans 2014-11-17 to 2034-10-15, 240 monthly rows, zero non-monthly gaps — 2022 has exactly 12.
- **Column J (the full payment) is the settled column choice, not open.** A full monthly payment is both principal and interest; only interest is real consumption, principal repayment is a transfer into equity the captain still owns. The captain was first advised to import interest only, then overruled that and chose the full payment (column J) instead, on the reasoning that her own 2025 app record already holds `Mortgage` as a flat full-payment estimate — importing J keeps 2022–2024 measured consistently with what 2025 already represents. State this as her decision in the spec, not as a re-opened question.
- **2022 has no principal prepayment.** The mortgage schedule's six prepayment dates are 2015-07-15, 2020-02-15, 2021-02-15, 2023-03-15, 2025-03-15 and 2025-11-15 — none fall in 2022. So 2022's twelve mortgage rows are all regular monthly payments; the prepayment-treatment decision the captain made for `064`'s 2023-03 row does not apply here.
- **The PII hard constraint extends to the mortgage sheet.** `061` established that no cell from the archive workbook's sensitive columns reaches the app, a notes field, a report, or the repo. `060`'s ideation ensign confirmed the same hazard on the mortgage sheet: column A row 2 of the `House` tab holds a bank name, branch, full account number and an account-holder personal name in a single cell. Any acceptance criterion this entity writes must assert, falsifiably, that no cell from that column reaches the app, a notes field, a report, or the repo.
- **Access to the mortgage sheet is broader than the archive workbook's.** Both the staging and production service accounts read the mortgage sheet — confirmed working for both, unlike the archive workbook where only staging reads. A single-credential design may be viable here, but this is a fact about which accounts the captain granted rather than about the code, and should be asserted at runtime rather than assumed.

### Verified at spec — by reading the live sheet, not by trusting `061`'s notes

Every claim below comes from running `061`'s own extractor functions (`extract-historical-expenses.js`) against the live archive workbook with `years: [2022, 2023, 2024]`, and from reading raw cell content, formulas (`valueRenderOption=FORMULA`), and merge metadata directly via the Sheets API. None of it is inferred from `061`'s report.

**Does 2022 have the same formula range errors? — ANSWERED: no, it does not repeat the pattern; it has its own, different one.**
`061` Finding 6 found five of twelve month-total row-chains per year carrying boundary errors, the *same* five months in both 2023 and 2024 (June/July/September/October/December, plus February's leap day in 2024). Reading 2022's own per-row month-total chains (row 62's data rows, 63–88) and comparing each chain's referenced column range against the actual day-amount columns for that month finds boundary mismatches in **March, April, July, August, October and November** — six months, not five, and a different set entirely. August's mismatch is not a chain-range bug at all; it is caused by a separate defect (below). This is worth telling the captain plainly and separately from the totals: whatever 2023/2024's repair manual said about "the same five months every year," it does not carry over.

**What is 2022's actual date span? — ANSWERED: a complete calendar year, unlike 2024.**
The band's date-header row carries dated cells from **2022-01-01 to 2022-12-31**, 364 of the 365 possible calendar dates present (only 2022-11-30 has no dated header column at all — see the ZI/ZJ finding below, which explains that exact gap). This is structurally a full year, closer to 2023's shape than to 2024's, which `061` found stops at 2024-11-08. Set the captain's expectations accordingly: 2022 should show spending in all twelve months once the shape issues below are resolved.

**Row volume.** The 2022 band accounts for 837 day-amount cells before the shape issues below are resolved (closer to 2024's 775 than 2023's 895). Combined with 061's twelve mortgage rows and the ~1,670 rows already in the app from `061`, the total after this entity lands around 2,500 rows — the same order of magnitude `061` already proved has no pagination problem anywhere in the app. Not a concern; not re-litigated as its own acceptance criterion.

**Do `061`'s deferred-risk Findings 5 and 7 promote under 2022's real data? — ANSWERED: neither promotes.**
- **Finding 5 (unmapped taxonomy pair silently lands in `Other`) — does not promote.** Read live: 2022's columns B and C hold exactly the same **17** distinct `(項目大類, 項目分類)` pairs as 2023 and 2024, and all 17 already resolve through `CATEGORY_MAP` — 0 unmapped. 2022 introduces no eighteenth pair.
- **Finding 7 (AC-19's accounting window is blind to numeric cells in label/header rows) — does not promote.** `061`'s own writeup already checked this for 2022, not just 2023/2024 ("Numeric cells in a label row... 0. ... For 2023, 2024 and 2022 alike."). Re-confirmed here: no need to re-run it.

### 2022 is not a flag away — three source-shape defects, found by exercising the extractor, not assumed away

`061`'s note that reversing the 2022 exclusion "is a `--years` flag" does not hold. Two things are wrong with the claim itself: no CLI `--years` flag exists today (`extract-historical-expenses.js`'s `run()` calls `extract(grid)` with no years argument at all; only the internal `IN_SCOPE_YEARS = [2023, 2024]` constant would need to change, and nothing wires it to `parseArgs`). And even granting that as trivial build work, calling `extract(grid, { years: [2022, 2023, 2024] })` against the live source **throws today**:

    ExtractError: Band 2022: whole-band accounting failed. 837 day-amount + 4 day-item-name +
    312 month-total = 1153, but the band holds 1157 numeric cells from column F onward — 4
    unaccounted. Unclassified columns holding data: NO (4 cells, label "金額").

Reading past that abort found three distinct, real defects in 2022's source shape, none present in 2023 or 2024:

1. **An extra, undated `金額` column for 2022-07-01 (column NO), holding a second entry for four different category rows.** The normal pairing is one dated `品名` column (`NM`, 2022-07-01) followed by its amount column (`NN`, blank label, claimed correctly). Column `NO` sits immediately after `NN`, also labelled `金額`, but is not the amount column of any dated item-name column and carries no header date of its own — so the classifier cannot place it. It holds four real values (rows 63, 64, 66, 69 — `食材`, `外食餐廳`, `加油`, `家用品`), each a second amount for 2022-07-01. This is what aborts the run today. AC-19's whole-band accounting is doing exactly its job — refusing to emit rather than silently dropping four real expenses — but the classifier needs to be extended to place this shape (a second same-day amount column), or the run cannot proceed on 2022 at all.
2. **Most of August 2022 (Aug 2–31) carries its date on the wrong column.** Every other month puts the date on the `品名` item-name column's header and leaves the `金額` amount column's header blank. From August 2 onward, that is reversed: the `品名` column's header is blank and the *next* column (`金額`) carries the date instead. Classified today, this makes at least 29 August rows `iso: null` — undated. `061`'s D4 ruling found **zero** undated rows in 2023/2024 and closed the question with "the hand-correction job is 0 rows"; that code path (`emitBandRows`'s `undated` branch, `date_source: "missing"`) exists but has never actually run against live data. 2022 is the first year that exercises it, at meaningful scale.
3. **A day column at `ZI`/`ZJ` carries a stale date, most likely a genuine November 30th entry mislabeled as October 31st.** Positional evidence: `ZG`/`ZH` is 2022-11-29 (correct), `ZK`/`ZL` is December's month-total/2022-12-01 (correct) — `ZI`/`ZJ` sits in between, exactly where November 30th belongs, but its header reads the serial for **2022-10-31**. This is the direct explanation for the "missing" 2022-11-30 found in the date-span measurement above: the column exists, it is simply mis-dated. Unlike case 2, this row is **not** undated — it is a well-formed date, just the wrong one, sitting inside the correct year — so AC-4b's "row's own date must fall inside its band's declared year" check would not catch it. Left alone, it would silently import as October 31st spending that actually belongs to November 30th.

None of these three is hypothetical or a restatement of a symptom already reported — each is cited by exact column reference, row numbers, and the specific cell values or header serials that show it, reproduced against the live sheet in this stage. Extending the extractor to 2022 is real classifier work, not a flag flip.

### The undo mechanism is scoped too broadly for this entity to reuse unchanged

Reading `import-historical-expenses.js` directly (not assuming from `061`'s report): `deleteRowsByIdPrefix(sheets, spreadsheetId, prefix, log)` takes a `prefix` argument and is generic, but both of its call sites (`:749` dry-run/apply-undo and `:977` the `--undo` phase) pass the module-level constant `ID_PREFIX = "exp-hist-"` unscoped. Undo today deletes **every** row whose id starts with `exp-hist-`, not just the ones a given run added. `061`'s 2023/2024 rows already carry that prefix (`exp-hist-{year}-{NNNN}`). Running 062's `--undo` with the code unchanged would delete `061`'s already-approved, already-live 2023/2024 rows along with 2022's — directly violating this entity's own Out of Scope guarantee ("Re-importing or altering the 2023–2024 rows `061` delivers") and its Success bullet ("No existing row altered or lost"). This needs a narrower prefix passed at the call sites (e.g. this run's own year/source-scoped ids), not a behavior change to `deleteRowsByIdPrefix` itself, which already supports it.

### Two-source design — one normalization sheet, two readers, reusing `061`'s shape rather than paralleling it

Extend `extract-historical-expenses.js` to read a second source per year: the existing `Daily`-tab reader (extended per the three defects above), plus a new `House`-tab reader bounded to `D5:J255` — never touching column A or the columns between A and D. Both readers feed **one** normalization sheet, distinguished by a `source` field per row (`daily` | `mortgage`). Reuse the exact never-overwrite / `--carry-from` mechanism `061` built rather than inventing a second one: `--generate --into "<tab>"` refuses to overwrite an existing tab; a re-generate carries the captain's hand corrections forward by `key`. Mortgage rows get their own `key` shape (`{year}-mortgage-r{sourceRow}`, keyed off the House tab's own row) and their `category_name_en` is fixed to `"Mortgage"` directly rather than run through `CATEGORY_MAP` — column A/B/C's taxonomy has no equivalent on the House tab. `import-historical-expenses.js` needs no change to its core write loop — it already writes whatever rows the approved sheet marks `include` — but its undo and its category pre-write guard both need the scoping/verification work named above.

## Spec

### Goal

Land the captain's 2022 historical Daily-tab expenses and her twelve 2022 mortgage payments (House tab column J, dated by column D) together, as one combined pass, so 2022 becomes a third complete year in the app alongside 2023 and 2024 — reusing `061`'s extractor/importer/normalization-sheet shape, extended for a two-source year rather than replaced.

### User Stories

- As the captain, I want 2022 in the app alongside 2023 and 2024, so year-over-year comparison in Reports covers three years instead of two.
- As the captain, I want 2022's mortgage payments included in the same import as its regular expenses, so 2022 is never a partial year missing one or the other.
- As the captain, I want to be told plainly whether 2022 repeats the formula errors she found in her own workbook for 2023/2024, rather than have the entity assume the pattern and be wrong about it.
- As the captain, I want the same safety properties `061` earned — reviewable sheet, my approval before any write, staging rehearsed first, a working undo that never touches 2023/2024's rows, and no personal or financial data from either source workbook ever reaching this repository.

### Edge Cases

- **A source column the current extractor cannot classify (the `NO` shape).** The run must abort loudly, naming the column and cell count — never proceed with a partial, silently-short extraction. This is the behavior AC-19's whole-band accounting already gives `061`; 2022's extension must not regress it.
- **A day whose date lands on the amount column instead of the item-name column (the August shape).** These rows must surface to the captain on the normalization sheet as needing a date (`status: undated` / `date_source: "missing"`), not be silently imported with a blank or guessed date, and not be silently dropped either.
- **A day column carrying a date that structurally looks wrong (the `ZI`/`ZJ` shape) — a well-formed, in-year, but likely mis-dated cell.** No existing check catches this class (it is not undated, and its date is inside the correct year). The variance/extraction report must name it explicitly so the captain can confirm or correct it before approving, rather than have it import silently under the wrong day.
- **Undo run after this entity's rows are live.** Must remove only what this entity's own run added — 2022's daily and mortgage rows — and must leave every `061`-sourced 2023/2024 row untouched, proven by a before/after diff of those specific rows, not merely asserted from the id prefix looking similar.
- **A House-tab row that is not one of the twelve regular 2022 monthly payments** (e.g. a prepayment, which 2022 happens not to have, or a row with a missing column D or J value). The importer should refuse to guess and should name the row rather than skip it silently.
- **Two users viewing Reports while the import runs.** Unchanged from `061` — the import writes new rows only, so a concurrent read sees either the pre- or post-import state, never a half-written row.

### Out of Scope

- Any year other than 2022. `060` owns the 2006–2025 analysis and the remaining archive years.
- 2023–2024 mortgage payments — entity `064`'s job, not this entity's.
- Re-importing, altering, or being deletable by the same undo as, the 2023–2024 rows `061` delivers.
- Any new app UI. This lands data, not screens.
- Fixing the captain's workbook — neither the `061` Finding 6-class formula boundary errors nor the three 2022-specific source-shape defects found at this stage. Diagnosing and reporting them plainly is this entity's job; repairing her spreadsheet is hers.
- A general repair of `deleteRowsByIdPrefix`'s scoping for every future historical-migration entity (`064` included). This entity only needs its own run to be safely undoable without touching `061`'s rows; the broader generalization, if wanted, is a separate decision.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

Verification split: **offline** — AC-1 through AC-16. **Interactive** — AC-17, AC-18. No harness is built to automate AC-17 or AC-18; both are judged on a live drive of the deployed app, per the pattern `061` already established for its own AC-7/AC-8.

**Carried from `061` unchanged in mechanism, extended in scope where the two-source/three-year shape requires it:** AC-1, AC-2, AC-4, AC-7 (was AC-5), AC-9, AC-10, AC-11, AC-12, AC-14 (was AC-14/AC-18), AC-16 (was AC-16), AC-17/AC-18 (was AC-7/AC-8). **New to this entity:** AC-3 (the 2022 classifier extension), AC-5 and AC-6 (the mortgage source and its PII constraint), AC-8's undo-scope guarantee (recut from `061`'s AC-6 because reading the code found a real gap, not a hypothetical one), AC-13 (the runtime credential-access check), AC-15 (diagnosis, not just detection, for 2022's own irregularities — closing `061`'s own Finding 8 gap for this entity's data).

**AC-1 — No pre-existing expense row, of any year, is altered or deleted by this import.**
Verified by: offline — `--snapshot` writes the full Expenses tab before the run; `--verify` diffs it against the post-import tab and reports `0 modified, 0 deleted` among rows whose id does not begin with this run's own id prefix.
Falsified by: switching the writer from row-insertion to an in-place `values.update` over existing rows — the diff then reports modified rows and the check fails.

**AC-2 — Every 2022 Daily-tab expense row in the app traces to exactly one `include` row of the approved combined normalization sheet, and 2022's total is equal to the approved sheet's 2022 `include` sum — not within a tolerance.**
Verified by: offline — `--verify --target X --from-sheet Y` joins imported 2022 rows to the approved sheet on the `key` each row carries in `notes`, and asserts: zero imported 2022 rows with no matching `key`; zero `status=include` 2022 sheet rows with no row in the app; zero `key` values appearing twice; and the 2022 sum equal **exactly**, compared as integer minor units.
Falsified by: rounding amounts to whole units on write instead of carrying the parsed value — the exact sum comparison then fails on any row with a fractional amount.

**AC-3 — Every numeric cell in the 2022 Daily-tab band is accounted for — including the three source-shape defects found at spec — and an unaccounted cell still aborts the run rather than emitting a partial extraction.**
Verified by: offline — a unit test drives a fixture reproducing all three live shapes: (a) an extra `金額`-labelled column immediately following a day's own item-name/amount pair, before the next dated item-name column (the `NO` shape) — the classifier places it as a second same-day amount rather than leaving it unclassified; (b) an item-name column with a blank header whose immediately following amount column carries the date instead (the August shape) — the classifier still resolves the correct calendar date for the pair rather than emitting it undated, when the date is recoverable from the amount column's own header; (c) a day column whose header date does not match its structural position in the band (the `ZI`/`ZJ` shape) — the classifier does not silently accept it, and the variance report names it (AC-15). The whole-band accounting (the mechanism `061` built as its own AC-19) is exercised live against the real 2022 band and reports `UNACCOUNTED 0`.
Falsified by: leaving the classifier unchanged — the live run reproduces this spec's own probe result exactly: `ExtractError: Band 2022: whole-band accounting failed ... 4 unaccounted. Unclassified columns holding data: NO (4 cells, label "金額")`.

**AC-4 — No row dated outside 2022, 2023 or 2024 can reach the app, enforced at the same three independent points `061` built.**
Verified by: offline, in three parts. (a) A unit test asserts the extractor discovers bands from column A's structure with no row-range constant, labels each from its own header row, and now emits rows for 2022, 2023 and 2024. (b) The extractor asserts, per emitted row, that the row's own date falls in its band's declared year, and aborts naming the row otherwise. (c) `--verify` asserts every row whose id begins with this run's id prefix has a `date` starting `2022-`, `2023-`, or `2024-`, reporting any other count, which must be `0`.
Falsified by: replacing the year-based band selector with a positional one — the fixture then either emits a band before 2022 or misattributes a row, and (a), (b), or (c) fails.

**AC-5 — 2022's twelve mortgage payments are each imported as exactly one row, dated by House-tab column D, amounted from column J, all twelve under the `"Mortgage"` category, and none coincides with any of the schedule's six prepayment dates.**
Verified by: offline — the extractor emits exactly 12 rows for 2022 from the House tab; each row's `date` matches its own column D value and its `amount` matches column J's value in minor units exactly; `category_name_en` is `"Mortgage"` for all twelve, assigned directly rather than through `CATEGORY_MAP`; none of the twelve dates equals any of 2015-07-15, 2020-02-15, 2021-02-15, 2023-03-15, 2025-03-15, or 2025-11-15 (an assertion this run passes vacuously for 2022, kept so a future reuse against a year that does contain one of these dates cannot silently assume it does not).
Falsified by: reading the amount from a different House-tab column (e.g. an interest-only or principal-only split) instead of column J — the twelve amounts then fail to match column J's live values exactly.

**AC-6 — No cell from the House tab's column A (bank name, branch, account number, personal name) reaches the app, a notes field, a report, or this repository, at any point in the pipeline.**
Verified by: offline — the House-tab reader's range is bounded to `D5:J255`, verified by a test asserting the exact range requested of the Sheets API never includes column A, B, or C; the generated normalization sheet, the variance report, and this entity's stage report are searched for the known column-A cell's structural markers (a bank name plus branch plus account-number plus personal-name shape) and none match; the full PR diff is read before merge.
Falsified by: reading the House tab with an unbounded or wider range (e.g. `A5:J255`) instead of `D5:J255` — column A's content then enters the in-memory grid, and any downstream `text(cellAt(...))` call over that grid could surface it.

**AC-7 — Running the combined 2022 import a second time writes nothing, for both the Daily-tab and mortgage rows.**
Verified by: offline — a second `--apply` against the same target reports `created: 0`, every candidate from either source skipped as already present. Falsified by: generating row ids from `Date.now()` instead of deterministic ids for both sources — the second run then writes a full duplicate set.

**AC-8 — Undo restores the Expenses tab to its pre-import state for this run's own rows, and leaves every `061`-sourced 2023/2024 row untouched.**
Verified by: offline, on staging — `--snapshot`, `--apply`, `--undo`, then a diff of the tab against the snapshot showing no difference; separately, a snapshot of the existing 2023/2024 (`061`-sourced) rows is taken before this run's `--apply` and diffed against the same rows after this run's `--undo`, showing zero difference.
Falsified by: leaving `deleteRowsByIdPrefix`'s call sites passing the module-level `ID_PREFIX = "exp-hist-"` unscoped — undo then deletes every historical row in the tab, `061`'s 2023/2024 rows included, exactly the gap this spec found by reading `import-historical-expenses.js:749` and `:977` directly.

**AC-9 — Before any row is written to any target, the run resolves every `category_name_en` it is about to use — including `"Mortgage"` — against that target's own live Categories tab, and refuses with a listed diff if any fails.**
Verified by: offline — the importer resolves each distinct name in the approved sheet against the target's Categories tab before the first write; on any miss it exits non-zero, writes nothing, and prints the unresolved names alongside the target's available ones. Already confirmed live at spec time and recorded here rather than re-verified at build: `"Mortgage"` exists as a `name_en` on both staging (28 categories) and production (25 categories) today, so no new staging reconciliation (the shape `061`'s AC-20 built for `cat_023`–`025`) is needed for this entity.
Falsified by: resolving names lazily per row during the write loop instead of up front — the run then writes every row up to the first unresolved name and aborts halfway, leaving a partial import.

**AC-10 — Every imported row records where it came from, precisely enough to find the source cell again, whichever source it came from.**
Verified by: offline — `--verify` parses each imported row's `notes` and asserts it yields, for a Daily-tab row, the same four fields `061` established (bucket, sub-category, detail, `key`), and for a mortgage row, the source tab name, the House-tab source row, and the `key` (`{year}-mortgage-r{sourceRow}`).
Falsified by: using the same `key` template for both sources — a collision between a Daily-tab `key` and a mortgage `key` becomes possible, and AC-2's join can no longer tell which source a given key belongs to.

**AC-11 — No figure, vendor name, or account identifier from either source workbook (the archive `Daily` tab or the `House` tab) is committed to this repository.**
Verified by: offline — the generated import plan is written under the already-gitignored `functions/backfill-reports/`, confirmed with `git check-ignore`; the branch's full diff is read before the PR, covering both source workbooks' output.
Falsified by: writing the plan, or the House-tab variance detail, under a tracked path — `git check-ignore` then returns non-zero and the file appears in the diff.

**AC-12 — The import refuses to run without an explicit target, for both sources in the same run.**
Verified by: offline — invoking the script with no `--target` exits non-zero, writes nothing from either source, and the Expenses row count is unchanged.
Falsified by: falling back to a default resolved spreadsheet id for either source's write.

**AC-13 — The House tab is read with a credential pair whose read access is confirmed at runtime for both the staging and production service accounts, not assumed from this spec's access note.**
Verified by: offline — a preflight (or a test against the live House tab) authenticates as both service-account pairs and confirms both can read it before the run proceeds on that assumption.
Falsified by: hard-coding the House-tab read to always use the staging credential pair without a runtime check — if the captain's sharing settings on that sheet ever change, the run fails on a stale assumption instead of a clear, immediate error naming which credential lost access.

**AC-14 — The captain approved the combined normalization sheet — 2022 Daily-tab rows and 2022 mortgage rows together — before any row was written to the app, and the staging rehearsal covers exactly the content she approved, hand corrections included.**
Verified by: offline — the import refuses to run unless the sheet carries the captain's sign-off marker (`B1 == "APPROVED"`) and was named explicitly via `--from-sheet`; production-apply requires both the generation-time digest (`C1`) and a content digest over the rows as read (key, date, amount, category, status) to match the rehearsed sheet, per `061`'s own AMENDED-and-ratified AC-18 mechanism, reused unchanged for the combined sheet.
Falsified by: letting the import read the extractor's output directly instead of the approved sheet — a re-generate could then silently discard a hand correction to a mis-dated `ZI`/`ZJ`-class row.

**AC-15 — The variance report names and diagnoses 2022's own source-shape irregularities — the extra amount column, the header-shifted August columns, and the mis-dated day column — rather than only reporting their numeric symptom.**
Verified by: offline — the report explicitly lists these three findings by column reference and cause, alongside the standard per-month day-cell-vs-total variance `061` already produces; a test drives the extractor against a fixture carrying all three shapes and asserts each is named in the report output, not merely reflected in an aggregate percentage.
Falsified by: reporting only a variance percentage per month with no named cause — a future reader is back to guessing, the exact failure mode `061`'s Finding 8 already cost two stages of confident-but-wrong explanations to escape.

**AC-16 — A re-generate cannot lose a captain hand correction, for either source, on the combined sheet.**
Verified by: offline — the same three assertions `061` built for AC-16, run against a sheet holding both Daily-tab and mortgage rows: `--generate` into an existing tab name exits non-zero and mutates nothing; editing a value in v1 and running `--generate --into v2 --carry-from v1` produces a v2 carrying the edit and leaves v1 byte-identical; a key whose source cell was blanked appears in v2 as `status=orphaned` rather than being absent — exercised for a mortgage-sourced key as well as a Daily-tab one.
Falsified by: matching carried-forward edits by row index instead of by `key` — inserting or dropping a row from either source shifts every edit after it onto the wrong row.

**AC-17 — Reports → Annual, stepped back to 2022, shows a non-zero total that includes both the Daily-tab expenses and the twelve mortgage payments, matching AC-2's and AC-5's reconciled figures within 1%.**
Verified by: interactive — a live drive of the deployed app (staging before merge, production after deploy): open Reports, switch to Annual, step the year back to 2022, read the total.
Falsified by: writing mortgage rows with a date outside 2022, or omitting them from the write entirely — the annual total then does not include twelve months of mortgage payments and undercounts against AC-5's figure.

**AC-18 — Everyday use is unaffected after the import: adding an expense in the app still writes it and shows it in today's list, and History still loads.**
Verified by: interactive — a live drive on staging: add an expense, see it appear, delete it; open History and confirm it renders.
Falsified by: writing rows wider than the Expenses header row (a hazard now doubled by having two source shapes to keep in sync with the sheet schema) — `buildColumnMap` throws and `GET /api` returns 500 for every request.

## Risk evidence

**The riskiest unverified mechanism was "2022 has the same source shape as 2023/2024, so `061`'s extractor can simply be pointed at a third year."** It was exercised directly against the live archive workbook, not assumed from `061`'s notes: `extract(grid, { years: [2022, 2023, 2024] })` was run, and it **fails today** —

    ExtractError: Band 2022: whole-band accounting failed. 837 day-amount + 4 day-item-name +
    312 month-total = 1153, but the band holds 1157 numeric cells from column F onward — 4
    unaccounted. Unclassified columns holding data: NO (4 cells, label "金額").

Reading past that abort — raw label/header rows, column-by-column, plus the row-32-equivalent (row 62) formula chains via `valueRenderOption=FORMULA` — found two more defects with no counterpart in 2023 or 2024: a date-header shift across most of August (item-name column undated, amount column carrying the date instead, producing ≥29 undated rows against `061`'s own D4 finding of zero) and a mis-dated day column at `ZI`/`ZJ` positioned exactly where November 30th belongs but headered as October 31st. All three are cited by exact column letter, row number, and live cell value or header serial in the Plan section above — none is inferred or extrapolated from a partial read.

A second mechanism was exercised rather than assumed: whether `061`'s undo (`deleteRowsByIdPrefix`, called with the unscoped `ID_PREFIX = "exp-hist-"`) is safe to reuse unchanged for a second historical-migration entity. Reading the call sites directly (`import-historical-expenses.js:749`, `:977`) shows it is not — it would delete `061`'s live 2023/2024 rows along with 2022's. AC-8 exists specifically to close this before it is discovered by running an actual undo against production.

A third fact was checked live rather than carried from the ideation body's note: `061`'s D6 staging/production Categories divergence (`cat_023`–`025`) does not recur for `"Mortgage"` — it already exists as a resolvable `name_en` on both staging (28 categories) and production (25 categories) today, confirmed by reading both tabs directly through the same `readCategories` helper `import-historical-expenses.js` already uses. No new AC-20-shaped reconciliation script is needed for this entity.


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

## Stage Report: ideation (addendum)

- DONE: Record the captain's stated reason for the combined-import ruling, not just the ruling.
  Opening paragraph now states she was asked base-then-mortgage vs. one combined import, and chose combined because a partial year would misrepresent 2022 in every Reports screen — her reasoning, named explicitly as not scope creep.
- DONE: Point spec at `061`'s tooling shape for a second source, without deciding it here.
  Extended the existing "tooling may already be a flag away" Plan bullet: `061`'s extractor/importer already structurally separates reading from writing behind human approval; spec should propose one normalization sheet fed by two sources (`Daily` and `House`) rather than a parallel pipeline, but the shape itself stays spec's call.
- DONE: Cite `060`'s full `House` tab reconnaissance so spec does not re-read the sheet.
  New Plan bullet: 255 rows × 28 cols, data from row 5, column J `實際月付` (209 literals, 31 formulas), column D `還款日期` adjacent and fully populated, schedule 2014-11-17 to 2034-10-15, 240 monthly rows, zero non-monthly gaps, 2022 holding exactly 12.
- DONE: State the column-J-vs-interest-only decision as settled, with the captain's reasoning.
  New Plan bullet: full payment (J) is principal plus interest; the captain overruled an initial interest-only recommendation and chose J so 2022–2024 stays measured consistently with 2025's existing flat full-payment estimate. Recorded as her decision, not an open question.

### Summary

This addendum folds in context the team lead supplied after the first stage report was already committed: the captain's own reasoning for the combined-import ruling (so a future reader sees it as her call, not scope creep), a pointer to `061`'s reusable tooling shape for a two-source import, `060`'s complete `House` tab characterization (so spec cites rather than re-reads it), and the settled column-J-over-interest-only decision with the reasoning behind the reversal. Nothing here changes prior scope — it deepens the record so spec inherits settled facts instead of re-deriving or re-litigating them.

## Stage Report: spec

- DONE: Verify whether 2022 repeats `061`'s monthly-formula boundary errors by reading 2022's formulas the same way `061` eventually did.
  Fetched `valueRenderOption=FORMULA` for all twelve per-row month-total chains (rows 63-88) in the live 2022 band and compared each chain's referenced range against the actual day-amount column span for that month. Result: 2022 does NOT repeat 2023/2024's five-of-twelve pattern — it has boundary mismatches in six different months (March, April, July, August, October, November), and August's is a distinct defect, not a chain-range bug. Reported plainly in Plan under "Verified at spec," ahead of any 2022 total.
- DONE: Establish 2022's actual date span by measurement.
  Parsed every dated header cell in the live 2022 band: span is 2022-01-01 to 2022-12-31, 364 of 365 calendar dates present. A complete calendar year, unlike 2024 (which `061` found stops at 2024-11-08). The one missing date (2022-11-30) is explained by the `ZI`/`ZJ` mis-dated-column finding below, not a real gap.
  Falsifiable evidence: `functions/scripts/extract-historical-expenses.js`'s own `parseHeaderDate` run live against the band's header row; no assumption carried from 2023/2024's shape.
- DONE: Extend `061`'s extractor/importer to a two-source-per-year design (`Daily` tab + `House` tab feeding one normalization sheet) rather than a parallel pipeline, with Verified by/Falsified by ACs including the House-tab-column-A PII falsifier.
  Plan section "Two-source design" proposes the shape (one sheet, `source` field, reused never-overwrite/`--carry-from` mechanism, mortgage `key` template distinct from Daily-tab `key`). AC-6 is the falsifiable PII criterion: House-tab reads bounded to `D5:J255`, a test asserts the exact API range never includes columns A-C, and generated artifacts are searched for column A's structural markers. AC-5, AC-9, AC-10, AC-13 cover the mortgage source's other properties (amount/date fidelity, category resolution, provenance, credential-access verification).
- DONE: Check whether `061`'s deferred-risk Findings 5 and 7 promote under 2022's actual data, and report which if any do.
  Finding 5 (unmapped taxonomy -> `Other`): checked live — 2022's 17 `(項目大類, 項目分類)` pairs are identical to 2023/2024's, all 17 resolve, 0 unmapped. Does not promote. Finding 7 (AC-19 blind to label-row numeric cells): `061`'s own investigation already covered 2022 explicitly and found it clean; re-confirmed, not re-run. Does not promote. Both recorded under "Do `061`'s deferred-risk Findings 5 and 7 promote" in Plan.

### Summary

Verified every checklist item against the live archive workbook rather than the ideation body's notes, using `061`'s own extractor functions plus direct Sheets API reads (`valueRenderOption=FORMULA`, merge metadata, raw grid cells) — nothing here is inferred from `061`'s report. The headline finding beyond the checklist: `extract(grid, { years: [2022, 2023, 2024] })` throws today on a real, previously-unknown 2022 source-shape defect (an extra unlabeled amount column at `NO`), and reading past that abort found two more defects (an August date-header shift producing undated rows, and a mis-dated day column at `ZI`/`ZJ`) — none present in 2023/2024, refuting `061`'s "may already be a flag away" note with direct evidence rather than assumption. Also found and specced around: the shared `deleteRowsByIdPrefix` undo mechanism is unscoped and would delete `061`'s live 2023/2024 rows if reused unchanged (AC-8), while `"Mortgage"` already resolves cleanly on both staging and production Categories tabs today, so no new `061`-AC-20-style reconciliation is needed (AC-9). Eighteen acceptance criteria are written (16 offline, 2 interactive per the declared split), eleven carried/extended from `061`'s proven mechanisms and seven new to this entity's two-source, three-defect reality.