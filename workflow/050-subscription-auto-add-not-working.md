---
id: 050
title: Subscriptions Never Auto-Generate Expense Entries on Due Date
status: build
source: captain (found checking expense history for recurring entries)
started: 2026-08-17T08:21:20Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-050-subscription-auto-add-not-working
issue:
pr:
---

Recurring subscriptions are supposed to automatically create a matching expense entry on their due date — that's the entire point of `apps-script/subscription-scheduler.gs`. Checked production directly: of 1,962 expense rows, none carry the id format (`Utilities.getUuid()`) that script would produce. Zero evidence it has ever run, despite 21 active subscriptions with due dates that should have fired repeatedly across the months of real data in the sheet. The script is a Google Apps Script meant to run on its own daily trigger set up manually inside the Google Sheet's Apps Script editor — a one-time setup step separate from the app's own deploy pipeline, and the evidence says it was never done.

## User Stories

- As the captain, I want a subscription's payment to automatically appear in my expense history on its due date, so I don't have to remember to log recurring expenses by hand.
- As the captain, I want to trust that once this is set up, it keeps working without me checking on it — this failed silently for months before anyone noticed.

## Success

- Every active subscription generates a real expense entry, automatically, on its actual due date — verified live, not just read from code.
- The generated entry matches the current Expenses schema exactly (the existing script sets a `status` field that doesn't exist in the sheet at all — a sign it's drifted from the real schema).
- Whatever mechanism ends up running this is actually confirmed running, not just installed — this bug was invisible for months precisely because nobody could tell from the app itself whether it was working.

### Out of Scope

- Changing subscription create/edit/delete itself — already built and working
- Backfilling expense entries for due dates that were already missed historically

## Plan

Open question for spec: keep this as a Google Apps Script (needs manual one-time setup entirely inside Google's UI, outside this repo's deploy pipeline and outside anything this workflow can verify or redeploy) — or move the logic into a scheduled Firebase Function (deploys and verifies the same way as everything else built this session, no separate manual Google-side setup step to silently skip). That choice should get made explicitly, not defaulted into.

Whichever mechanism is chosen, align it to the current Expenses schema (drop the `status` field the existing script writes, which doesn't exist) and to entity 047's header-based column resolution rather than reintroducing positional writes.

## Spec

### Goal

Generate a real expense entry automatically on each active subscription's due date, from a scheduled Firebase Function that deploys and is verified the same way as everything else in this repo — and make "is it actually running?" answerable from the app itself.

### Decision: scheduled Firebase Function, not Apps Script

**Chosen: a `onSchedule` v2 Firebase Function. The Apps Script is deleted.**

The open question assumed the Apps Script merely needed its trigger installed. Tracing the live sheet shows that is false — **installing the trigger would still have produced zero expense entries**, for two independent reasons:

1. **The active-subscription filter never matches.** `subscription-scheduler.gs:33` reads `if (row[col('is_active')] !== true) continue;` — a strict comparison against the boolean `true`. Every `is_active` cell in the live Subscriptions tab is the *string* `"true"` (confirmed via the Sheets API with both `UNFORMATTED_VALUE` and `FORMULA` render options: 21 × `string:"true"`, 10 × `string:"false"` — a genuine boolean would deserialize as JSON `true`). `"true" !== true`, so the loop `continue`s on all 31 rows. The deployed API gets this right (`is_active !== "false"`, `functions/src/index.ts:117`); the Apps Script never did.
2. **Two of the fields it writes have no column.** It sets `status` and `subscription_id` (`subscription-scheduler.gs:50-51`); the live Expenses header has neither, and its own `set()` helper silently drops any name it cannot find. The script has drifted from the schema because nothing in the repo ever exercises it.

So the Apps Script is not a working mechanism missing a trigger — it is dead code with two bugs and no test, and its "fix" would still live behind a manual, unverifiable, one-time click inside Google's UI. Beyond that:

| | Apps Script | Scheduled Firebase Function |
|---|---|---|
| Deploy | Manual paste + trigger setup in Google's UI. `SETUP.md:212` marks it **"(optional)"** — which is exactly why it was skipped, and nothing in the repo could detect the skip. | `firebase deploy --only functions --project production` — the command the `done` stage already mandates. |
| Verifiable in `verify` | No. There is no staging Apps Script project, so the workflow's Live Evidence Requirement (staging HTTP call or observed staging behaviour) cannot be met. | Yes. Deploys to `expense-sheet-staging` against the staging spreadsheet; a live run is a real HTTP-observable result. |
| Schema safety | Positional/name lookups with silent drops. | Reuses entity 047's `buildColumnMap`/`buildWriteRow`, so a renamed column is a loud `SheetSchemaError`, never a wrong-column write. |
| Dependency cost | — | None. `firebase-functions@6.6.0` already ships `v2/providers/scheduler` with a `timeZone` option. |
| Runtime cost | — | 1 Cloud Scheduler job (free tier is 3 per billing account) + ~30 invocations/month. Negligible against `billing-guardrails/`. |

Deploy prerequisite to flag: the Cloud Scheduler API must be enabled on both projects; `firebase deploy` enables it on first scheduled-function deploy.

### Live schema, traced 2026-08-17 (post-047, production `expense-sheet-prod`)

**Expenses** — 1,967 data rows, header width **10**:

`id | date | amount | category_id | paid_by | created_by | notes | created_at | month | amount value`

- **No `subscription_id` column. No `status` column.** Both fields the old script writes are fabrications.
- `month` (col I) and `amount value` (col J) are static helper values, not formulas, and are unknown to `EXPENSES_SPEC`. They are inconsistently filled: 268 `exp-` rows filled, 51 `exp-` rows blank, all 1,648 legacy rows blank. Today's `POST /api` leaves them blank (`buildWriteRow` pads to header width). **The scheduler must do the same** — matching the app's own behaviour, not guessing at a captain-maintained helper column.
- id shapes: 319 `exp-<ms>` (app-created), 1,648 legacy imports, **0 UUIDs** — independently confirming the Apps Script has never run.
- `date` is `YYYY-MM-DD` text in all 1,967 rows; `amount` and `created_at` are text.

**Subscriptions** — 31 data rows, header width **9**, exactly matching `SUBSCRIPTIONS_SPEC`:

`id | name | amount | category_id | frequency | due_day | due_month | paid_by | is_active`

- 21 active / 10 cancelled; 25 `monthly` / 6 `annual`; every value is a **string** (`due_day` included).
- `due_day` currently spans 1–30; `due_month` is blank for monthly, one of 5/6/12 for annual; `paid_by` is `"ijac"` on every row.
- Live cross-check: `GET https://expense-sheet-b2db8.web.app/api/subscriptions` → 200, 31 records, 21 with `is_active: true`.

**Spreadsheet timezone is `Asia/Taipei`** (UTC+8, no DST). A Firebase Function defaults to UTC, so "today" must be computed in Asia/Taipei or the entry lands on the wrong calendar day for 8 hours out of every 24.

### User Stories

- As the captain, I want each active subscription to add its own expense entry on its due date, so my history is complete without me remembering to log recurring payments.
- As the captain, I want to open the Subscriptions screen and see when auto-add last ran, so a silent stoppage is visible in days rather than months.
- As the captain, I want a re-run or retry to never duplicate an entry, so I can trigger it manually without fear of corrupting my history.

### Acceptance Criteria

- [ ] **AC-1 — Mechanism.** A scheduled function `subscriptionScheduler` exists under `functions/src/`, declared with `onSchedule` from `firebase-functions/v2/scheduler`, schedule `0 1 * * *`, `timeZone: "Asia/Taipei"`. `apps-script/subscription-scheduler.gs` is deleted and `SETUP.md` Step 8 no longer instructs a manual Apps Script trigger.
- [ ] **AC-2 — Active filter matches the API, not the old script.** Subscription selection uses `rowToSubscription`, so "active" is `is_active !== "false"`. A unit test asserts a row whose `is_active` cell is the **string** `"true"` IS selected; the test fails if the code compares against a boolean. (This is the bug that made the old script a no-op.)
- [ ] **AC-3 — Monthly due match.** A monthly subscription fires only when the Asia/Taipei day-of-month equals `min(due_day, days_in_current_month)`. Tests: `due_day: 15` fires on the 15th and not on the 14th or 16th; `due_day: 31` fires on 2026-02-28 and on 2026-04-30.
- [ ] **AC-4 — Annual due match.** An annual subscription fires only when the Asia/Taipei month equals `due_month` AND the day equals the clamped `due_day`. Test: `due_month: 6, due_day: 5` fires on 2026-06-05 and on no other date in 2026.
- [ ] **AC-5 — Row matches the live schema exactly.** The row is produced by `buildWriteRow` against the Expenses header map and sets only `id, date, amount, category_id, paid_by, created_by, notes, created_at` — `notes` is the subscription `name`, `created_by` is the subscription `paid_by`, `date` is the due date in Asia/Taipei. A test asserts the update object passed to `buildWriteRow` contains neither `status` nor `subscription_id`.
- [ ] **AC-6 — Helper columns preserved blank.** The written row's length equals the live header width (10 today) with indices 8 and 9 (`month`, `amount value`) as `""` — byte-identical in shape to what `POST /api` writes. Test asserts row length and both blanks; it fails if the row is built to a hardcoded 8 columns.
- [ ] **AC-7 — Deterministic id makes re-runs idempotent.** The generated id is `exp-auto-{subscription_id}-{YYYY-MM-DD}` (e.g. `exp-auto-sub-1778290646682-2026-08-17`). Before writing, the function reads the Expenses id column and skips any id already present. Test: invoke the handler twice for the same date against a stubbed sheet — exactly one append occurs, and the second run reports `created_count: 0, skipped_count: 1`.
- [ ] **AC-8 — Heartbeat on every run, including zero-due days.** Each run appends one row to a `SchedulerLog` tab: `run_at, due_count, created_count, skipped_count, error`. The function creates the tab and its header row if absent, so no manual sheet edit is ever required. Test: a run with zero due subscriptions still produces exactly one `SchedulerLog` append.
- [ ] **AC-9 — Failures are recorded, never silent.** If reading or writing the sheet throws, the run still appends a `SchedulerLog` row with a non-empty `error`, then rethrows so Cloud Scheduler records the invocation as failed. Test: stub a write rejection and assert a `SchedulerLog` row with `error` populated and that the handler rejects.
- [ ] **AC-10 — Status endpoint.** `GET /api/scheduler-status` returns 200 with `{ last_run_at, due_count, created_count, skipped_count, error, stale }` taken from the newest `SchedulerLog` row. `stale` is `true` when `last_run_at` is more than 36 hours old or when no run has ever been recorded.
- [ ] **AC-11 — Captain-visible indicator.** The Subscriptions screen renders one line under the title showing when auto-add last ran. When `stale` is `true` it uses the warning style and states that auto-add has not run. Strings exist in both `app/public/locales/en/common.json` and `.../zh/common.json`.
- [ ] **AC-12 — LIVE demonstration on staging (verify stage).** With the function deployed to `expense-sheet-staging`, a staging subscription whose due date is set to today produces a real expense row in one triggered run. Evidence required, all three: (a) the manual trigger command and its output (`gcloud scheduler jobs run …`), (b) an HTTP response from staging `GET /api/` showing the new row with an `exp-auto-…` id, (c) staging `GET /api/scheduler-status` showing `last_run_at` within minutes and `created_count >= 1`. Code inspection is not evidence for this AC.
- [ ] **AC-13 — LIVE confirmation on production (done stage).** After `firebase deploy --only functions,hosting --project production`, production `GET /api/scheduler-status` returns a `last_run_at` from a real invocation with `stale: false`, recorded in this entity body per the workflow's done-stage rule.

### Edge Cases

- **`due_day` past the end of a short month** — clamped to the last day, so a `due_day: 31` subscription fires once on Feb 28 (2026, non-leap), Apr 30, etc. Never skipped, never doubled.
- **Leap years** — `due_day: 29` in February clamps to the 28th in 2026 and fires on the 29th in a leap year. Same clamp, no special case.
- **Two runs on the same day** (Cloud Scheduler retry, or a manual trigger) — the deterministic id makes the second run a no-op with zero writes.
- **Partial failure mid-run** (e.g. 5 of 21 written, then a Sheets 503) — the written rows already hold their final ids, so a same-day retry creates only the missing ones. A retry on a *later* day does not backfill the missed date; that matches the entity's no-historical-backfill scope and shows up as a gap in `SchedulerLog`.
- **Cancelled on its due day** — cancelled before the run: no entry. Cancelled after the run: the entry stays, which is correct — it was due and paid.
- **Created today with `due_day` = today** — fires on today's run if the run has not yet happened; otherwise it first fires next period. No backfill.
- **Category archived or deleted** — the entry is still written with that `category_id`; the Subscriptions and History screens already resolve archived categories.
- **Expenses header renamed or reordered** — `buildColumnMap` throws `SheetSchemaError`; the run logs it to `SchedulerLog` and fails loudly rather than writing into the wrong column.
- **`SchedulerLog` tab deleted by the captain** — recreated with its header on the next run.
- **Timezone** — Asia/Taipei has no DST, so the 01:00 daily trigger never skips or repeats an hour.
- **`SchedulerLog` growth** — ~365 rows/year, appended, no pruning needed.

### Out of Scope

- Backfilling expense entries for due dates already missed historically (carried from the entity's own scope).
- Changing subscription create/edit/delete (carried from the entity's own scope).
- Adding a `subscription_id` column to the Expenses tab — the deterministic id in AC-7 carries the link with no manual sheet edit, and a manual Google-side step is the exact failure class this entity exists to remove.
- Push or email notification when an entry is generated; the indicator in AC-11 is the whole notification surface.
- New frequencies (weekly, quarterly), proration, or variable amounts — the sheet only models `monthly` and `annual`.
- Populating the `month` / `amount value` helper columns; AC-6 deliberately leaves them blank, matching `POST /api`.
- Multi-currency handling (entity 009).

## Stage Report: spec

- DONE: Decide Apps Script vs. scheduled Firebase Function with a real justification (deployability, verifiability, and this repo's established pattern of everything else being a Firebase Function) — this is the entity's central open question, don't default into it silently
  Chose the scheduled Firebase Function; see "Decision" section. The justification is not a preference — live probing proved the Apps Script would have created zero entries even with its trigger installed (`gs:33` compares `is_active` against boolean `true`, but every live cell is the string `"true"`), plus a comparison table on deploy path, `verify`-stage evidence, schema safety, and cost.
- DONE: Trace the actual current Subscriptions and Expenses schemas live (post-047) before writing ACs, including which fields genuinely exist vs. the existing script's stale status field
  Read production `expense-sheet-prod` via the Sheets API (read-only scope, no writes). Expenses is 10 wide with no `status` and no `subscription_id`, plus two unmapped helper columns `month`/`amount value`; Subscriptions is 9 wide, all-string values, 21 of 31 active. Cross-checked against `GET /api/subscriptions` (200, 31 records, 21 active).
- DONE: Acceptance criteria include a live demonstration that a due subscription actually generates a real expense entry — not just that the trigger/schedule exists, since that's exactly the kind of thing that silently failed for months undetected
  AC-12 requires three separate live artifacts from staging (trigger command output, an HTTP response showing the new `exp-auto-…` row, and `scheduler-status` with `created_count >= 1`) and explicitly rules out code inspection. AC-13 repeats the confirmation on production at the `done` gate.

### Summary

Traced both schemas live rather than trusting the code, which turned the entity's open question from a judgment call into a settled one: the Apps Script has two independent bugs (a boolean-vs-string active check that skips every row, and two written fields with no matching column), so "install the missing trigger" was never a viable fix. The spec therefore replaces it with an `onSchedule` Firebase Function on `firebase-functions@6.6.0` — already present, no new dependency — pinned to `Asia/Taipei` because the spreadsheet is UTC+8 and a UTC "today" would misdate entries for a third of each day. Two design choices are worth the captain's attention at the gate: a deterministic expense id (`exp-auto-{sub_id}-{date}`) gives idempotency and a subscription link without adding a column to the sheet by hand, and a `SchedulerLog` heartbeat plus a line on the Subscriptions screen answers "is it running?" from the app, which is what made this invisible for months.
