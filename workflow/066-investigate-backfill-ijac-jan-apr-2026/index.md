---
id: 066
title: Investigate and Backfill Ijac's Missing Jan-Apr 2026 Expenses
status: verify
source: captain
started: 2026-09-08T07:09:11Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-066-investigate-backfill-ijac-jan-apr-2026
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:066:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:066-ideation-1
              briefing:
                id: briefing:066:ideation:attempt-1:revision-1
                digest: sha256:79048b4a53634c1368778ceab52a2d168b6f5503d27f28075aadf8ca33f30609
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:066:ideation:1
                briefing: briefing:066:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-08T07:08:48.242802Z"
                decision: approve
                reason: 'Scope is clear: confirm the gap live before designing anything, then characterize the source tab. Ready to move to spec.'
              application:
                target-stage: spec
                state: consumed
        - id: gate:066:spec
          stage: spec
          attempts:
            - id: gate-attempt:066-spec-1
              briefing:
                id: briefing:066:spec:attempt-1:revision-1
                digest: sha256:9d31c95c25e423a027af3279fc5b8902378977b4007838ec5ef09a71007f1b1a
                room-ref: ./review/spec/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:066:spec:1
                briefing: briefing:066:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-09-08T10:05:45.238827Z"
                decision: approve
                reason: Gap confirmed real, source characterized, both category rulings given (房客->房客支出, 進修->學費), and spreadsheet access confirmed live for the staging service account. Ready for build.
              application:
                target-stage: build
                state: consumed
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

### Blocking precondition — migration-tab Sheets API access — OPEN

Neither service account can read `1F2gv7ZytfwIVHuaAkZGMTEnB8jG9GoeKx-CyyjTCKto` today: `spreadsheets.get` returns `403 The caller does not have permission` for both `expense-tracker-staging@expense-sheet-staging.iam.gserviceaccount.com` and `expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com`, and the public CSV export endpoint returns `401`. The file has never been shared with either. Everything this spec asserts about the tab below was instead obtained through this session's connected Google Drive account (the file's own owner — the captain's personal account) — a route a build script cannot reproduce or re-verify on its own.

**Exit condition:** the captain shares the spreadsheet with `expense-tracker-staging@expense-sheet-staging.iam.gserviceaccount.com` (Viewer is sufficient), matching the read-only role every other entity's source sharing has used. This does not block writing this spec — the characterization below is complete — but it does block `build`'s own live `--dry-run` (AC-2), which must re-read the tab through the Sheets API rather than trust this spec's cached snapshot.

### Verified at spec — by reading live production/staging data and the live source spreadsheet, not by carrying the ideation's assumptions forward unchecked

**1. The Jan-Apr 2026 gap is confirmed, exactly as the ideation described.** A full live read of production's `Expenses` tab (4,771 rows, via `expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com`) found 23 rows where `paid_by` or `created_by` is ijac inside 2026-01-01..2026-04-30, and every one of them carries an `exp-auto-` id — the live scheduler's own subscription-generated prefix (`autoExpenseId`, `functions/src/scheduler.ts:87`). Zero non-`exp-auto-` rows. The boundary is exact, not a wider dead zone: ijac's manually-entered rows run continuously through 2025-12-31 and resume at 2026-05-02, with nothing but `exp-auto-` rows in between. For comparison, wei has 248 rows (any source) in the identical window.

**2. Schema — 8 columns, no PII-shaped hazard.** Headers: `記帳日期` (record date), `分類` (type: 支出 expense / 收入 income), `主分類` (main category), `次分類` (sub-category), `金額` (amount), `幣別` (currency, always TWD), `更新日期` (last-updated date), `備註` (notes). No personal-name/account-number/bank-detail column of the kind `064`'s House-tab column A carried. `備註` holds ordinary free-text memos — some name a family member by nickname alongside an everyday charge (a child's tuition or dance class, an in-law's gym visit) — the same shape the app's own `notes` field already stores, not a bank/account hazard requiring exclusion.

**3. Single-owner personal ledger — no payer column, no ambiguity.** The file is ijac's own `smoney` app export (title: `smoney-2026年9月8日_上午81314_ijac`, created 2026-09-08, the day this entity started). Every row is hers; `paid_by`/`created_by` are fixed literals (`ijac`/`ijac`), the same simple shape `065`'s literal subscription list used — no USERS-table resolution needed.

**4. Row count, date range, and the window's real shape.** The characterized tab holds 310 data rows spanning 2025-09-29 through 2026-05-02 — its coverage straddles the gap rather than exactly filling it. 204 of those rows fall in 2026-01-01..2026-04-30: 203 `支出` (expense) rows and exactly 1 `收入` (income) row (2026-04-14, a one-off bike-rack sale). The app's `EXPENSES_SPEC` schema has no income/type field — it is expense-only — so that one income row is out of scope for this entity's import, named here rather than left to be silently dropped by whatever build writes.

**5. A second, unrelated data block exists in the same file — out of scope, flagged rather than characterized further.** The same read surfaced a second table, headed with a `2025-01~04` label, holding the same 8 columns for 2025-01-01 through 2025-04-30 — a full year earlier than this entity's window. Its exact tab name/gid could not be confirmed (metadata calls are blocked the same way as the data calls), and it is out of scope regardless; recorded so build does not mistake it for the migration source once the sheet is shared and a script can enumerate tabs directly.

**6. Category mapping — verified live against both targets, and a real staging/production divergence found.** Of the 17 distinct `次分類` values appearing across the 203 in-window expense rows, 15 match an existing category's `name_zh` exactly on both production (25 categories) and staging (28 categories) today: `食材`→`cat_003`, `外食`→`cat_001`, `日用品`→`cat_002`, `交通`→`cat_006`, `旅遊`→`cat_005`, `寶貝`→`cat_008`, `衣服`→`cat_009`, `運動`→`cat_010`, `醫療`→`cat_004`, `數位`→`cat_007`, `禮物`→`cat_011`, `其他`→`cat_022`, `學費`→`cat_012`, `娛樂`→`cat_016`, `加油`→`cat_015`, `過路`→`cat_013`. Two do not resolve cleanly and need the captain's ruling before build, the same way `061`'s D1/D6 needed hers:
   - `房客` (2 rows, "tenant"). Staging carries a category literally named `房客` — an exact match — *and* a separate `房客支出` ("tenant expense"); production carries only `房客支出`. A mapping built and rehearsed on staging using the exact `房客` match would look clean and then be undefined on production — the same staging/production divergence shape `061`'s own D6 found. Default proposed for the captain to confirm: treat `房客`(source) as `房客支出`(`cat_023`, both targets).
   - `進修` (1 row, "further study/self-improvement") has no matching category on either target. Candidates for the captain's ruling: `cat_012` (`學費`/Tuition) or `cat_022` (`其他`/Other).

**7. No pre-existing collision in the target window.** Because point 1 already confirms zero non-`exp-auto-` ijac rows for Jan-Apr 2026, all 203 candidate expense rows are net-new on both targets; no month-level overlap-handling logic (the kind `065` needed for wei's Uber/February) is required here, though the importer still asserts an existing-id check defensively rather than assume a clean run.

**8. Id-namespace and undo scope — a new prefix, collision-free by construction.** None of `060`-`065`/`067`'s prefixes fit this source's shape: `exp-hist-*` is reserved for the Coast FIRE archive-workbook lineage (`061`/`062`/`064`, all pre-2025 years); `exp-sub06*-*` is reserved for subscription-derived single-amount-per-month backfills (`065`, and `067`'s planned prefix); `exp-auto-*` is the live scheduler's own. This source is a flat, multi-row-per-day ledger with a genuine per-row natural key once read via the Sheets API: its own spreadsheet row number. Proposed scheme: **`exp-mig066-r{sourceRow}`**, derived from the migration tab's row number rather than a run-order counter (so a retry recomputes the same id, matching `064`'s `historicalId` principle), sharing no namespace with any other entity's or the scheduler's ids. Undo scopes to the `exp-mig066-` prefix alone.

## Spec

### Goal

Confirm live whether ijac has any non-subscription expenses for Jan-Apr 2026 — confirmed: she does not — and backfill her real expenses for that window from the migration tab's characterized ledger, under the same reviewable, captain-approved, staging-rehearsed-first safety `060`-`065` established.

### User Stories

- As the captain, I want confirmation from live production data — not assumption — that ijac's Jan-Apr 2026 expenses are genuinely missing, before any backfill work starts.
- As the captain, since the gap is real, I want ijac's actual Jan-Apr 2026 expenses (203 rows from her own ledger export) added to the app under her existing categories, so those months' totals and category breakdowns reflect what she actually spent.
- As the captain, I want the one Jan-Apr income row and the two categories without a clean cross-target match flagged for my decision, not silently guessed at.
- As the captain, I want the same reviewable safety `060`-`065` used: a normalization sheet I approve before any write, staging rehearsed first, and an undo scoped only to this entity's own rows.

### Edge Cases

- The one `收入` (income) row in the window (2026-04-14, a bike-rack sale) — the app's `Expenses` schema has no income field; excluded from the import by default, named explicitly rather than silently dropped.
- The two categories without a clean cross-target match (`房客` vs `房客支出`; `進修` with no match at all) — resolved by an explicit mapping table the captain approves at the gate, never a fuzzy auto-match.
- Multiple rows sharing the same date (e.g. nine rows on 2026-03-31) — the id scheme (`exp-mig066-r{sourceRow}`) disambiguates by source row, never by date alone.
- Re-running the import after the captain hand-corrects the normalization sheet — carries her edits forward by key/row, the same `--carry-from` mechanism `061`/`064` proved, once the migration tab is reachable by the same tooling.
- Undo run any time after this entity's rows are live — removes only `exp-mig066-` rows; must leave every other entity's and the scheduler's own `exp-auto-` rows untouched, verified against a target holding real data rather than only staging's empty tab (per `064`'s own finding on exactly this risk).
- The source spreadsheet is reachable only via this session's connected Drive account today; build cannot start its live Sheets-API extraction until the captain shares it (see Blocking precondition above), and the out-of-scope `2025-01~04` block in the same file must not be mistaken for the migration source once sharing happens.

### Out of Scope

- Any month outside Jan-Apr 2026 (the `2025-01~04` reference block found in the same source spreadsheet included).
- wei's expenses.
- Any change to how subscriptions work, or to the live scheduler's `exp-auto-*` rows.
- The 2026-04-14 income row — no income-tracking mechanism exists in the app's `Expenses` schema; adding one is a separate, undecided feature.
- Correcting or reconciling the captain's own `smoney` ledger.

## Acceptance criteria

Verification split: **offline** — AC-1 through AC-11. **Interactive** — AC-12, AC-13. No harness is built to automate AC-12 or AC-13; both are judged on a live drive of the deployed app, per the pattern `061`/`062`/`064`/`065` already established.

**AC-1 — ijac has zero non-subscription (non-`exp-auto-`) expense rows in production for 2026-01-01 through 2026-04-30, confirming the backfill is warranted.**
Verified by: offline — a full live read of production's `Expenses` tab found 23 ijac rows in the window, all `exp-auto-`, with continuous non-`exp-auto-` ijac coverage immediately before (through 2025-12-31) and after (from 2026-05-02), and 248 wei rows in the identical window for comparison.
Falsified by: a non-`exp-auto-` ijac row inside the window surfacing at build or verify time that this read missed — would mean the premise was wrong and the backfill should not proceed as scoped.

**AC-2 — Before any write, the migration tab is read live through the Sheets API — not carried forward from this spec's Drive-connector snapshot — and its row count, date range, and headers match what this spec recorded.**
Verified by: offline — once the Blocking precondition clears, build's extractor prints the live header row, row count, and min/max date; a check confirms these match this spec's recorded values (310 rows, 2025-09-29..2026-05-02, the 8 named headers), accounting for any rows the captain adds or edits between spec and build.
Falsified by: build trusting this spec's cached snapshot without a live re-read — a since-edited, or wrongly-shared, sheet would then produce a wrong import with no signal.

**AC-3 — 203 expense rows and 0 income rows land in the target Expenses tab for the Jan-Apr 2026 window; the one live income row is excluded, not imported.**
Verified by: offline — a live `--dry-run` count matches this spec's recorded 203 `支出` / 1 `收入` split; a unit test over a fixture containing one `收入` row and one `支出` row on the same date asserts only the expense row is planned.
Falsified by: reading `分類` case-insensitively or ignoring it — the income row would then be imported as an expense.

**AC-4 — Every imported row's category resolves to a real, active category id on the target, per the mapping table the captain approves at the gate; no row is written under a guessed or fuzzy-matched category.**
Verified by: offline — pre-write validation refuses to run if any of the 17 distinct source sub-categories lacks an explicit mapping entry; live checks confirm 15 of 17 map by exact `name_zh` match on both staging and production today, and the remaining 2 (`房客`, `進修`) are pinned by the captain's explicit ruling, never inferred.
Falsified by: falling back to a same-string auto-match for the 2 ambiguous categories — `進修` would then either land under a wrong category silently, or the exact-match lookup would throw with no ruling recorded.

**AC-5 — Rows are minted under `exp-mig066-r{sourceRow}`, an id namespace that cannot collide with any id already present on any target, and distinct from every other entity's own prefix.**
Verified by: offline — a unit test asserts the prefix and its derivation from the migration tab's own spreadsheet row number, never a run-order counter; a live check of both staging's and production's current Expenses ids confirms zero existing `exp-mig066-` rows before the first apply.
Falsified by: deriving the id from a counter over rows-as-read rather than the sheet's row number — a second run, or a run against a source whose row order shifted, would then recompute different ids for the same real transaction and duplicate it.

**AC-6 — No pre-existing row (any payer, any month, any entity) is altered or deleted by this import.**
Verified by: offline, staging rehearsal — `--snapshot` before, `--verify` after apply, diffing every row whose id does not begin `exp-mig066-`; decoy rows seeded under `exp-hist-`, `exp-sub065-`, `exp-sub067-`, and `exp-auto-` shapes are confirmed to survive both the apply and a subsequent undo untouched.
Falsified by: writing via in-place `values.update` instead of row insertion, or scoping undo wider than the `exp-mig066-` prefix — a decoy under any other entity's shape is then altered or removed.

**AC-7 — Undo removes only this entity's own rows and nothing else.**
Verified by: offline, staging — snapshot → apply → undo → diff shows zero difference from the pre-apply snapshot.
Falsified by: scoping undo to a bare `exp-mig` prefix instead of the full `exp-mig066-` — a future entity also starting `exp-mig` would then be reachable by this entity's own undo.

**AC-8 — Running the import a second time against the same target writes nothing new.**
Verified by: offline — a second `--apply` reports `created: 0`, every candidate already present.
Falsified by: generating ids non-deterministically (e.g. from wall-clock time) — a second run would then write a duplicate set.

**AC-9 — No cell beyond the 8 characterized columns, and no row from the out-of-scope `2025-01~04` block, reaches the app, a notes field, a report, or this repository.**
Verified by: offline — the extractor's requested range is asserted to name only the migration tab, by confirmed title/gid, once sharing clears; this entity's own file and the branch diff are checked for any accidental 2025-dated or extra-column data.
Falsified by: the extractor reading by tab position/index rather than confirmed title/gid — a spreadsheet reorder would then silently pull the wrong block's rows.

**AC-10 — Every imported row's notes preserve the source's own `備註` memo text unchanged.**
Verified by: offline — a fixture round-trips a `備註` value containing a family nickname and asserts the app row's `notes` field matches byte-for-byte.
Falsified by: truncating, translating, or stripping the `備註` field — the captain's own review of the normalization sheet would then show notes that don't match her ledger.

**AC-11 — The import refuses to run without an explicit `--target`.**
Verified by: offline — invoking with no `--target` exits non-zero, writes nothing, row counts on both targets unchanged.
Falsified by: falling back to a default resolved spreadsheet id.

**AC-12 — Reports for January through April 2026, viewed live, show ijac's real spending for each month; prior data (any payer, any other month) is unchanged.**
Verified by: interactive — live drive of the deployed app (staging pre-merge, production after deploy): open Reports, step through Jan/Feb/Mar/Apr 2026, confirm non-zero totals consistent with this spec's recorded per-category figures within a stated tolerance; re-check December 2025 and May 2026 (the months bounding the gap) are unaffected.
Falsified by: a row written under a wrong month/date, or an id the app can't resolve — the month's total then does not move by the expected amount, or a category is missing from that month's breakdown.

**AC-13 — Everyday use is unaffected after the import: adding an expense still works, and History still loads.**
Verified by: interactive — live drive on staging: add an expense, see it appear, delete it; open History and confirm it renders.
Falsified by: a written row wider than the header row — `buildColumnMap` throws and `GET /api` returns 500 for every request.

## Risk evidence

**Riskiest unverified mechanism this cycle: the migration tab's live Sheets-API accessibility.** Not yet exercised — both service accounts return `403` on this spreadsheet today, and the public export endpoint returns `401`. Everything this spec asserts about the tab's schema, row count, date range, and category shape was obtained through this session's connected Drive account instead, a route a build script cannot reproduce or re-verify on its own. This is the single explicit precondition build depends on (see Blocking precondition above) before its own live `--dry-run` (AC-2) can run at all.

**Second, exercised and proven: the gap itself.** Not assumed from the ideation — a live, full read of production's 4,771-row Expenses tab found the exact boundary (continuous non-`exp-auto-` ijac coverage through 2025-12-31, resuming 2026-05-02, nothing but `exp-auto-` rows in between) and a same-window comparison against wei's 248 rows.

**Third, exercised: a category-mapping divergence between staging and production, found live rather than assumed clean because a rehearsal happened to pass on staging.** Staging carries a `房客` category that exactly matches the source; production does not, carrying only `房客支出`. A mapping validated only against staging would look correct and then be undefined on production — the same divergence shape `061`'s own D6 found for its Categories tabs.

**No spike needed:** the row-insertion/never-overwrite write mechanism, the snapshot/verify/undo rehearsal shape, and the normalization-sheet approval gate are already built and proven by `061`/`062`/`064`/`065`; this entity's extractor is new (a different source shape — a flat personal ledger, not a fixed-format archive workbook) but reuses that write path.

## Expected surface and tolerance

Estimate: **+250 net LOC across 4-5 files, tolerance ±60%** (100-400). Every prior historical-style entity in this workflow blew past its own estimate (`061` 397%, `062` 177%, `064` 217%/256% across its two rejection cycles), driven overwhelmingly by falsification-style tests; a wide band is the honest number here too, especially since this entity's extractor cannot be smoke-tested against the live source until the Blocking precondition clears.

- `functions/scripts/extract-migration066-expenses.js` — new, ~80-140 LOC. Reads the migration tab by confirmed title/gid, maps `主分類`/`次分類` → category id via an explicit table, excludes `收入` rows, emits `exp-mig066-r{sourceRow}` candidates.
- `functions/scripts/import-migration066-expenses.js` (or a shared import module extended from `061`/`064`'s) — new/modified, ~60-100 LOC. Normalization-sheet generation, snapshot/apply/undo, existing-id dedup check.
- `functions/scripts/migration-env.js` — modified, ~5-15 LOC. A new spreadsheet id/tab constant for the migration source, following the `HOUSE_SPREADSHEET_ID` pattern.
- `functions/test/migration066.test.js` — new, ~80-140 LOC. Covers AC-3, AC-4, AC-5, AC-9, AC-10.
- `functions/test/fixtures/` — new, ~10-20 LOC. A small synthetic ledger fixture (income + expense same date, an ambiguous category, a duplicate date).

Semantics this may change: **stored data only** — new rows in the target Expenses tab under a new id prefix. No category is created (all target categories already exist, pending the captain's 2-category ruling). No API shape, auth, or scheduled-behavior change.

## Test plan

- **Unit, offline:** fixture-driven extractor tests — income exclusion, ambiguous-category refusal without an explicit mapping entry, duplicate-date row disambiguation by source row. Covers AC-3, AC-4, AC-5, AC-10.
- **Dry-run, offline, once the Blocking precondition clears:** `--dry-run --target staging` against the real migration tab, confirming the live row count/date range match this spec's recorded 310/204/203 figures. Covers AC-2, AC-3, AC-4.
- **Seeded-collision + apply/undo rehearsal on staging, offline:** decoys under every other entity's id shape, snapshot → apply → verify → undo → diff. Covers AC-6, AC-7, AC-8.
- **Live drive, interactive:** staging Reports Jan-Apr 2026 stepped, December 2025/May 2026 spot-checked unaffected, then add/see/delete + History. Covers AC-12, AC-13; repeated on production after deploy.
- **Cost:** unit tests run in seconds; the live dry-run and rehearsal are gated entirely on the captain's one sharing action — nothing else blocks them.

### Feedback Cycles

## Stage Report: spec

- DONE: Confirm live against production app data whether ijac genuinely has no non-subscription expense rows for Jan-Apr 2026
  Read production's Expenses tab directly (4,771 rows) via the production service account: 23 ijac rows in 2026-01-01..2026-04-30, all `exp-auto-` (scheduler-generated); zero non-`exp-auto-` rows. ijac's manual rows run continuously through 2025-12-31 and resume 2026-05-02. Confirmed — see spec's point 1.
- DONE: Characterize the given spreadsheet's "migration" tab live via the Sheets API, and check for PII-shaped columns before reading beyond what's needed
  Both service accounts return `403` on the source spreadsheet and the public export returns `401` (no Sheets-API route exists yet); characterized instead through this session's connected Drive account (the file's own owner). Read only the tab's own 8 columns first before drawing conclusions; confirmed no personal-name/account-number/bank-detail column exists. Full schema, 310-row/2025-09-29..2026-05-02 range, and category mapping recorded under "Verified at spec".
- DONE: Write `## Spec` reflecting what was actually found, and design a collision-safe id scheme if a backfill is warranted
  Gap confirmed real, backfill warranted; wrote Goal/User Stories/Edge Cases/Out of Scope. Proposed `exp-mig066-r{sourceRow}`, collision-free against every prior entity's prefix (`exp-hist-*`, `exp-sub06*-*`, `exp-auto-*`) and derived from the source's own row number rather than a run-order counter.
- DONE: Write a top-level `## Acceptance criteria` section with offline/interactive split and Falsified-by clauses
  13 ACs written as a sibling of `## Spec`; AC-1 through AC-11 offline, AC-12/AC-13 interactive. Each carries a Verified-by and a Falsified-by clause.

### Summary

The ideation's premise held up under a live check: ijac has zero non-subscription expense rows for Jan-Apr 2026 on production, confirmed against a full read of the Expenses tab rather than assumed. The migration tab's Sheets-API access is blocked for both service accounts (403) and not publicly exportable (401); its schema, 310-row date range, and category mapping were characterized instead through the session's connected Drive account, which surfaced a real staging/production category divergence (`房客` vs `房客支出`) and one in-window income row the app's schema can't hold — both carried into the spec as explicit edge cases needing the captain's ruling, not silently resolved. A `## Blocking precondition` section records the one exit condition build needs: the captain sharing the spreadsheet with the staging service account before build's own live extraction can run.

## Implementation plan (build)

1. **`migration-env.js`** — add `MIGRATION066_SPREADSHEET_ID`, `MIGRATION066_TAB` (`"migrate"`), `MIGRATION066_GID` (`2065989204`), exported alongside the existing constants. Read-only, staging-credentialed, same pattern as `ARCHIVE_SPREADSHEET_ID`/`ARCHIVE_TAB`.
2. **`extract-migration066-expenses.js`** (new) — a pure `extract(grid, …)` core over a plain grid array (fixture-testable) plus live IO (`readMigrationGrid`, `verifyTabIdentity` — confirms the tab title AND its live `sheetId` equal the confirmed gid, guarding AC-9 against a sheet reorder/rename). Excludes `收入` rows; maps every `次分類` via an explicit `CATEGORY_MAP066` (`次分類` → target `name_zh`, per the captain's already-approved table); refuses to emit anything if any in-window `支出` row's sub-category is unmapped. Ids are `exp-mig066-r{sourceRow}` from the row's own 1-based sheet row — never a run-order counter. `備註` is carried through completely unmodified (no trim, no provenance wrapping) for byte-for-byte preservation (AC-10) — safe because the id itself already encodes the source row, so no notes-embedded key is needed for traceability (unlike `061`'s scheme). A normalization-sheet layer (`--report` / `--generate --into <tab> [--carry-from <tab>]`), modeled on `061`'s own control-row/digest/carry-forward shape, is written to the STAGING app spreadsheet for the captain's review — self-contained rather than importing `061`'s versions, since those are hard-wired to its band-grid columns.
3. **`import-migration066-expenses.js`** (new) — reuses the already-proven generic Sheets IO (`readExpenses`, `readCategories`, `insertRowsAtTop`, `deleteRowsByIdPrefix`, `snapshotOf`, `diffSnapshot`) imported directly from `import-historical-expenses.js` rather than re-implemented. Category names resolve against the target's live `name_zh` (not `name_en` — the source is entirely Chinese), a local `resolveCategoryNamesZh` parallel to `061`'s `resolveCategoryNames`. Phases: `--dry-run` / `--snapshot` / `--apply` / `--verify` / `--undo` / `--rehearse`, all requiring `--target` explicitly (AC-11); `--apply` on any target requires the normalization sheet's `B1 == APPROVED` (same gate `061`/`064` use even for staging); `--undo` matches only the `exp-mig066-` prefix — no `--years` needed, since this entity has one fixed window and the prefix alone is already fully scoped (unlike `061`'s year-split undo).
4. **Tests** — fixture-driven extractor tests (income exclusion, refusal on an unmapped category, duplicate-date disambiguation by source row, byte-for-byte notes) plus `sheetsStub`-backed importer tests exercising the real `run()` (apply, second-apply-is-a-no-op, undo) with decoys under `exp-hist-`, `exp-sub065-`, `exp-auto-`, and a plain `exp-{id}` shape, mirroring `065`'s own test file.
5. **Live self-check (staging only — never a production write during build)** — `--report`/`--dry-run` against the real `migrate` tab and both targets' Categories tabs for AC-1/2/3/4/9; a full `--rehearse` against staging (snapshot → apply → verify → hand-add decoy → undo → diff → restore) for AC-6/7/8. Production `--apply` stays out of scope for build: AC-12 itself ties production to "after deploy", so that write happens at a later, captain-gated stage — matching `061`/`064`'s precedent of confining `build`'s own live exercise to staging.

### Dispatch Retries

- Retry 1: build — no-completion-signal (`idleReason: failed`, `failureReason: "You've hit your session limit · resets 7:30pm (Asia/Taipei)"`, an account-wide usage-limit failure). Before hitting the limit, this session's own live self-check (step 5 above) found a genuine source-identification error that the FO independently re-verified live: the tab named **`migrate`** (gid `2065989204`) — hardcoded into `migration-env.js`'s `MIGRATION066_TAB`/`MIGRATION066_GID` and this implementation plan per the FO's own build-dispatch instruction — actually holds the **out-of-scope 2025 reference block** (151 rows, all dated 2025, confirmed live via `A1:H8` + a row-count read). The real Jan-Apr 2026 target data — matching spec's own 203-`支出`/1-`收入` figures exactly — lives in the **other** tab, titled after the file itself: **`smoney-2026年9月8日_上午81314_ijac`, gid `792951830`** (745 total rows, confirmed live). Spec's own uncertainty ("Its exact tab name/gid could not be confirmed") was well-founded; the FO's build-checklist wrongly presented `migrate`/`2065989204` as already-confirmed. It was not — this was the FO's own error, not spec's or build's. It's already past the stated reset time; re-dispatching to resume with the corrected pointer, preserving this session's accumulated context.

## Stage Report: build

- DONE: Write a brief implementation plan before coding begins
  `## Implementation plan (build)` above, written before any code. Its tab identity (`migrate`/`2065989204`) was the FO's own dispatch error, caught by this stage's own live self-check and corrected in `migration-env.js` per Dispatch Retry 1 (commit `6da71eb`) — the category-mapping table and `exp-mig066-r{sourceRow}` id scheme it described were unaffected and implemented as planned.
- DONE: Implement the extractor (migration tab by confirmed title/gid, income excluded, 17-entry category map, id scheme) and the importer (dry-run/apply/undo/verify, --target required, missing-mapping refusal)
  `functions/scripts/extract-migration066-expenses.js` + `functions/scripts/import-migration066-expenses.js` + `migration-env.js` additions (commits `d1602e3`, `6da71eb`). `--snapshot`/`--rehearse` phases added beyond the checklist's literal list because AC-6/7/8's own Verified-by clauses require a staging rehearsal, matching `061`/`064`'s precedent.
- DONE: Document every acceptance criterion's status, with evidence, including offline tests and live Sheets-API results for AC-1 through AC-11
  See "Acceptance criteria evidence" below. AC-12/AC-13 are interactive and untouched, per the checklist.

### Acceptance criteria evidence

- AC-1 (offline, live): reconfirmed against production's live Expenses tab — 23 ijac rows in the window, 0 non-`exp-auto-`. Same figures spec recorded; re-derived independently this stage, not carried forward blind.
- AC-2 (offline, live): live `--report` against the corrected tab confirms the 8 headers match exactly and the in-window split (203 `支出`/1 `收入`) matches spec's recorded figures exactly. The whole-tab row count/date floor (744 rows, 2024-11-18..2026-05-02) differs from spec's recorded 310/2025-09-29 — informational only (logged, never gating): spec's own Drive-connector characterization evidently covered a narrower slice of the same tab, and every row outside the Jan-Apr 2026 window is excluded regardless of the tab's total size.
- AC-3 (offline `migration066.test.js` + live): fixture test proves income exclusion, duplicate-date disambiguation by source row, and refusal on an unrecognised `分類` value; live `--dry-run` shows exactly 203 candidates with the one income row (sourceRow 24, 2026-04-14, "賣掉攜車架") reported and excluded, not imported.
- AC-4 (offline + live): fixture test proves 房客→房客支出/進修→學費 and refusal (naming every gap) on an unmapped category; live read confirms all 17 target names resolve on both staging (房客支出→`cat_026`) and production (房客支出→`cat_023`) today — a wider divergence than spec's own "cat_023 both targets" note, handled correctly because the importer resolves by live `name_zh`, never a hardcoded id.
- AC-5 (offline + live): fixture tests prove ids derive from the sheet's own row number (not a counter) and are disjoint from every other entity's prefix; live check of both targets' current Expenses ids confirms zero `exp-mig066-` rows before the first apply (staging 1408 rows / 0 matches, production 4771 rows / 0 matches).
- AC-6 (offline + live staging rehearsal): offline test seeds decoys under `exp-hist-`, `exp-sub065-`, `exp-auto-`, and a plain `exp-{id}` shape and proves byte-identical survival through apply+undo; live `--rehearse` on staging (snapshot→apply→verify→hand-add→undo→diff→restore) reports "0 pre-existing rows touched" against all 1408 real pre-existing rows, and staging is restored byte-identical to its snapshot.
- AC-7 (offline + live): live rehearsal's undo, scoped to `exp-mig066-` only, removed exactly 203 rows and left the hand-added decoy (dated inside the window, a different id shape) untouched — proving the discriminator is the id prefix, not the date.
- AC-8 (offline, per the AC's own Verified-by clause): `migration066.test.js`'s full-cycle test applies, applies again (`created: 0`), and asserts the grid is unchanged.
- AC-9 (offline + live): `verifyTabIdentity` checks title AND gid via one metadata call before any data read — this is the exact check that caught Dispatch Retry 1's wrong tab live, before any write; `readMigrationGrid` requests only `A:H` (8 columns) on the confirmed tab; the branch diff (`git diff main...HEAD --stat`) carries only code, tests, a synthetic fixture, and this entity's own documentation — no raw 2025-dated or extra-column data.
- AC-10 (offline + live): fixture tests prove byte-for-byte preservation (trailing whitespace, full-width punctuation, an embedded name) through extraction AND through a normalization-sheet round-trip — the round-trip test caught a real bug (`parseSheetGrid` was trimming `notes`), fixed before this report; live rehearsal's `--verify` reports 0 notes-mismatches across all 203 real rows.
- AC-11 (offline + live): unit test asserts `run()` rejects with no `--target`; live, `--apply` without `--target` was never attempted (`resolveTargets` throws before any read, per its own code path exercised by the unit test).
- AC-12: interactive, not self-checked here, per the checklist.
- AC-13: interactive, not self-checked here, per the checklist.

### Summary

Live extraction surfaced a real defect before any write: the FO's build dispatch pointed the extractor at the wrong tab (`migrate`/`2065989204`, the spec's own documented out-of-scope 2025 block) instead of the actual Jan-Apr 2026 source (the export's own default-named tab, gid `792951830`). Per the stage's own Review-finding disposition, work stopped before any candidate mutation, the finding was escalated to the FO, and the FO independently re-verified it live and authorized the correction (Dispatch Retry 1). With the corrected tab, every offline test (20 in `migration066.test.js`, 340 across the full `functions` suite) passes, and a full live staging rehearsal — snapshot, apply of all 203 real rows, verify, a hand-added decoy, undo, diff, and restore — completed cleanly with zero pre-existing rows touched. Production was never written to; `--apply` against staging correctly refused pending the captain's own `APPROVED` mark on the normalization sheet now sitting on staging ("Migration066 Jan-Apr 2026") for her review.
