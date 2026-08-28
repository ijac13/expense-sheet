---
id: "060"
title: Historical Expense Analysis — Understand How to Spend Less Again
status: ideation
source: captain
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Produce an analysis report of past expense records — all years since 2006, starting with a 2024 Google Sheet as the first one to work through, in varying formats — with no migration into the app's data at all. The goal is purely to understand spending patterns well enough to answer one question: in the past the captain could live on less than NT$1.2M/year, and today needs more — why, and what would it take to bring that back down gradually (not by next year — slowly, over time)?

Reference sheet (2024, first data source): https://docs.google.com/spreadsheets/d/1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I/edit?gid=1209807047#gid=1209807047

Full historical archive (all years, captain's Google Drive folder): https://drive.google.com/drive/u/0/folders/0B7ijxIFRP1RQTy1rWHpDZldlcVU?resourcekey=0-LI4sE0FkVp7AFab9AV7gqg — this is where every year's record lives; the 2024 sheet above is the first one to actually work through.

## User Stories

- As the captain, I want to see how my past spending (2024, and eventually further back to 2006) breaks down by category, so I can compare it to today's spending and see where the difference actually is.
- As the captain, I want to understand *why* I used to spend less — which categories grew, which habits changed, what's new now that wasn't there before — not just see a total number.
- As the captain, I want a realistic, gradual path back toward ~NT$1.2M/year, not a crash-diet plan for next year, so the target is something I can actually work toward.

## Success

- A written analysis report covering every year since 2006 that has a usable record, starting with 2024 as the first one actually worked through — no data is loaded into the app itself.
- Each year's spending is understood and categorized well enough to compare across years, even though formats differ and categories won't map 1:1 to the app's current Categories tab.
- A clear comparison between "what I spent then" (the sub-NT$1.2M years) and "what I spend now" by category, surfacing the biggest gaps.
- A written-out, honest set of candidate reasons for the increase (e.g. specific categories, one-time vs. recurring changes, inflation vs. lifestyle change) — not just a number.
- A gradual, realistic target/pacing the captain can track against over time, delivered as part of the report (exact tracking mechanism, if any, is a separate later decision — see Out of Scope).

### Out of Scope (decide at spec time)

- **Migrating any historical row into the live app's Expenses/Subscriptions sheets, for any year.** This is a report, not a data-loading project. The sheets and Drive folder are read-only source material.
- Building any ongoing tracking mechanism (dashboard, new Reports view, target line in the app) — this entity delivers the analysis and a target; whether/how that becomes a live feature is a separate future decision.
- Automating the reduction itself (budgets, alerts, spending caps) — this entity is about understanding and a target, not enforcement.
- Multi-currency handling, if older records turn out to be in anything other than the currency the app already assumes.

## Plan

To be filled in at spec time — open questions this needs to resolve before/during spec:

- **Sheet/folder access.** This is a personal Google Sheet and Drive folder, not the app's existing spreadsheet-as-database. Does the existing service account have access, or does the captain need to share the sheet (and eventually the folder) first (same blocker pattern as entity 042)?
- **Format discovery.** What does the 2024 sheet's structure actually look like (columns, categories, granularity), and what does the Drive folder actually contain (how many years, what file formats — Sheets, CSV, scanned images, something else) — before assuming anything about how to process any of it.
- **How far back is realistic.** 2006–2024 could be up to 19 years of records in inconsistent formats. Spec should figure out what's actually in the folder before committing to processing every single year in one pass; a phased or best-effort approach across years may be more honest than promising all 19 up front.
- **Where the report lives.** A written document (e.g. committed to the repo or shared as a doc), not a new app feature — matches "no migration" above.
- **How "reduce gradually" gets expressed** in the report — e.g. a suggested year-over-year glide path — without turning this into a budgeting-enforcement feature (explicitly out of scope above).

## Spec

### Decisions needed from the captain

Read these first. Each has a proposed default — approving the spec as-is means accepting the defaults.

1. **Where the report lives.** `github.com/ijac13/expense-sheet` is a **public** repository, and the repo's PII pre-commit hook only detects phone numbers and email addresses (`scripts/hooks/pii-scan.js:11-15`) — it would not stop a commit containing real income and spending figures. The report is nothing but real figures, so it cannot be a file in this repo. **Proposed default:** the report is a private Google Doc created in the captain's existing archive folder, alongside the source sheets it is derived from; the repo records only the Doc URL. **Fallback if preferred:** a local markdown file under a new `analysis/` directory added to `.gitignore` — durable only on one machine. Say which.
2. **How many years this round.** **Proposed default:** 2024 in full, plus one baseline year from the sub-NT$1.2M era in full, plus a shape inventory of every other year so a follow-up entity can batch the rest. Processing all 18 archived years in one pass is not honest scoping. See AC-8.
3. **What "today" is measured as.** The archive has no 2023 and no 2025 record, and the app's own production sheet only starts partway through the current year. **Proposed default:** 2024 is the "now" anchor because it is the most recent complete year on record; current-year app data is a secondary cross-check, never the primary comparison.

### Access — resolved

The open question from the ideation Plan is closed: **no captain action is needed.** This session reads both sources through the Google Drive connector on the captain's own account, which owns them. This is unrelated to the app's Firebase service account, which is not involved and is not needed.

Confirmed by inspection (structure only — no figures were recorded):

- **2024 workbook.** A single-year workbook containing 9 tables. The authoritative one is a 19-column annual matrix: column A a row-kind tag, B a top-level category, C a sub-category, D a line-item description, E a note, F a payment account, G the annual total, and H–S the twelve monthly columns. It holds 118 data rows plus 10 aggregate rows (section totals and per-kind subtotals) **interleaved in the same columns as the data**. The other 8 tables are: a very wide daily itemized log (~749 columns, repeating item/amount column pairs per calendar day), a category-by-month rollup, a multi-decade projection table carrying a per-year required-spending column that runs from 2024 to 2041, a receivables tracker, a budget variant with percent-of-total columns, a payment-account reference table, and two dated item/amount/mileage logs.
- **Taxonomy.** Two levels: 25 distinct top-level buckets (5 of them income-side) over 61 distinct sub-categories. Expense rows carry one of four row-kind tags distinguishing monthly, annual, irregular, and rental-property spending.
- **Archive folder.** 18 distinct years hold a dedicated record — 2006 through 2022, plus 2024. **2023 and 2025 have no record in the folder.** Most are native Google Sheets; several years additionally have a legacy `.xls` binary of the same year, and there are template, draft, and "new" duplicate variants for 2007, 2018, and 2019. Two year files are owned by a second Google account but are readable. The folder also contains the app's own production and staging spreadsheets, plus unrelated PDFs, images, and sub-folders that are not expense records.

### Goal

Produce a written analysis report — delivered privately, with no historical row ever written into the app — that explains why the captain's annual spending now exceeds the sub-NT$1.2M/year level of earlier years, and proposes a gradual year-by-year path back toward it.

### User Stories

- As the captain, I want my 2024 spending broken down by category and compared against a year when I lived on under NT$1.2M, so I can see where the difference actually sits instead of guessing.
- As the captain, I want the reasons for the increase written out and labelled recurring or one-time, so I can tell what is structural and what was a bad year.
- As the captain, I want a realistic multi-year glide path back toward NT$1.2M/year, checked against the projection I already keep, so the target is something I can work toward rather than a number invented from scratch.
- As the captain, I want to know exactly which years are still unprocessed and why, so I can decide whether extending the analysis is worth another round.

### Acceptance Criteria

- [ ] AC-1 — The report names all 9 tables in the 2024 workbook, states which single table it used as the authoritative annual expense source, and gives a one-line reason for excluding each of the other 8.
- [ ] AC-2 — The report's own computed 2024 total expense is reconciled against the total the workbook itself carries, agreeing within 1%. The report states both figures and the variance. Aggregate rows are excluded from the summation; if they are not, the figure will be roughly double and this AC fails.
- [ ] AC-3 — The report presents 2024 expenses broken down at both the top-level and sub-category level, with the four expense row-kinds (monthly, annual, irregular, rental-property) reported separately rather than merged into one number.
- [ ] AC-4 — The report contains a mapping table with exactly one row for each of the 25 top-level buckets, mapping each to either one `gov_category` value from `app/app/lib/categories.ts` or the literal marker "no app equivalent". The report states in one sentence that this mapping is approximate and exists only for cross-year comparison.
- [ ] AC-5 — Exactly one baseline year is fully processed, selected by this stated rule: the earliest year whose file opens and whose reconciled annual expense total is under NT$1.2M. The report names the year chosen and every year rejected ahead of it, with the reason for each rejection.
- [ ] AC-6 — The report contains a comparison table of 2024 against the chosen baseline year, one row per `gov_category` bucket, showing both years' amounts and the difference, sorted by difference descending.
- [ ] AC-7 — The report lists at least 3 candidate explanations for the increase. Each names a specific bucket or row-kind, is labelled "recurring" or "one-time", and cites the difference from AC-6 that supports it.
- [ ] AC-8 — The report contains a year inventory with one row for every year from 2006 to 2025 inclusive, each classified as: same shape as 2024, different shape, unreadable, or no record found. Rows for years not processed this round state what extending to them would require.
- [ ] AC-9 — The report proposes at least one year-by-year glide path from the 2024 level toward NT$1.2M/year, stating a target end year, a per-year target figure, and a named rationale for each step. It explicitly states whether it agrees or disagrees with the per-year required-spending column already present in the workbook's projection table, and why.
- [ ] AC-10 — The report exists at the destination agreed in Decision 1, and the captain can open it. The entity file records only its location, never its contents.
- [ ] AC-11 — No figure, vendor name, account identifier, or line item from any source sheet appears anywhere in this repository — not in the report path if the fallback is chosen and gitignored, not in the entity file, not in any commit message. Verified by inspecting the full diff of the build stage before committing.
- [ ] AC-12 — No write operation is issued against any Google Drive or Sheets file except creating the report itself. The stage report lists every file ID touched and marks each read or write. The app's production and staging spreadsheet `modifiedTime` values are recorded before and after the build and are unchanged, or any change is explained.

### Edge Cases

- **Aggregate rows interleaved with data rows.** Section totals and per-kind subtotals sit in the same columns as real line items. Summing the column blindly double-counts. Filter by the row-kind tag in column A.
- **Rental-property flows.** Rental income and rental-property expenses are pass-through property activity, not household living cost. Including them inflates both sides and distorts the comparison the captain actually asked for. They must be reported separately and the report must state which figures include them.
- **Income rows in the expense table.** The authoritative table holds both income and expense rows. Filtering on the row-kind tag, not on the presence of a number, is what separates them.
- **Two files for one year.** 2007, 2018, and 2019 each have a "new" or drafting duplicate, and 2006–2011 each additionally have a legacy `.xls` binary. The report states the pick rule it applied and which file it used per year.
- **Template and development files.** Several files look like year records by name but are templates or scratch copies with no real data. They must not be mistaken for a year's record.
- **Missing years.** 2023 and 2025 have no record at all. A year with no file is a gap to report, never a zero.
- **Missing months inside a year.** A blank month column may mean nothing was spent or may mean nothing was logged. A year total under NT$1.2M only because months are blank is a false baseline — AC-5's chosen year must have all twelve months populated, or the report says why not.
- **Uncategorised line items.** Rows carrying an amount with a blank category column go to an explicit "uncategorised" bucket and are shown in the totals rather than silently dropped.
- **Files owned by a second account.** Two year files are owned by a different Google account. They read normally today; if a read fails, the report records it as an access gap rather than as an empty year.
- **The daily log's width.** The daily itemized table is roughly 749 columns wide and may exceed tool limits on a single read. It is excluded from the authoritative path (AC-1), so a failure to read it must not block the analysis.
- **Formatted values.** Amounts appear as formatted strings with thousands separators and sometimes a currency prefix. Parsing must handle both, and a parse failure must surface rather than silently become zero.

### Out of Scope

- **Migrating any historical row into the app's Expenses, Subscriptions, or Categories tabs, for any year.** This is a report. The sheets and the Drive folder are read-only source material.
- Any new app UI or feature — no Reports view, no dashboard, no target line, no chart in the app. Whether the target ever becomes a live feature is a separate future decision.
- Any automated budget enforcement: no caps, alerts, or blocking.
- Multi-currency handling, if older records turn out to use anything other than the currency the app assumes.
- Changing the app's Categories tab or `gov_category` assignments to accommodate historical buckets. The AC-4 mapping lives in the report only.
- Processing all 18 archived years this round. AC-8 inventories them; extending is a follow-up entity.
- Tax, legal, or investment advice. The report describes spending and proposes a spending target, nothing more.

## Stage Report: spec

- DONE: Read the full current entity file at workflow/060-historical-expense-analysis.md.
  Read all 50 lines including the captain's mid-session revision; the twice-stated no-migration constraint is restated verbatim in Out of Scope.
- DONE: Check for read access to the 2024 sheet and the Drive folder; report what you found.
  Read access confirmed on both via the Google Drive connector on the captain's own account; findings recorded under "Access — resolved" as structure only. No blocker, no captain action needed.
- DONE: Write a complete Goal section reflecting "analysis report only, no migration, starting with 2024."
  One sentence naming the private delivery, the no-write constraint, and the glide-path output.
- DONE: Write 2-4 User Stories.
  Four stories: the comparison, the labelled reasons, the glide path checked against the captain's existing projection, and knowing what stayed unprocessed.
- DONE: Write Acceptance Criteria.
  Twelve. AC-1/2/3 fix how the sheet is read and reconciled, AC-6/7/9 fix the report's required contents, AC-10 fixes delivery, AC-8 fixes scope honesty for other years. AC-11 and AC-12 hold the no-leak and no-write lines.
- DONE: Write Edge Cases.
  Eleven, drawn from the actual inspected structure rather than guessed: interleaved aggregate rows, rental-property pass-through flows, duplicate files per year, template files, the 2023/2025 gaps, blank months, uncategorised rows, second-account ownership, the oversized daily table, and formatted-value parsing.
- DONE: Write Out of Scope.
  Restates the three required exclusions verbatim in intent — no writes to the app's sheets, no new app UI, no automated enforcement — plus multi-currency, no Categories-tab changes, not all 18 years, and no financial advice.
- DONE: Self-check every AC is binary/testable before finishing.
  Each AC resolves to a count, an equality, a presence check, or a named-value classification. AC-2 has an explicit failure signature (a roughly doubled total means aggregate rows were summed). AC-10 depends on the captain opening the delivered report, which is the gate check itself.

### Summary

Access turned out to be the easy question and delivery the hard one. Both sources read fine on the captain's own account, so the ideation's access blocker is closed and the spec is grounded in the real structure: a 19-column annual matrix with aggregate rows interleaved among the data, a two-level 25-bucket taxonomy that does not match the app's flat categories, 18 archived years with duplicate and template files scattered among them, and no 2023 or 2025 record at all.

The finding that shapes the spec most is that this repository is public and its PII pre-commit hook only catches phone numbers and email addresses. A report of real income and spending committed here would be exposed and nothing would stop it, so the natural "markdown file in the repo" answer is wrong. The spec proposes a private Google Doc in the captain's own archive folder instead, and raises it as Decision 1 for the captain rather than settling it unilaterally.

Two more decisions are surfaced rather than assumed: scope is 2024 plus one baseline year plus an inventory, not all 18 years; and 2024 serves as the "now" anchor because it is the most recent complete year, since 2023 and 2025 are absent and the app's own sheet covers only part of the current year.
