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

Analyze past expense records — starting with a 2024 Google Sheet, with more records going back to 2006 in varying formats — not to migrate every row into the app, but to understand spending patterns well enough to answer one question: in the past the captain could live on less than NT$1.2M/year, and today needs more — why, and what would it take to bring that back down gradually (not by next year — slowly, over time)?

Reference sheet (2024, first data source): https://docs.google.com/spreadsheets/d/1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I/edit?gid=1209807047#gid=1209807047

Full historical archive (all years, captain's Google Drive folder): https://drive.google.com/drive/u/0/folders/0B7ijxIFRP1RQTy1rWHpDZldlcVU?resourcekey=0-LI4sE0FkVp7AFab9AV7gqg — this is where every year's record lives; the 2024 sheet above is the first one to actually work through.

## User Stories

- As the captain, I want to see how my past spending (2024, and eventually further back to 2006) breaks down by category, so I can compare it to today's spending and see where the difference actually is.
- As the captain, I want to understand *why* I used to spend less — which categories grew, which habits changed, what's new now that wasn't there before — not just see a total number.
- As the captain, I want a realistic, gradual path back toward ~NT$1.2M/year, not a crash-diet plan for next year, so the target is something I can actually work toward.

## Success

- 2024's historical data is pulled from the linked sheet and understood well enough to categorize spending (even if the categories don't map 1:1 to the app's current Categories tab).
- A clear comparison exists between "what I spent then" and "what I spend now" by category, surfacing the biggest gaps.
- A written-out, honest set of candidate reasons for the increase (e.g. specific categories, one-time vs. recurring changes, inflation vs. lifestyle change) — not just a number.
- Some form of gradual target/pacing the captain can track against over time (exact mechanism — dashboard, report, manual check-in — TBD at spec time).

### Out of Scope (decide at spec time)

- Migrating every historical row into the live app's Expenses/Subscriptions sheets. The goal is analysis and insight, not a complete data migration — years before 2024 may never be individually imported.
- Any records earlier than 2024 for this first pass — those come later once the 2024 approach is proven, and each year may need its own format handling since none of the older records share a consistent format.
- Automating the reduction itself (budgets, alerts, spending caps) — this entity is about understanding and a target, not enforcement.
- Multi-currency handling, if older records turn out to be in anything other than the currency the app already assumes.

## Plan

To be filled in at spec time — open questions this needs to resolve before/during spec:

- **Sheet/folder access.** This is a personal Google Sheet and Drive folder, not the app's existing spreadsheet-as-database. Does the existing service account have access, or does the captain need to share the sheet (and eventually the folder) first (same blocker pattern as entity 042)?
- **Format discovery.** What does the 2024 sheet's structure actually look like (columns, categories, granularity) before assuming anything about how to parse it or later years.
- **Where the analysis lives.** A one-off script + written report, a new page/view in the app, or something else — not yet decided, and probably shouldn't be decided until the 2024 data has actually been looked at.
- **How "reduce gradually" becomes trackable** — e.g. a rolling year-over-year comparison, a target line in Reports — without turning this into a budgeting-enforcement feature (explicitly out of scope above).
