---
id: 061
title: Migrate 2023–2024 Historical Expense Data Into The App
status: spec
source: captain
started: 2026-08-31T02:26:05Z
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
        - id: gate:061:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:061-ideation-1
              briefing:
                id: briefing:061:ideation:attempt-1:revision-1
                digest: sha256:90c429a00191a5d21bfb921d288df43483503ef28ccf426975c16e81967923fe
                request-digest: sha256:616238f67c2e32a98590eb748fd3d55a0029d1b13b4af4c11e49a0129596d81b
                room-ref: ./review/ideation/briefing-1
              withdrawal:
                by: agent:first-officer
                at: "2026-08-28T14:39:26.491363Z"
                reason: Bound Briefing omits the first officer's recommendation and the concrete decision effect, which the gate-presentation contract requires the captain to see in the presentation channel. This workflow declares Subspace as its review surface, so the room itself must carry them rather than relying on surrounding chat. Inputs are unchanged; only the Briefing's completeness is at fault.
            - id: gate-attempt:061-ideation-2
              briefing:
                id: briefing:061:ideation:attempt-2:revision-1
                digest: sha256:f9c2cf21c57f70dc9f65739e3e54596ca31649c6eb70e313114c5cff13897358
                request-digest: sha256:0df636f568ce44ae9440694e05a7d87a64c52388cdf1302933d28f9d1f2abd05
                room-ref: ./review/ideation/briefing-2
              withdrawal:
                by: agent:first-officer
                at: "2026-08-28T14:48:46.071606Z"
                reason: Room briefing-2 was written by the spacedock 0.27.0 binary, which emits no index.json and is therefore unreadable by Subspace gate mode — the presentation failed its preflight. The binary is now 0.27.1, which does emit index.json. Rebinding so the room is readable in Subspace, this workflow's declared review surface. Briefing content is unchanged; only the room format is at fault.
            - id: gate-attempt:061-ideation-3
              briefing:
                id: briefing:061:ideation:attempt-3:revision-1
                digest: sha256:7d80892f81a50f494679959179b1c5c06fd3f727c2cd0b9cf06695db42f8038a
                room-ref: ./review/ideation/briefing-3
              resolution:
                type: Resolution
                id: resolution:spacedock:061:ideation:3
                briefing: briefing:061:ideation:attempt-3:revision-1
                by: person:captain
                at: "2026-08-31T02:24:07.567092Z"
                decision: approve
                reason: 'Captain approved the ideation direction: migrate 2023-2024 historical expense records into the app, feasibility judged and reported before any write. Scope bounded to those two years; all other archive years remain with 060. Spec must settle whether 2023 data exists by inspecting tab gid=0, surface the 25-bucket to flat gov_category mismatch as a captain decision rather than resolving it, and state the undo and blast-radius plan before any import.'
              application:
                target-stage: spec
                state: consumed
---

Evaluate whether the captain's 2023 and 2024 historical expense records can be migrated into the live app, and if so, migrate them — so the app itself holds those two years instead of them living only in Google Sheets. Feasibility is judged before any write is attempted.

This feature blocks `060-historical-expense-analysis`: the captain chose migration-first, so the 2006–2025 growth report is specced only after this lands and may read the migrated data as a source.

## User Stories

- As the captain, I want my 2023 and 2024 spending to live inside the app, so I can see those years alongside the data I log day to day instead of opening old spreadsheets.
- As the captain, I want to be told honestly whether this is even possible before anyone writes to my live data, so I am not left with a half-migrated app.
- As the captain, I want the migration to be reversible, so a bad import does not cost me the records two of us use every day.

## Success

- A written feasibility verdict, delivered before any write: possible, possible-with-caveats, or not possible, with the reason.
- If feasible: 2023 and 2024 expense records present in the app, attributed to the correct categories, dates, and amounts.
- The live data two people use daily is intact — no existing row altered or lost, verified against a before/after check, not asserted.
- A stated, exercised way to undo the migration.

### Out of Scope

- Years other than 2023 and 2024. The remaining archive years are inventoried and analysed by `060`, not imported here.
- The growth analysis itself — that is `060`'s deliverable.
- Any new app UI for browsing historical years. This feature lands data, not screens.
- Changing what the app does with categories going forward, beyond what landing these two years requires.

## Plan

To be filled in at spec time. Open questions this must resolve:

- **Does 2023 data actually exist?** `060`'s recorded spec finding states the archive holds no 2023 record at all. The captain has since pointed at tab `gid=0` of the 2024 workbook and asked to migrate "2024, 2023". Spec settles this by inspecting the tab, not by assuming either side is right. If 2023 genuinely has no record, this feature covers 2024 only and says so.
- **The taxonomy does not map 1:1.** The historical records carry 25 top-level buckets over 61 sub-categories with four row-kind tags (monthly, annual, irregular, rental-property). The app uses a flat `gov_category` set in `app/app/lib/categories.ts`. Spec decides what happens to buckets with no app equivalent, and whether the app's category set changes or the import approximates — this is a captain decision, not an implementer's.
- **Rental-property and income rows.** The source tables interleave income rows and rental-property pass-through flows with household expense rows. Spec decides whether these are imported, excluded, or marked, since importing them silently distorts every total the app shows.
- **Aggregate rows are interleaved with data rows.** Section totals and per-kind subtotals sit in the same columns as real line items; importing them double-counts. The row-kind tag in column A is the filter.
- **Reversibility and blast radius.** The target sheets are production data in daily use. Spec states how the migration is undone, how the before/after integrity check is performed, and whether it runs against staging first.
- **Which source file per year.** Several years have duplicate, template, and legacy `.xls` variants. Spec states the pick rule.


## Spec

### Decisions needed from the captain

Read these first. Each names the outcome at stake, then the ways to get there. None is resolved in this spec — approving the spec means picking one option per decision. Where a recommendation is given it is a recommendation, not a default that applies by silence.

#### D0 — Does 2023 exist, and how do we look?

**Outcome at stake:** whether this feature covers one year or two.

**Status: unresolved, and blocked on access, not on judgment.** This spec was required to settle the question by inspecting tab `gid=0` of the 2024 workbook (`1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I`) and could not. The Google Drive connector in this session is signed in to the captain's **work** account, not the personal account that owns the archive. `get_file_metadata` and `read_file_content` on that exact file id both returned `Requested entity was not found`, and a title search returned only files owned by the `infuseai.io` / `reccehq.com` accounts. The app's Firebase service account is not a second route: that workbook was never shared with it.

`060`'s recorded finding ("the archive holds no 2023 record") is **not** carried forward as settled — it was a finding about the archive *folder*, and the captain has since pointed at a *tab inside the 2024 workbook*. Those are different places. The question is genuinely open.

- **A. Reconnect the Drive connector to the personal Google account** that owns the archive, then re-run the inspection before build starts. Cleanest; costs the captain one reconnection.
- **B. Share the 2024 workbook with the currently-connected work account** (Viewer is enough). Fastest; puts a personal financial workbook into a work account's Drive.
- **C. Captain pastes the structure of `gid=0`** — row-1 headers and the distinct column-A row-kind tags, structure only, no figures. Enough to settle the question without any access change.
- **D. Ship 2024-only and treat 2023 as a follow-up.** Honest, but risks leaving on the table a year the captain explicitly asked for.

*Recommendation: A or C, resolved before build is dispatched.* Whichever is chosen, the inspection result is recorded in this entity before any write — that is AC-13, and it gates the import.

#### D1 — How the 25 historical buckets land in the app's categories

**Outcome at stake:** whether a 2024 row is still recognisable as what it was, and whether the app's live Categories tab changes.

The app stores one `category_id` per expense and validates it against the Categories tab on every write (`functions/src/index.ts`, `categoryIdError`). The historical records carry 25 top-level buckets over 61 sub-categories. There is no 1:1 mapping.

- **A. Map onto the existing 24 categories only; anything unmappable becomes `other`.** No change to live config. But `other` swells, and the cross-year comparison the captain wants is blurred exactly where the interesting differences sit.
- **B. Add new categories to the Categories tab for the unmapped buckets, marked `is_active: false`.** Full identity, and inactive categories stay out of the daily-entry picker. But it mutates a config both users share, and the History filter list grows.
- **C. Map onto existing categories, and write the original bucket, sub-category and row-kind verbatim into each row's `notes`.** No live-config change at all; the original taxonomy stays recoverable. The History page already searches and displays `notes` (`app/app/history/page.tsx:86`, `:543`), so the historical bucket is searchable the day it lands.
- **D. C, plus one new inactive category for buckets with genuinely no equivalent** — a hybrid if `other` turns out to swallow too much.

*Recommendation: C, with D as the fallback if the dry-run shows more than ~15% of the year's total landing in `other`.*

#### D2 — Rental-property flows and income rows

**Outcome at stake:** whether every total the app shows still means "what the household spent".

The source table interleaves income rows and rental-property pass-through flows with household expense rows, distinguished by the column-A row-kind tag.

- **A. Exclude both.** App totals stay directly comparable to today's usage. The rental and income record simply is not in the app.
- **B. Import all expense-side rows including rental-property; exclude income.** Rental-property cost then inflates every Reports figure with no way to subtract it.
- **C. Exclude income; import rental-property rows with their row-kind stamped in `notes`.** They are present and identifiable, but they still land in the same totals — the app has no concept of a row that is excluded from a sum.
- **D. Import income as negative amounts.** *Not recommended and stated only to close it off:* the app sums `amount` with no sign handling anywhere (`app/app/lib/reportService.ts`), so this silently corrupts every monthly and annual total.

*Recommendation: A for income — the app has no income model at all (the Expenses tab has `amount` and no type or sign column), so any import of it is a distortion dressed as data. C for rental-property, if the captain wants those rows visible; A if the priority is that the app's totals mean household spending and nothing else.*

#### D3 — Undo, blast radius, and whether staging goes first

**Outcome at stake:** the live data two people use daily.

Two verified facts shape the options:

- `functions/scripts/load-local-env.js` reads the repo-root `.env.local` and `functions/.env` **only** — never `functions/.env.staging`, which is where `STAGING_SETUP.md:97-105` puts the staging `SPREADSHEET_ID`. **There is no supported way to point an admin script at staging today**, and the id it does resolve is whichever the deploy env files hold. That is why AC-12 exists: the script must be told its target rather than inheriting one.
- `functions/scripts/backfill-subscription-history.js` already proves the safe write shape on this sheet: deterministic ids, `--dry-run`, batched all-or-nothing `insertDimension`+`updateCells`, and a `PartialWriteError` that carries the ids already written.

Target sequencing:

- **A. Staging first, then production.** Requires adding an explicit `--target staging|production` flag that reads `functions/.env.staging` (~15–25 LOC). Costs one small change; buys a full rehearsal of apply *and* undo against data nobody depends on.
- **B. Production only, with `--dry-run` first and a full pre-import snapshot of the Expenses tab.** Faster; the first real write is also the first real test.

Undo mechanism:

- **U1. Deterministic ids + `--undo`.** Every imported row carries `exp-hist-{year}-{NNNN}`; undo deletes exactly the rows with that prefix. Precise, repeatable, and it leaves anything the two users entered in between untouched. Follows the existing `exp-auto-{sub}-{date}` convention (`functions/src/scheduler.ts:87`).
- **U2. Copy the whole spreadsheet before the import; restore by hand if it goes wrong.** Coarse — restoring also throws away every expense either user logged after the snapshot.
- **U3. Both.** U1 as the routine reversal, U2 as the floor under it.

*Recommendation: A + U3. The undo is exercised on staging before production is touched (AC-6), so "reversible" is a demonstrated fact rather than a claim in a report.*

#### D4 — Date granularity, and how many rows this adds

**Outcome at stake:** whether the app stays fast, and whether a monthly figure can masquerade as a real transaction date.

The source is an annual matrix: one row per line item, twelve monthly columns. The app stores a day-level `date` and filters reports by `date.startsWith(year)` and `YYYY-MM`. There is no pagination anywhere — `GET /api` returns every expense and the client sorts and filters the whole list (`app/app/lib/historyService.ts`, `app/app/history/page.tsx`).

- **A. One row per line item per month that has an amount, dated the 15th.** Monthly and annual reports both work. Mid-month avoids month-boundary and timezone edges, and reads less like a real transaction than the 1st (which also collides visually with subscription auto-entries). Upper bound ≈118 line items × 12 ≈ 1,400 rows per year, less blanks.
- **B. Same, dated the 1st.** Same row count; more likely to be mistaken for a real entry.
- **C. One row per line item per year, dated 31 December.** ≈118 rows per year. Annual reports correct, monthly reports wrong — every historical month except December shows zero.

*Recommendation: A, with the exact row count reported from `--dry-run` before any write so the size is a known number, not a surprise. If the dry-run count is large enough to slow the app noticeably, that is a finding to bring back to the captain, not something the build silently works around.*

### Goal

Land the captain's 2024 — and 2023 if `gid=0` proves it exists — historical expense records as ordinary rows in the app's Expenses tab, reversibly and without touching a single existing row, so those years appear in Reports alongside everyday data.

### User Stories

- As the captain, I want to open Reports, step back to 2024, and see a real total, so those years are part of the app rather than a spreadsheet I have to go find.
- As the captain, I want to be told what the import would write before it writes anything, so the first real change is one I already approved in detail.
- As the captain, I want one command that puts the app back exactly as it was, so a bad import costs me an afternoon and not my records.
- As the captain, I want to know which historical bucket a row came from when I look at it, so a 2024 figure is still interpretable two years from now.

### Edge Cases

- **2023 may have no record at all.** A missing year is a gap to report, never a zero. If `gid=0` holds no 2023 rows, the import covers 2024 only and the stage report says so in as many words.
- **Aggregate rows sit in the same columns as data rows.** Section totals and per-kind subtotals must be filtered out by the column-A row-kind tag. Importing them roughly doubles the year — this is what AC-2's 1% reconciliation catches.
- **Rows with a blank column-A tag.** Neither data nor a recognised aggregate. Skipped and counted, never guessed at; the dry-run reports the count so an unexpected number is visible before the write.
- **Blank month cells.** A blank may mean nothing was spent or nothing was logged. Blank and zero are both skipped — no zero-amount row is ever written, because a zero row is indistinguishable from a real free month once it is in the app.
- **Amounts formatted as strings.** Thousands separators and occasional currency prefixes. A value that fails to parse aborts the run with the source cell reference; it never silently becomes 0.
- **Uncategorised line items.** An amount with a blank bucket goes to an explicit bucket, is visible in the totals, and is counted in the dry-run — never dropped.
- **Two users logging expenses while the import runs.** Rows are inserted at the top and shift every row index below them. Every check keys on the row `id`, never on a row index, so a concurrent manual add cannot be mistaken for an imported row or vice versa.
- **A batch fails halfway.** `PartialWriteError` carries the ids already written; `--undo` removes exactly those. The run is then re-runnable from clean.
- **The import is run twice.** Deterministic ids mean the second run finds every id already present and writes nothing (AC-5).
- **Sheets API write quota.** Batches of 50, matching the existing backfill script's `WRITE_BATCH_SIZE`.
- **Duplicate, template, and legacy `.xls` variants of a year.** Pick rule: the native Google Sheet whose title is exactly the year, owned by the captain, most recently modified; templates and drafts are excluded by name and the excluded file ids are listed in the stage report. This feature reads at most two source files, so the rule is stated and applied by hand rather than automated.
- **The app has no income concept.** There is no sign or type column on the Expenses tab, so an income row cannot be represented without corrupting a sum. This is why D2 exists.

### Out of Scope

- Years other than 2023 and 2024. The rest of the archive stays with `060`.
- The growth analysis itself — `060`'s deliverable.
- Any new app UI. Reports already has an annual year stepper that reaches back arbitrarily (`app/app/reports/page.tsx:721`), which is how the imported years become visible. No screen is built here.
- Changing what the app does with categories going forward. If D1-B or D1-D is chosen, the new categories are inactive and exist only so historical rows resolve.
- Pagination or performance work on `GET /api`. If the dry-run row count shows this is needed, that is a finding for the captain and its own feature.
- Multi-currency handling.
- Writing any real figure, vendor name, or account identifier into this public repository.

## Acceptance criteria

Verification split: **offline** — AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10, AC-11, AC-12, AC-13. **Interactive** — AC-7, AC-8. No harness is built to automate AC-7 or AC-8; both are judged on a live drive of the deployed app.

**AC-1 — No pre-existing expense row was altered or deleted by the import.**
Verified by: offline — the script's `--snapshot` writes the full Expenses tab before the run; `--verify` diffs it against the post-import tab and reports `0 modified, 0 deleted` among rows whose id does not begin `exp-hist-`. Falsified by: changing the writer from row-insertion to an in-place `values.update` over existing rows — the diff then reports modified rows and the check fails.

**AC-2 — Each imported year's total reconciles to the workbook's own annual expense total for that year within 1%.**
Verified by: offline — `--verify` prints computed total, source total, and variance for each year; the run fails on variance above 1%. Falsified by: removing the column-A row-kind filter so aggregate rows are summed — the computed total roughly doubles and the check fails.

**AC-3 — No aggregate or untagged source row became an expense in the app.**
Verified by: offline — `--dry-run` prints source rows classified per column-A tag beside the planned write count, and the two agree exactly. Falsified by: accepting rows with a blank column-A tag, which makes the planned count exceed the classified count.

**AC-4 — Income-side source rows are absent from the app after the import.**
Verified by: offline — `--verify` asserts zero imported rows trace to an income-side bucket, listing the income buckets it excluded. Falsified by: dropping the income-bucket exclusion, which makes the assertion report a non-zero count.

**AC-5 — Running the import a second time writes nothing.**
Verified by: offline — a second `--apply` against the same target reports `created: 0` with every candidate skipped as already present. Falsified by: generating row ids from `Date.now()` instead of the deterministic `exp-hist-{year}-{NNNN}` — the second run then writes a full duplicate set.

**AC-6 — Undo restores the Expenses tab to its pre-import state, and touches nothing else.**
Verified by: offline, on staging — `--snapshot`, `--apply`, `--undo`, then a diff of the tab against the snapshot showing no difference; a row added by hand between apply and undo survives. Falsified by: having undo match on the row's date-year instead of the id prefix — the hand-added row is then deleted too and the diff fails.

**AC-7 — Reports → Annual, stepped back to an imported year, shows a non-zero total matching AC-2's reconciled figure within 1%.**
Verified by: interactive — a live drive of the deployed app (staging before merge, production after deploy): open Reports, switch to Annual, step the year back, read the total. Falsified by: writing rows with a date outside the year they belong to — the annual filter `date.startsWith(year)` then returns zero and the view is empty.

**AC-8 — Everyday use is unaffected after the import: adding an expense in the app still writes it and shows it in today's list, and History still loads.**
Verified by: interactive — a live drive on staging: add an expense, see it appear, delete it; then open History and confirm it renders. Falsified by: writing rows wider than the Expenses header row, which makes `buildColumnMap` throw and `GET /api` return 500 for every request.

**AC-9 — Every imported row's `category_id` resolves to a live category.**
Verified by: offline — `--verify` asserts each imported `category_id` is present in the Categories tab, and reports the Categories row count before and after the run so an unintended category write is visible. Falsified by: writing a raw historical bucket name into `category_id`, which leaves ids that resolve to nothing.

**AC-10 — Every imported row records where it came from.**
Verified by: offline — `--verify` parses each imported row's `notes` and asserts it yields source top-level bucket, sub-category, row-kind, and source year-month. Falsified by: dropping the bucket from the notes template, which makes the parse yield three fields instead of four.

**AC-11 — No figure, vendor name, or account identifier from any source workbook is committed to this repository.**
Verified by: offline — the generated import plan is written under the already-gitignored `functions/backfill-reports/` (`.gitignore:39`), confirmed with `git check-ignore`, and the branch's full diff is read before the PR. Falsified by: writing the plan under `functions/scripts/`, where `git check-ignore` returns non-zero and the file appears in the diff.

**AC-12 — The import refuses to run without an explicit target.**
Verified by: offline — invoking the script with no `--target` exits non-zero, writes nothing, and the Expenses row count is unchanged. Falsified by: falling back to `load-local-env.js`'s resolved `SPREADSHEET_ID`, which today silently resolves to production.

**AC-13 — Whether 2023 has a record is settled by inspecting tab `gid=0`, and recorded before any write.**
Verified by: offline — the build stage report names the file id read, the tab's row-1 headers, and the distinct years found in it; `--dry-run`'s per-year counts agree with that finding, and if no 2023 rows were found the shipped scope is 2024 only. Falsified by: an import plan containing 2023 rows that the `gid=0` inspection did not find.

## Risk evidence

**Riskiest unverified mechanism: reading the source workbook at all.** Exercising it failed. Both Drive-connector reads of file id `1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I` returned `Requested entity was not found`; a title search returned only work-account files, confirming the connector is authenticated to the wrong Google account. A service-account route was also attempted and is not viable — the workbook was never shared with `expense-sheet-functions@…`. **This is the one thing that must be resolved before build is dispatched** (D0). Every other mechanism in this feature is already proven.

**Second risk: the bulk write. No spike needed** — the mechanism is already proven on this exact sheet by `functions/scripts/backfill-subscription-history.js` (entity 051): deterministic ids (`autoExpenseId`, `functions/src/scheduler.ts:87`), `--analyze`/`--dry-run`/`--apply` phases, batched all-or-nothing `insertDimension`+`updateCells` (`insertRowsAtTop`), skip-if-id-present idempotency, and `PartialWriteError` carrying already-written ids. This feature reuses that shape rather than inventing one.

**Verified blast-radius fact:** `functions/scripts/load-local-env.js` resolves `SPREADSHEET_ID` from `functions/.env` or the repo-root `.env.local`, and never from `functions/.env.staging` — so an admin script inherits a target rather than being given one, and cannot be aimed at staging at all. AC-12 and D3-A exist because of this.

## Expected surface and tolerance

Estimate: **+700 net LOC across 4 files, tolerance ±30%.**

- `functions/scripts/migrate-historical-expenses.js` — new, ~450–600 LOC (parse, classify, plan, dry-run, apply, verify, undo).
- `functions/test/migrate-historical-expenses.test.js` — new, ~150 LOC against local JSON fixtures, following `functions/scripts/fixtures/`.
- `functions/scripts/load-local-env.js` — ~15–25 LOC for `--target staging|production`.
- `functions/package.json` — 4–6 script entries.

Semantics this may change: **stored data only** — new rows in the production Expenses tab, and the Categories tab too if the captain picks D1-B or D1-D. No API shape change, no auth change, no scheduled-behavior change, no client change.

## Test plan

- **Unit, offline:** `npm --prefix functions test` over local JSON fixtures — row classification, aggregate-row rejection, amount parsing including the failure case, blank/zero skipping, deterministic id generation, notes assembly, and the undo id-prefix match. Covers AC-3, AC-5, AC-10 and the falsifying edits named against each.
- **Dry-run, offline:** `--dry-run --target staging` prints per-year planned row counts, reconciliation variance, and the exclusion counts. Covers AC-2, AC-4, AC-13.
- **Apply + undo rehearsal on staging, offline:** snapshot → apply → verify → add one row by hand → undo → diff against snapshot. Covers AC-1, AC-6, AC-9, AC-12.
- **Live drive, interactive:** deployed staging — Reports → Annual stepped back to each imported year, then add/see/delete one expense and open History. Covers AC-7 and AC-8; repeated against production after deploy.
- **Cost:** unit and dry-run are seconds. The staging rehearsal is the expensive step and depends on D3-A being chosen; without it, there is no rehearsal and production is the first write.

### Feedback Cycles

## Stage Report: spec

- FAILED: Settle whether 2023 data actually exists by inspecting tab gid=0 of the 2024 workbook (spreadsheet id 1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I) and report the finding either way
  Access blocker, not a judgment call: `get_file_metadata` and `read_file_content` on that file id both returned `Requested entity was not found`, and a Drive title search returned only `infuseai.io`/`reccehq.com`-owned files — the connector is signed in to the captain's work account, not the personal account that owns the archive. A service-account route was probed and rejected too (the workbook was never shared with `expense-sheet-functions@…`). Two follow-up Drive searches were then blocked by the permission classifier. Escalated to the first officer with three concrete unblock options; carried into the spec as decision D0 and as AC-13, which gates the import on that inspection.
- DONE: do NOT carry 060's recorded "no 2023 record in the archive" forward as settled
  D0 states explicitly that 060's finding was about the archive *folder* while the captain pointed at a *tab inside the 2024 workbook*, and treats the question as open rather than closed either way.
- DONE: if 2023 has no record say so and scope this feature to 2024 only
  D0 option D and AC-13 both carry the 2024-only fallback; AC-13's evidence requires the shipped scope to match what the gid=0 inspection actually found.
- DONE: Write a top-level `## Acceptance criteria` section whose entries are `**AC-N - {property}**` followed by a `Verified by:` clause that names the concrete change which would falsify the evidence
  13 criteria at `index.md:211`, each `**AC-N — property**` + `Verified by:` + `Falsified by:`. Offline/interactive split declared at the head of the section: AC-7 and AC-8 are interactive and no harness is built for them.
- DONE: confirm `spacedock status --read 061 --stage spec --ac-scan` actually reads them rather than erroring
  Exercised, not asserted — the command previously exited 1 with `no ## Stage Report for stage "spec"`; it now exits 0 and lists all 13 AC ids with their line numbers. It reports `unevidenced=true` for 10 of them, which is correct at spec: an AC earns a citation when the stage that proves it reports evidence, and no AC has been proved yet. The proposed proof for each lives in its own `Verified by:`/`Falsified by:` clause.
- DONE: Surface as captain decisions with options rather than resolving them in-spec: the 25-bucket/61-sub-category to flat gov_category mapping
  D1, four options (map-to-existing / new inactive categories / notes-carried taxonomy / hybrid), recommendation stated as a recommendation.
- DONE: ... the treatment of rental-property pass-through and income rows
  D2, four options including the negative-amount option stated only to close it off, grounded in the fact that the Expenses tab has no sign or type column.
- DONE: ... and the undo plus blast-radius plan including whether the import runs against staging first
  D3, target sequencing (staging-first vs production-only) crossed with three undo mechanisms, resting on a verified finding: `load-local-env.js` never reads `functions/.env.staging`, so no admin script can be aimed at staging today.

### Summary

The mandated gid=0 inspection could not be done: the Drive connector in this session is authenticated to the captain's work Google account, not the personal account that owns the archive, and both direct reads of the workbook returned "not found". That is escalated rather than guessed around — the 2023 question stays open in the spec as decision D0 and as AC-13, which blocks the import until the tab is actually read.

Everything else is written in full. The four captain decisions (D0 taxonomy access, D1 category mapping, D2 rental/income, D3 undo and blast radius) are presented as options with recommendations, plus a fourth the checklist did not name but that materially changes the deliverable: D4, date granularity, where the choice is between roughly 1,400 rows per year with working monthly reports and roughly 118 with broken ones, in an app that has no pagination anywhere.

The spec's spine is an existing precedent rather than a new design: `functions/scripts/backfill-subscription-history.js` already performs a safe bulk write against this exact sheet, so the mechanism is proven and only the source parsing is new. The one genuinely new finding is a blast-radius one — `load-local-env.js` resolves an admin script's spreadsheet target from the deploy env files and never from `functions/.env.staging`, meaning a migration script inherits its target instead of being told it. AC-12 makes refusing to run without an explicit `--target` a shipped property.
