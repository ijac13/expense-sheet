---
id: 065
title: Backfill 3 Recurring Expenses for Feb–Aug 2026
status: build
source: captain
started: 2026-09-08T00:24:43Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-065-backfill-recurring-expenses-feb-aug-2026
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:065:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:065-ideation-1
              briefing:
                id: briefing:065:ideation:attempt-1:revision-1
                digest: sha256:df1d0c41ed5b3e4063400402326dfb847959e15dcca77f4761fa9e802b97c7e1
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:065:ideation:1
                briefing: briefing:065:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-08T00:24:26.40467Z"
                decision: approve
                reason: Scope, success criteria, and open questions for spec are clear and correctly bounded to Feb-Aug 2026; ready to move to spec.
              application:
                target-stage: spec
                state: consumed
        - id: gate:065:spec
          stage: spec
          attempts:
            - id: gate-attempt:065-spec-1
              briefing:
                id: briefing:065:spec:attempt-1:revision-1
                digest: sha256:638d7e37542642c21436421230f506edad3cee3fbc37164374d7a4ac11fc2245
                room-ref: ./review/spec/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:065:spec:1
                briefing: briefing:065:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-09-08T03:20:37.450948Z"
                decision: approve
                reason: Investigation corrected the ideation's own premise with live evidence and caught a real double-count hazard (Uber/Feb) and a paid_by discrepancy; the 11 ACs and id-namespace design are sound. Ready for build.
              application:
                target-stage: build
                state: consumed
---

The captain just set up 3 real recurring costs as app Subscriptions with a start date of 2026-09-07, but each was already being paid before that date — so February through August 2026 have no record of them, and those months' totals understate what she actually spent.

## User Stories

- As the captain, I want these 3 recurring expenses backfilled for each month from February through August 2026, so those months' totals and category breakdowns reflect costs I was actually paying before I started tracking them as subscriptions.
- As the captain, I want September 2026 onward left untouched, since the Subscriptions feature (start date 2026-09-07) already owns those months going forward.
- As the captain, I want the same reviewable safety this app's other historical backfills use, since this touches live expense records.

## Success

- Each of the 3 expenses below gets one row per month for February through August 2026 (7 months × 3 expenses = 21 rows), matching the amount/category/payer of the captain's own subscription setup:

  | reference id (subscription-generated, 2026-09-07) | amount | category | paid_by | created_by | notes |
  |---|---|---|---|---|---|
  | exp-1788759233590 | 2105 | cat_024 | wei | wei | 勞保 |
  | exp-1788759216521 | 2745 | cat_024 | wei | wei | 三人健保 |
  | exp-1788759176279 | 150 | cat_006 | wei | wei | (none) |

- September 2026 onward is left alone — this entity does not duplicate or interfere with the live Subscriptions mechanism.
- No pre-existing row altered or lost, proven by a before/after check.

### Out of Scope

- Any month before February 2026 for these 3 expenses.
- Any change to the Subscriptions feature itself, its start date, or its future behavior.
- Any other subscription/recurring expense not named above.

## Plan

To be filled in at spec time. Open questions for spec:

- All 3 captain-supplied reference rows carry `date: 2026-01-01` despite being created 2026-09-07 — understand how the Subscriptions feature actually computes/stores its occurrence date and id before designing the backfill, so the 7 new months' rows are shaped the way the live feature itself would have produced them, not a guess.
- Confirm `cat_024` and `cat_006`'s category names against the live Categories tab/app data.
- Confirm which day-of-month to use for each backfilled row (all 3 reference rows show the 1st — confirm whether that is meaningful to the Subscriptions feature or an artifact of the reference data given).
- Confirm this is a direct app-data backfill (writing via the app's own data path/API, matching whatever the Subscriptions feature itself writes), not a spreadsheet-import backfill like `060`–`064` — the source here is the captain's own subscription config, not an external spreadsheet.
- id scheme for the 21 new rows, avoiding collision with existing `exp-` ids — subscription-generated ids look like `exp-{timestamp}`, not the `exp-hist-...` prefix `060`–`064` use, so the collision-safety approach those entities established may not directly apply.

### Resolved at spec — verified against live production data and the current code, not carried forward from the ideation's assumptions

Every claim below was obtained this stage: a read-only probe of the live production Categories, Subscriptions, and Expenses tabs (credentials from `functions/.env` / `.env.local`, `spreadsheets.readonly` scope), and a direct reading of `functions/lib/index.js`, `functions/lib/scheduler.js`, and `functions/scripts/backfill-subscription-history.js` (entity `051`) as they exist today.

**Occurrence date/id — RESOLVED: the ideation's premise was wrong. Subscriptions itself never writes an expense row; the 3 reference rows are ordinary manual entries, and `2026-01-01` is not a computed occurrence date.** Tracing `POST /api/subscriptions` (`functions/lib/index.js:361-396`) end to end: it mints `id = \`sub-${Date.now()}\`` and writes one row to the *Subscriptions* tab only — no code path there ever touches Expenses. The id shape `exp-{timestamp}` the ideation labeled "subscription-generated" is in fact `POST /api`'s generic add-expense handler (`functions/lib/index.js:693`, `id = \`exp-${Date.now()}\``), the same endpoint every manual expense entry uses. Decoding the 3 reference ids as epoch-ms confirms this: `exp-1788759233590` / `exp-1788759216521` / `exp-1788759176279` were all created 2026-09-07 between 05:32:56 and 05:33:53 UTC (13:32–13:33 Taipei) — one captain session, three manual entries — and each carries `date: 2026-01-01` simply because that is whatever the date field held when she typed them in; nothing in the code computes or defaults to that date. **The only code that ever computes a subscription-driven occurrence date or id is the live scheduler**, `autoExpenseId(subscriptionId, isoDate) → \`exp-auto-${subscriptionId}-${isoDate}\`` (`functions/lib/scheduler.js:66-68`), called from `runSubscriptionScheduler` (daily, 01:00 Asia/Taipei) and reused unmodified by entity `051`'s direct-write backfill script. `isDueOn` (`scheduler.js:57-63`) checks only `due_day`/`due_month` against today — never `start_date` — so a subscription created after this month's due day has already passed will not fire again until the following month's due day.

**Category names — RESOLVED, live.** Production Categories tab: `cat_024` → `name_en: Insurance`, `name_zh: 保險`, `is_active: true`. `cat_006` → `name_en: Transportation`, `name_zh: 交通`, `is_active: TRUE`. (Matches `054`'s and `061`'s prior audits; re-confirmed live rather than carried forward, per this workflow's own discipline.)

**Day-of-month — RESOLVED: the 1st is meaningful, not a reference-data artifact.** Live read of the Subscriptions tab found all 3 real subscriptions with `due_day: 1`, `frequency: monthly`, `start_date: 2026-09-07`, `is_active: true`: `sub-1788758970594` ("Wei 勞保", 2105, `cat_024`), `sub-1788758990082` ("健保 wei, Alisa, libi", 2745, `cat_024`), `sub-1788759015607` ("Uber 公會會費", 150, `cat_006`). The 1st of each month is each subscription's actual configured due day — exactly the day the live scheduler itself would use (`isDueOn`'s day-31 clamp is irrelevant here; day 1 always exists).

**Direct app-data write — RESOLVED: yes, matching entity `051`'s established precedent, not a spreadsheet import.** `051`'s `functions/scripts/backfill-subscription-history.js` is exactly this shape already built and proven: it imports `isDueOn`/`daysInMonth`/`autoExpenseId` from the compiled scheduler (so occurrence and id logic cannot drift from the live feature), and writes rows via the same `buildWriteRow` + `insertRowsAtTop` all-or-nothing batch the scheduler itself uses. This entity reuses those primitives directly against the live Google Sheet (readonly-then-write credential scoping, explicit `--target`), never touching a spreadsheet-import pipeline like `060`–`064`.

**Found rather than assumed — a 4th manual row from the same session already covers one of the 21 candidate months.** `exp-1788759250129` (date `2026-02-01`, amount `150`, `category_id: cat_006`, `paid_by: wei`, `created_by: wei`, notes blank, `created_at: 2026-09-07T05:34:10.129Z`) was created 17 seconds after the Uber reference row, in the same session, and is otherwise indistinguishable from what this backfill would generate for Uber × February 2026. A live scan of the full Feb–Aug 2026 window for all three amounts (2105, 2745, 150) under any category found this is the **only** such collision — no row anywhere in that window carries 2105 or 2745, and no other 150-amount row in the window matches both `cat_006` and the 1st-of-month date. An unconditional "3 subscriptions × 7 months = 21 new rows" plan would double-count Uber's February.

**Found rather than assumed — the subscriptions' own `paid_by` disagrees with the reference rows.** The live Subscriptions tab resolves `paid_by: ijac` for all 3 records (who administratively created them), while all 3 reference expense rows — and the approved ideation's own success table — carry `paid_by: wei`, `created_by: wei` (who actually pays). This entity's backfilled rows follow the ideation-approved figures and the reference rows, not the Subscriptions tab's `paid_by`, since the latter reflects who configured the subscription rather than who pays the bill.

**Id scheme — DECIDED.** New rows mint `exp-sub065-{subscriptionId}-{isoDate}` (e.g. `exp-sub065-1788758970594-2026-02-01`) — deterministic (subscription + date, so a retry recomputes the same id and is recognized as already-written), and disjoint by construction from all three existing families confirmed live on production (4,749 total Expenses rows at investigation time): `exp-hist-{year}-{NNNN}` / `exp-hist-mortgage-{year}-{NNNN}` (2,548 rows, `060`–`064`'s spreadsheet-import migrations), `exp-auto-{subscriptionId}-{isoDate}` (164 rows — the live scheduler's own format, including whatever it will mint for these same 3 subscriptions from 2026-10-01 onward), and plain `exp-{timestamp}` (the generic manual-entry format the reference rows themselves use). Choosing a prefix distinct from `exp-hist-` (rather than extending it, e.g. `exp-hist-sub065-`) keeps this entity's provenance — a subscription-config backfill — visibly separate from `060`–`064`'s spreadsheet-import provenance, so a future audit or undo never has to disambiguate the two by anything other than the id itself.

## Spec

### Goal

Backfill the 3 real recurring expenses (Wei 勞保 2105/`cat_024`, 三人健保 2745/`cat_024`, Uber 公會會費 150/`cat_006`) for February–August 2026 — the months paid before the captain's 2026-09-07 Subscriptions setup began covering them going forward — as a direct write to the live Expenses tab under a new, collision-free id namespace, recognizing the one month (Uber × February) a prior manual entry already covers.

### User Stories

- As the captain, I want these 3 recurring expenses backfilled for each month from February through August 2026, so those months' totals and category breakdowns reflect costs I was actually paying before I started tracking them as subscriptions.
- As the captain, I want the backfill to notice that I already manually logged Uber's February payment, rather than writing a second one and doubling that month's transportation total.
- As the captain, I want September 2026 onward left untouched, since the Subscriptions feature (start date 2026-09-07) already owns those months going forward.
- As the captain, I want the same reviewable safety this app's other historical backfills use — staging rehearsed first, my approval before any production write, and a working, independently-scoped undo — since this touches live expense records.

### Edge Cases

- **A candidate (subscription, month) pair that a pre-existing row already represents exactly** — found live: Uber × 2026-02-01 already exists as `exp-1788759250129`. Must be recognized and skipped, not duplicated, and reported explicitly rather than silently.
- **The Subscriptions tab's `paid_by` (`ijac`) disagreeing with the reference expense rows' `paid_by` (`wei`)** — resolved by following the reference rows and the approved ideation table, not the live Subscriptions record, since the latter reflects who configured the subscription rather than who pays.
- **Running apply a second time, or after a partial mid-batch failure.** Ids are deterministic from (subscription, date), so a re-run must recognize every already-written id and skip it — no duplicate, no manual cleanup required.
- **Undo run any time after these rows are live.** Must remove only this run's own `exp-sub065-` ids (checked against a saved manifest, not a bare prefix scan) and leave every other row — the reference rows, `exp-1788759250129`, every `exp-hist-` and `exp-auto-` row, and unrelated `exp-{timestamp}` rows — untouched.
- **The live scheduler's first real fire for these 3 subscriptions, 2026-10-01 onward.** Must never collide with this backfill's ids (different namespace, by construction) and must never be affected by this backfill (no write to the Subscriptions tab).
- **A target's Categories tab where `cat_024`/`cat_006` do not resolve** (e.g. a staging rehearsal without those exact ids seeded). The run must refuse before writing anything, naming which category failed to resolve.

### Out of Scope

- Any month before February 2026 or after August 2026 for these 3 expenses.
- Any change to the Subscriptions feature itself, its start date, `due_day`, `is_active`, or any future behavior — including not correcting the Subscriptions tab's `paid_by: ijac` to `wei`.
- Any other subscription/recurring expense not named above.
- Altering or "fixing" the pre-existing `exp-1788759250129` row — it is left exactly as the captain entered it.

## Acceptance criteria

Verification split: **offline** — AC-1 through AC-9. **Interactive** — AC-10, AC-11. No harness is built to automate AC-10 or AC-11; both are judged on a live drive of the deployed app, per the pattern `051`/`060`–`064` already established.

**AC-1 — No pre-existing expense row is altered or deleted by this backfill, including the 3 reference rows and the pre-existing `exp-1788759250129` Uber/February row.**
Verified by: offline — a before/after snapshot diff (staging rehearsal seeded with production's real row shapes, and a live dry-run against production) reports 0 modified, 0 deleted among rows whose id does not begin `exp-sub065-`.
Falsified by: switching from row-insertion to an in-place `values.update`, or writing before checking existing coverage — a modified or deleted pre-existing row, including `exp-1788759250129` or a reference row, then shows in the diff.

**AC-2 — All 21 subscription-months across Feb–Aug 2026 end up represented exactly once: 20 new rows are written and the Uber × 2026-02-01 occurrence is recognized as already covered by `exp-1788759250129` and skipped, not duplicated.**
Verified by: offline — dry-run against production reports a plan of exactly 20 candidate rows, names the one skipped occurrence and the existing id it matches; `--apply`'s output confirms `created: 20, skipped: 1`.
Falsified by: a dedup rule that checks only the new-scheme id (never previously written) instead of (date, amount, category_id, paid_by) against all existing rows — the Uber/February candidate is then not recognized as covered, a duplicate 150/`cat_006` row is written for 2026-02-01, and that month's transportation total is double-counted.

**AC-3 — Each new row carries the correct amount, category_id, date (the 1st of its month), paid_by, created_by, and notes for its subscription, matching the approved ideation table and the live reference rows exactly: 7 rows at 2105/`cat_024`/wei/wei/"勞保" (Feb–Aug), 7 rows at 2745/`cat_024`/wei/wei/"三人健保" (Feb–Aug), 6 rows at 150/`cat_006`/wei/wei/"" (Mar–Aug, Feb already covered).**
Verified by: offline — a unit test against the 3 known subscription ids asserts this exact 20-row set (values, not counts alone); a live dry-run diffs the same set against production.
Falsified by: reading amount/category_id from the Subscriptions tab's *current* live values at run time instead of the ideation-pinned figures — if the captain edits a subscription's amount after this backfill ships, a later re-run keyed to "current subscription state" would silently write a different, wrong historical figure for Feb–Aug.

**AC-4 — New row ids are minted under a dedicated namespace, `exp-sub065-{subscriptionId}-{isoDate}`, disjoint by construction from the `exp-hist-` prefix family (`060`–`064`), the live scheduler's own `exp-auto-{subscriptionId}-{isoDate}` ids (including any it mints for these same 3 subscriptions from 2026-10-01 onward), and plain `exp-{timestamp}` manual-entry ids.**
Verified by: offline — a unit test asserts the three existing families and the new prefix are pairwise disjoint by pattern; a live read of production's full Expenses tab (4,749 rows at investigation time) confirms zero existing id matches the new prefix.
Falsified by: reusing `exp-auto-` for these rows (byte-identical to what the live scheduler would mint) — the live scheduler's first real October fire for these subscriptions would then either silently no-op against an id it thinks it already wrote, or become indistinguishable from this run's own rows in an audit or undo.

**AC-5 — Undo removes only this run's own written ids (from its own saved manifest, cross-checked against the `exp-sub065-` prefix) and leaves every other row — reference rows, `exp-1788759250129`, every `exp-hist-` and `exp-auto-` row, and unrelated `exp-{timestamp}` rows — byte-identical.**
Verified by: offline, on staging seeded with decoy rows under each of the other three id shapes — apply, undo, diff shows only this run's own ids removed and every decoy survives.
Falsified by: scoping undo to a bare prefix match with no manifest cross-check — any future row that happens to start with `exp-sub065-` (a coincidence or a re-run of this same script for a different window) would then also be deleted.

**AC-6 — The backfill never writes to the Subscriptions tab, and the candidate-date window is fixed to 2026-02-01..2026-08-31 by construction, never derived from the current date.**
Verified by: offline — a unit test asserts the write target is Expenses only, and that the generated candidate set is identical regardless of what `now` the script is run with.
Falsified by: deriving the window from `taipeiDate(now)` the way the live scheduler and `051` do (relative to "today") — a run any month after August 2026 would then silently propose September-onward dates too, or a run before February would omit some.

**AC-7 — Before any row is written, `cat_024` and `cat_006` are confirmed live against the target's own Categories tab, and the run refuses if either is missing.**
Verified by: offline — a fixture missing one category id aborts the run with zero rows written; confirmed live today both ids resolve on production (`Insurance`/`cat_024`, `Transportation`/`cat_006`).
Falsified by: hardcoding the category names instead of resolving them live — a target where either id was ever renumbered would then write rows filed under a stale or wrong category silently.

**AC-8 — Running `--apply` a second time against the same target writes nothing further.**
Verified by: offline — a second `--apply` reports `created: 0`, all 20 candidates recognized as already-written.
Falsified by: any non-deterministic component in the id (e.g. a timestamp) — a re-run would then duplicate all 20 rows.

**AC-9 — The script refuses to run without an explicit `--target`, matching `060`–`064`'s established safety discipline.**
Verified by: offline — invocation without `--target` exits non-zero and writes nothing to either spreadsheet.
Falsified by: falling back to a default resolved spreadsheet id.

**AC-10 — Reports → Monthly, stepped through February–August 2026, shows each month's total and category breakdown increased by exactly this backfill's contribution over its pre-backfill total (2105+2745 in `cat_024` every month; +150 in `cat_006` every month except February, where the pre-existing row already counted it), and September 2026 onward is unchanged.**
Verified by: interactive — live drive on staging then production: record each month's total before, apply, re-check after; step to September and confirm it matches its pre-backfill value.
Falsified by: writing a row dated in the wrong month, or the dedup check failing to catch the Uber/February collision — the observed per-month delta then does not match the expected figure, or September's total moves.

**AC-11 — Everyday use is unaffected: adding a new expense still writes and appears in today's list, and nothing about the Subscriptions tab (`due_day`, `start_date`, `is_active`) changed for these 3 records, so the live scheduler's own October fire is unaffected.**
Verified by: interactive — live drive on staging: add and see an expense; separately, a live read of the Subscriptions tab after this backfill confirms all 3 records' `due_day`/`start_date`/`is_active` are byte-identical to the values captured at this spec stage.
Falsified by: a row wider than the Expenses header row — `buildColumnMap` throws and `GET /api` starts failing — or any write path in this entity touching the Subscriptions tab.

## Risk evidence

**Riskiest unverified mechanism this cycle: whether the 21 candidate (subscription, month) pairs already had partial coverage from the captain's own manual entry.** Exercised, not assumed: a live read of the full production Expenses tab for the Feb–Aug 2026 window, matched against each subscription's exact amount, found `exp-1788759250129` — created 17 seconds after the Uber reference row, in the same session — already representing Uber × February 2026. The other two subscriptions' amounts (2105, 2745) appear nowhere else in the window under any category, and no other 150-amount row in the window matches both `cat_006` and a 1st-of-month date. This is a real hazard an unconditional "3×7" write plan would hit silently, not a hypothetical one.

**Second, found rather than assumed: the ideation's premise about how Subscriptions "generates" a row was incorrect.** Tracing `POST /api/subscriptions` (`functions/lib/index.js:361-396`) shows it writes only to the Subscriptions tab; the 3 reference rows are ordinary manual entries via the generic add-expense endpoint (`functions/lib/index.js:693`). The only code that ever computes a subscription-driven expense id/date is the live scheduler's `autoExpenseId` (`functions/lib/scheduler.js:66-68`), which mints `exp-auto-{subscriptionId}-{isoDate}` — a live-read of production found 164 such rows already, for other subscriptions, and zero yet for these 3 (their first eligible fire is 2026-10-01, since `due_day: 1` and `start_date: 2026-09-07` means September's 1st had already passed when they were created). Designing this backfill's id scheme against the wrong assumed format (`exp-{timestamp}`) rather than the real live one (`exp-auto-...`) would not have caused an immediate collision, but would have left the "distinct from what Subscriptions itself mints" requirement unmet against the mechanism that actually matters.

**Third, verified live rather than carried forward from `054`/`061`'s prior audits: category names and all 3 subscriptions' actual configuration.** `cat_024`/`cat_006` and each subscription's `amount`/`category_id`/`due_day`/`start_date`/`is_active` were re-read directly from production this stage, not assumed from either the ideation table or prior entities' notes — which is also how the `paid_by` discrepancy (subscription: `ijac`, reference rows: `wei`) was caught.

**No spike needed:** the write mechanism (`buildWriteRow` / `insertRowsAtTop` / all-or-nothing `batchUpdate`), the staging-first + explicit `--target` discipline, and the readonly-then-write credential scoping are already built and proven by entity `051` and the live scheduler; this entity reuses those primitives with a new id namespace and a narrow, fully-known 3-subscription/7-month scope — no cohort-classification or evidence-inference engine like `051`'s is needed, since these 3 subscriptions and their historical figures are already pinned by the approved ideation.

## Expected surface and tolerance

Estimate: **+180 net LOC across 3 files, tolerance ±50%** (90–270). Smaller than `051` (built a full analyze/report/hand-edit/apply pipeline for ambiguous, evidence-inferred subscriptions) and `064` (+320 estimated → shipped +819, 256%) because this entity's 3 subscriptions, amounts, and window are already fully known and pinned by the approved ideation — no classification engine, no hand-edited report phase. The band stays wide because `051`/`060`–`064` all substantially exceeded their own estimates, driven by falsification-style tests (AC-2's, AC-4's, and AC-6's falsifiers above are written the same way, on purpose).

- `functions/scripts/backfill-subscription-065.js` — new, ~110–160 LOC. Candidate generation (3 known subscriptions × 7 fixed months), the (date, amount, category_id, paid_by) dedup check against existing rows, the `exp-sub065-` id scheme, `--dry-run`/`--apply`/`--undo`, manifest write/read for scoped undo.
- `functions/test/backfill-subscription-065.test.js` — new, ~60–90 LOC. Covers AC-2 (dedup), AC-3 (row values), AC-4 (id disjointness), AC-6 (fixed window), AC-8 (idempotent re-run).
- `functions/scripts/fixtures/backfill-065-sample/` — new, ~10–20 LOC. Synthetic Subscriptions/Expenses fixtures including a decoy row shaped like `exp-1788759250129` (AC-2) and decoys under the other three id families (AC-4/AC-5).

Semantics this may change: **stored data only** — 20 new Expenses rows for Feb–Aug 2026, one occurrence recognized as already covered. No category created (`cat_024`/`cat_006` already exist — AC-7). No API shape change, no auth change, no scheduled-behavior change, no change to the Subscriptions tab, the live scheduler, or any `060`–`064`/`051` id scheme.

## Test plan

- **Unit, offline:** the 3-subscription/7-month candidate generator against a fixture reproducing the live data, including the Uber/February decoy row. Covers AC-2, AC-3, AC-6.
- **Falsification, offline:** an id-only dedup check (ignoring date/amount/category/payer) against the same fixture, asserted to miss the Uber/February collision and write a duplicate — committed as a permanent regression test, matching this workflow's own house style. Separately, a prefix-disjointness test against all three existing id families. Covers AC-2, AC-4.
- **Dry-run, offline:** against live production data, confirming the plan is exactly 20 rows with the 1 named skip, and zero id overlap with any existing row. Covers AC-2, AC-3, AC-4, AC-7, AC-9.
- **Apply + undo rehearsal on staging, offline:** snapshot → apply → verify → undo → diff, staging seeded with decoys under `exp-hist-`, `exp-auto-`, and plain `exp-{timestamp}` shapes to prove undo scoping. Covers AC-1, AC-5, AC-8.
- **Live drive, interactive:** deployed staging, then production after merge: Reports → Monthly stepped through Feb–Aug 2026 (and September re-checked unaffected), then add/see an expense and re-read the Subscriptions tab unchanged. Covers AC-10 and AC-11.
- **Cost:** unit, falsification, and dry-run steps run in seconds against a fixture or a single live read. The apply+undo rehearsal is the one expensive, must-not-skip step, since it is the only way to prove the undo-scoping property against realistic decoys before a production write.

### Feedback Cycles

## Stage Report: spec

- DONE: Investigate the actual Subscriptions feature code and live app data to resolve the ideation's open questions
  Traced `POST /api/subscriptions` and the generic add-expense handler in `functions/lib/index.js` and the scheduler's `autoExpenseId`/`isDueOn` in `functions/lib/scheduler.js`; live-read production Categories, Subscriptions, and Expenses tabs. Documented in the new "Resolved at spec" subsection under `## Plan`.
- DONE: Write `## Spec` (Goal, User Stories, Edge Cases, Out of Scope) per the Spec Template
  Added, including an Edge Case for the newly-found pre-existing Uber/February row and the paid_by discrepancy.
- DONE: Design a collision-safe id scheme for the 21 new rows distinct from exp-hist- and the live ids Subscriptions itself mints, with its own scoped undo
  `exp-sub065-{subscriptionId}-{isoDate}`, decided and justified in "Resolved at spec"; AC-4 and AC-5 cover disjointness and undo scoping.
- DONE: Write a top-level `## Acceptance criteria` section with Verified by/Falsified by clauses
  11 ACs (AC-1..AC-9 offline, AC-10..AC-11 interactive), added as a sibling of `## Spec`; `spacedock status --validate` and `status --read 065 --stage spec --ac-scan` both confirm all 11 are machine-readable. Found and worked around a scan gotcha: a literal `*` inside a backtick span (e.g. `` `exp-hist-*` ``) silently drops that AC from `--ac-scan`'s output — reproduced in isolation before fixing AC-4/AC-5's wording to say "the `exp-hist-` prefix family" instead.

### Summary

Live investigation overturned the ideation's premise: Subscriptions itself never writes an expense row (only `POST /api/subscriptions` → a `sub-` record); the 3 reference rows are ordinary manual entries, and the live scheduler's real occurrence-id format is `exp-auto-{subId}-{isoDate}`, not `exp-{timestamp}`. A live scan also found a 4th manual row, `exp-1788759250129`, already covering Uber's February 2026 occurrence — the spec's plan is 20 new rows plus 1 recognized skip, not a flat 21, with AC-2 covering the dedup rule that catches it. Id scheme decided: `exp-sub065-{subscriptionId}-{isoDate}`.

## Implementation Plan (build)

Reuses `051`'s proven write primitives (`buildColumnMap`/`buildWriteRow`/`insertRowsAtTop` from the compiled `lib/sheetSchema`) and `061`'s manifest/receipt discipline (`sync-staging-categories.js`'s apply-writes-a-receipt, undo-reads-it-and-cross-checks pattern) rather than either `051`'s report-editing pipeline (unneeded — the 3 subscriptions and their historical figures are already pinned) or `060`–`064`'s bare-prefix undo (spec requires manifest-backed, not prefix-only).

**Candidate generation.** Three subscriptions are hardcoded as data (subscriptionId, amount, category_id, `paid_by`/`created_by`: `wei`, notes) from the ideation-approved table and spec's live-verified subscription ids — never read from the live Subscriptions tab, so a future edit to a subscription's amount cannot silently change what this backfill writes (AC-3's falsifier). Seven fixed ISO dates (`2026-02-01` .. `2026-08-01`) are a literal array, not computed from `daysInMonth`/`isDueOn`/`now` — the window is the same 21 pairs regardless of run date (AC-6). `exp-sub065-{subscriptionId}-{isoDate}` is minted per pair (AC-4).

**Dedup check.** Before writing, read all existing Expenses rows live and build a Set of `date|amount|category_id|paid_by` keys. A candidate whose key is already present (this is how the pre-existing Uber/Feb row `exp-1788759250129` gets recognized and skipped) OR whose own `exp-sub065-` id is already present (this is what makes a second `--apply` a no-op, AC-8) is skipped and named in the output; every other candidate is written. Both checks read live state, not a manifest, so the dedup logic is correct standalone even before any manifest exists.

**Category resolution.** Before any write, read the Categories tab live and confirm both `cat_024` and `cat_006` resolve; abort naming the missing id(s) with zero writes if either does not (AC-7).

**Manifest-backed undo.** `--apply` writes a JSON manifest (gitignored, alongside 051's/061's report/receipt directories) recording every id it wrote plus the row's own fields, keyed to the target spreadsheet id and a run timestamp. `--undo` requires an explicit manifest path (or the default), refuses if it is missing, deletes only the ids the manifest lists that ALSO start with `exp-sub065-` (defense in depth — a manifest naming an id outside this run's own prefix is refused rather than deleted), and re-reads afterward to confirm every deleted id is gone and nothing else changed row-count.

**CLI surface.** `--target staging|production` (required, resolved via `migration-env.js`'s existing `resolveCredentialPairs` — a single pair only, since this entity, unlike `061`'s archive-import shape, reads and writes only the target's own Expenses/Categories/Subscriptions-adjacent tabs, never a second staging-only source); `--dry-run` (read-only, prints the plan, combinable with `--fixture` for offline testing); `--apply` (writes, requires real credentials, refuses `--fixture`); `--undo` (requires real credentials + manifest). Exactly one of `--dry-run`/`--apply`/`--undo`. No `--target` → refuse before any read (AC-9).

**Files:**
- `functions/scripts/backfill-subscription-065.js` — candidate generation, dedup, category-resolution guard, apply/dry-run/undo, manifest read/write, CLI.
- `functions/test/backfill-subscription-065.test.js` — unit tests against a fixture reproducing the live shapes (the Uber/Feb decoy row, decoy rows under `exp-hist-`/`exp-auto-`/plain `exp-{timestamp}` for AC-4/AC-5), covering AC-2/3/4/5/6/7/8/9 offline; a live dry-run (not automated) covers the rest of AC-1/AC-2's live-data claims per the spec's test plan.
- `functions/scripts/fixtures/backfill-065-sample/` — `Subscriptions.json`, `Expenses.json` fixtures for the above.

AC-10/AC-11 are interactive-only per the spec and are not exercised by this stage's automation; the stage report documents them as not self-checked, matching the spec's verification split.

## Stage Report: build

- DONE: Write a brief implementation plan before coding begins, covering the candidate-generation logic, the (date, amount, category_id, paid_by) dedup check, and the exp-sub065- id/manifest scheme.
  Written under "## Implementation Plan (build)" above, committed as 8ab1e9d before any code was written.
- DONE: Implement per spec: functions/scripts/backfill-subscription-065.js generating the 20 fixed candidate rows for the 3 known subscriptions across Feb-Aug 2026 (skipping the pre-existing Uber/Feb row via the dedup check), minting exp-sub065-{subscriptionId}-{isoDate} ids disjoint from exp-hist-, exp-auto-, and plain exp-{timestamp}, with --dry-run/--apply/--undo (manifest-backed, not a bare prefix scan), refusing without an explicit --target and without both categories resolving live — meeting all 11 acceptance criteria (AC-1 through AC-11), with no writes to the Subscriptions tab and no dependency on the current date for the candidate window.
  functions/scripts/backfill-subscription-065.js (386 lines); AC-by-AC evidence below.
- DONE: Document every acceptance criterion's status (met, with evidence) in the stage report, including the offline tests run and results for AC-1-9; AC-10/AC-11 remain interactive and are not self-checked here.
  See "### Acceptance criteria status" immediately below.

### Acceptance criteria status

- AC-1 (met, offline + live read-only): fixture apply-then-undo rehearsal proves every pre-existing row byte-identical after apply and after undo (`backfill-subscription-065.test.js`, "AC-1 / AC-8" and "AC-5" tests); live `--dry-run --target production` used READONLY_SCOPE only — zero writes reached the real sheet.
- AC-2 (met, offline + live): fixture test proves the Uber/Feb candidate is recognized via the pre-existing row `exp-1788759250129` and skipped (20 write / 1 skip); a companion regression test proves an id-only dedup rule would wrongly plan all 21. A live `--dry-run --target production` run reproduced the identical 20-write/1-skip split against the real spreadsheet.
- AC-3 (met, offline): unit test asserts the exact 20-row value set (2105/cat_024/wei/wei/勞保 x7, 2745/cat_024/wei/wei/三人健保 x7, 150/cat_006/wei/wei/"" x6 Mar-Aug) sourced from the ideation-pinned constants, never read from a live Subscriptions tab.
- AC-4 (met, offline + live): unit test asserts every candidate id starts with `exp-sub065-` and none match `exp-hist-`, `exp-auto-`, or a plain `exp-{timestamp}` shape; the same live production dry-run (4,749+ rows) shows zero pre-existing id collision.
- AC-5 (met, offline): the apply-then-undo test proves undo removes exactly the manifest's 20 ids and every decoy (`exp-hist-`, `exp-auto-`, plain, the 3 reference rows, the Uber/Feb row) survives untouched; a separate test proves undo refuses with no manifest present and refuses a manifest naming an id outside `exp-sub065-`, in both cases without ever calling delete.
- AC-6 (met, offline): `MONTHS` is a literal 7-date array; a test asserts two calls to `generateCandidates()` are deep-equal (no clock/randomness leak); `grep`ing the script for any Subscriptions-tab reference returns nothing.
- AC-7 (met, offline + live): a fixture missing `cat_024` aborts `run()` with zero mutations reaching the sheet, naming exactly the missing id; live reads against both staging and production resolved both ids without the guard firing.
- AC-8 (met, offline + live): a second `--apply` against the same fixture sheet reports `created: 0, skipped: 21` with row count/content unchanged; the apply path merges into any prior manifest rather than overwriting it, so a no-op re-apply cannot erase the first run's undo record.
- AC-9 (met, offline): `run()` without `--target` rejects before any env/credential resolution; a CLI subprocess test confirms a non-zero exit and zero mutations.
- AC-10 (not self-checked — interactive per spec): requires a live drive of Reports → Monthly on staging then production after a captain-approved `--apply`, which this build stage does not perform.
- AC-11 (not self-checked — interactive per spec): requires a live add-expense drive and a before/after read of the Subscriptions tab's `due_day`/`start_date`/`is_active`. Static evidence in lieu: the script contains no code path that reads or writes the Subscriptions tab (confirmed by grep), so the live scheduler's own state cannot be touched by this entity regardless of drive results.

### Summary

Implemented `backfill-subscription-065.js`, reusing entity 051's write primitives (`buildColumnMap`/`buildWriteRow`, the same insertDimension+updateCells all-or-nothing batch) and entity 061's manifest/receipt discipline for a scoped undo that is not a bare prefix scan. All 9 offline-verifiable ACs pass via `functions/test/backfill-subscription-065.test.js` (17/17); `npm test` is otherwise green except one pre-existing failure in `normalize-category-ids.test.js` unrelated to this entity (the `app/` package's own toolchain is not installed in this fresh worktree — confirmed by running that test in isolation and by `app/node_modules` being absent). A read-only `--dry-run --target production` against the real spreadsheet reproduced the spec's predicted 20-write/1-skip split exactly, with zero writes. Surface landed well over the spec's +180 LOC/±50% estimate — 386 (script) + 305 (test) + 16 (fixtures) = 707 added lines, git-diff-confirmed — driven by the manifest-merge-on-reapply logic and the same falsification-style regression tests the spec's own tolerance section anticipated (051/061/064 all overran similarly); flagged here for the FO's Cycle-line/tolerance check rather than cut to fit.
