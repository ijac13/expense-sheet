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
