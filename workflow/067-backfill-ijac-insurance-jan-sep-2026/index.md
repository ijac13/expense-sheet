---
id: 067
title: Backfill Ijac's 健保 and 勞保 Subscriptions for Jan-Sep 2026
status: spec
source: captain
started: 2026-09-09T09:31:46Z
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
        - id: gate:067:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:067-ideation-1
              briefing:
                id: briefing:067:ideation:attempt-1:revision-1
                digest: sha256:7c8a137aa5aa03255ad0802f54ef295d85723d36f097ac469ba6c0928d7d6478
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:067:ideation:1
                briefing: briefing:067:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-09T09:31:26.556245Z"
                decision: approve
                reason: Scope is clear, including the September inclusion rationale and the flagged collision risk with entity 066. Ready to move to spec.
              application:
                target-stage: spec
                state: consumed
        - id: gate:067:spec
          stage: spec
          attempts:
            - id: gate-attempt:067-spec-1
              briefing:
                id: briefing:067:spec:attempt-1:revision-1
                digest: sha256:2c84cf16fc58874f8149a61fa3a50d9e518c8c090ec3f5e86a97ed6c74b0de24
                room-ref: ./review/spec/briefing-1
---

Ijac's own 健保 (health insurance) and 勞保 (labor insurance) recurring costs — like wei's equivalent subscriptions backfilled in entity `065` — need to be backfilled from January through September 2026. Unlike `065`'s scope, this window explicitly includes September, since a live subscription with `due_day: 1` and a `start_date` after the 1st of the month it's created in does not actually fire for that first month (found while building `065`).

## User Stories

- As the captain, I want ijac's real 健保 and 勞保 expenses backfilled for each month from January through September 2026, so those months' totals and category breakdowns reflect what ijac actually paid, the same way `065` did for wei's equivalent subscriptions.
- As the captain, I want the same reviewable safety `065`/`060`-`064` used — staging rehearsed first, my approval before any production write, and a working, independently-scoped undo.

## Success

- Ijac's 健保 and 勞保 costs each get one row per month for January through September 2026 (2 expenses × 9 months = up to 18 rows, minus any month already covered by a pre-existing manual entry — confirm live, don't assume none exist, exactly as `065` found for wei's Uber/February).
- No pre-existing row (any payer, any month) altered or lost, proven by a before/after check.

### Out of Scope

- Any month before January 2026 or after September 2026 for these 2 expenses.
- wei's own 健保/勞保 subscriptions — already backfilled by `065`.
- Any change to the Subscriptions feature itself, or to ijac's subscription configuration (due day, start date, active status).

## Plan

To be filled in at spec time. Open questions for spec, mirroring `065`'s own investigation:

- Does ijac already have 健保 and 勞保 configured as app Subscriptions (matching wei's pattern), or does the captain need to set these up first? Confirm live against the Subscriptions tab — do not assume they exist.
- If they exist: what are their exact amounts, `due_day`, `start_date`, `is_active`, and subscription ids? Read live, the same way `065` read wei's three subscriptions' real configuration rather than trusting reference data.
- Why does this window include September when `065`'s did not — confirm live whether ijac's subscription(s), like wei's, have a `start_date`/`due_day` combination whose first live scheduler fire is October or later, leaving September genuinely uncovered.
- Scan the live Expenses tab for January-September 2026 for any pre-existing manual entry that already covers one of these subscription-months (the same collision `065` found for wei's Uber/February) — do not assume a clean 18-row backfill without checking. This is now a *known-likely* collision, not just a generic caution: entity `066` just backfilled 203 of ijac's own real expense rows for exactly Jan-Apr 2026 from her own ledger export, so her real 健保/勞保 payments for those months may already be among them under `exp-mig066-` ids. Spec must check `066`'s own rows specifically, not just any manual entry.
- id scheme and scoped undo, following `065`'s `exp-sub065-{subscriptionId}-{isoDate}` precedent but distinct from it (e.g. `exp-sub067-...`) so this entity's own undo cannot reach `065`'s rows or any other entity's.
- Confirm this is a direct app-data backfill (matching `065`'s and `051`'s established shape), not a spreadsheet import.

### Resolved at spec — verified against live production/staging data and the current code, not carried forward from the ideation's assumptions

Every claim below was obtained this stage: a live, read-only scan of production's and staging's Subscriptions/Categories/Expenses tabs (credentials from `functions/.env`/`.env.staging`, `spreadsheets.readonly` scope via `migration-env.js`'s existing `resolveCredentialPairs`), and a direct reading of `functions/lib/scheduler.js` (`isDueOn`/`autoExpenseId`/`runSubscriptionScheduler`) as it exists today.

**1. Both subscriptions exist, live on production — confirmed, not assumed.** Production's Subscriptions tab (44 rows) carries exactly two real records matching "ijac's own 健保/勞保", distinct from the three wei-named ones `065` already backfilled:

| id | name | amount | category_id | frequency | due_day | paid_by | is_active | start_date |
|---|---|---|---|---|---|---|---|---|
| `sub-1788741741902` | 健保 ijac | 3172 | `cat_024` | monthly | 5 | ijac | true | 2026-09-07 |
| `sub-1788741714162` | 勞保 ijac | 1145 | `cat_024` | monthly | 5 | ijac | true | 2026-09-07 |

Neither carries an `end_date` or a `notes` value. Decoding both ids as epoch-ms: created 2026-09-07T00:41:54.162Z and 2026-09-07T00:42:21.902Z (08:41-08:42 Taipei) — the same calendar day as `065`'s three wei-named subscriptions (created ~13:32 Taipei that day), but an earlier, separate session. `cat_024` is confirmed live as `Insurance`/`保險` on production (unchanged since `065`'s own spec-time check). **Staging has no equivalent**: its own Subscriptions tab (6 rows) holds only unrelated test/personal records (`ee`, `test`, `netflix`, `AC21-TEST`, `Fhj自在`, `Next`) — none named 健保/勞保, none for ijac's real insurance — so a staging rehearsal cannot exercise the real subscription data and must use seeded fixtures instead, the same conclusion `065`'s and `066`'s own staging work reached for their sources.

**2. Why the window runs through September — confirmed by tracing the scheduler's own code, not by analogy to `065`.** `isDueOn` (`functions/lib/scheduler.js:57-63`) compares only `today.day` (and `today.month` for `frequency: "annual"`) against `due_day`/`due_month` — it never reads `start_date` at all. `runSubscriptionScheduler` (`scheduler.js:163-173`) filters to `is_active && isDueOn(...)` before ever writing a row. Both subscriptions are `due_day: 5`, created 2026-09-07 — two days after September's due day had already passed — so the daily scheduler job never saw them as due in September, and their first real fire is **2026-10-05**. A live scan of production's `exp-auto-` rows (165 total) confirms zero exist yet for either subscription id, consistent with no fire having happened. Every month January through September 2026 therefore has zero scheduler-generated row for these two subscriptions — the same `due_day`-vs-`start_date` gap `065`'s own wei subscriptions hit (also created 2026-09-07, `due_day: 1`, so their first fire was also after September 1 had passed) but that `065` did not fold into its own scope; `067` corrects the omission for ijac's window specifically, not retroactively for `065` (out of scope below).

**3. Pre-existing coverage — checked live, none found.** A full live read of production's Expenses tab (4,976 rows; 952 of them fall in 2026-01-01..2026-09-30, any payer, any category) found **zero rows anywhere in that window matching either subscription's exact amount (3172 or 1145)**, under any category or any payer. Entity `066`'s own migration rows are in fact live on production today — not merely staging-rehearsed-then-undone — confirmed by a live count: exactly 203 `exp-mig066-` rows exist on production, spanning 2026-01-01..2026-04-30 (matching `066`'s own spec/build figures exactly), and zero on staging (consistent with `066`'s verify-stage staging rehearsal having been undone after closing its interactive ACs). None of those 203 rows carry a `notes` value matching 健保/勞保/保費/保險, and none carry amount 3172 or 1145. ijac does have 5 pre-existing `cat_024` (Insurance) rows in the Jan-Sep 2026 window (2026-08-19 amount 31430 "Libi 國泰"; 2026-07-29 amounts 8362 "國壽" and 11742 "國壽保費"; 2026-07-09 amount 15062 "Alisa 保費"; 2026-05-11 amount 5268 "ijac 國壽保費") — these are unrelated life/medical insurance premiums for other family members' own dedicated Subscriptions records (`Alisa 新光醫療` x2, `Libi 國泰人壽`, `ijac 國泰醫療`), not 健保/勞保, and are left untouched. **Conclusion: the plan is a clean 18 rows (2 subscriptions × 9 months), 0 skips required** — unlike `065`'s Uber/February collision, the known-likely `066` collision this checklist flagged did not materialize.

**4. Row shape — `date`/`notes`/`paid_by`/`created_by`, derived from the live scheduler's own future write, since no manual reference row exists to copy.** Unlike `065` (where the captain had manually typed 3 example rows the same session she configured the subscriptions), no manual row exists alongside these two ijac subscriptions to establish a notes/date convention. `runSubscriptionScheduler`'s own row-build (`scheduler.js:192-199`) sets `date: today.iso` (i.e., the actual due day the job ran on — the 5th, for these two), `created_by: sub.paid_by` (not a separately tracked field), and `notes: sub.name` (the subscription's own `name` field, not its `notes` field). Decision: backfilled rows use the 5th of each month (not the 1st — these subscriptions' own `due_day`), `paid_by: "ijac"` / `created_by: "ijac"` (both subscriptions' own `paid_by`, and, unlike `065`'s wei-owned-but-ijac-administered case, the administrator and the true payer are the same person here — no divergence to resolve), and `notes` set to each subscription's own name (`"健保 ijac"` / `"勞保 ijac"`) — so a backfilled January row and the eventual October 5 auto-fired row are visually identical except by id prefix, exactly mirroring what the live feature itself would have produced.

**5. Id scheme and undo scope — DECIDED.** New rows mint `exp-sub067-{subscriptionId}-{isoDate}` (e.g. `exp-sub067-sub-1788741741902-2026-01-05`) — deterministic from (subscription, date), following `065`'s own precedent but with a distinct prefix so this entity's undo cannot reach `065`'s, `066`'s, or any other entity's rows. A live census of every id currently on both spreadsheets confirms disjointness by construction against all families found: `exp-hist-` (2,523 rows) / `exp-hist-mortgage-` (25 rows) — `060`-`064`'s archive-import lineage; `exp-sub065-` (20 rows) — `065`'s own subscription backfill; `exp-mig066-` (203 rows) — `066`'s ledger migration; `exp-auto-` (165 rows) — the live scheduler's own format; plain `exp-{timestamp}` (393 rows) — manual entries; and a pre-`060` legacy family shaped `exp_{year}_{NNNN}` (1,647 rows on production, 1,404 on staging, underscore-separated, distinct from every hyphenated `exp-...` shape). Zero rows on either spreadsheet (production 4,976 total, staging 1,409 total) currently match `exp-sub067-`. Undo is manifest-backed, following `065`'s design (not `066`'s simpler bare-prefix scan): `--apply` writes a JSON manifest recording exactly the ids it wrote; `--undo` requires that manifest, refuses if any manifest-listed id falls outside the `exp-sub067-` prefix, and deletes only those ids.

**6. Direct app-data write — CONFIRMED**, matching `065`'s and `051`'s shape, not a spreadsheet import: the source of truth here is the two already-live Subscriptions records themselves (read once at spec time and pinned, per point 4 above), not an external workbook.

## Spec

### Goal

Backfill ijac's own 健保 (3172/month) and 勞保 (1145/month) insurance costs — both configured 2026-09-07 as real app Subscriptions with `due_day: 5`, whose first live scheduler fire is confirmed to be 2026-10-05 — for January through September 2026, as a direct write to the live Expenses tab under a new, collision-free id namespace, since a live check found zero pre-existing rows (entity `066`'s own Jan-Apr migration rows included) already covering either subscription anywhere in this window.

### User Stories

- As the captain, I want ijac's real 健保 and 勞保 expenses backfilled for each month from January through September 2026, so those months' totals and category breakdowns reflect what ijac actually paid, the same way `065` did for wei's equivalent subscriptions.
- As the captain, I want confirmation — not assumption — that entity `066`'s own Jan-Apr 2026 migration rows don't already cover one of these subscription-months, since that collision was flagged as known-likely going into this spec.
- As the captain, I want September included, since a live trace of the scheduler's own code confirms these two subscriptions' first real fire is October, not September — the same gap `065` didn't catch for wei's subscriptions.
- As the captain, I want the same reviewable safety `065`/`060`-`064` used — staging rehearsed first (with seeded fixtures, since staging has neither the real subscriptions nor a matching Insurance category id), my approval before any production write, and a working, independently-scoped undo.

### Edge Cases

- **Both subscriptions' first live scheduler fire is 2026-10-05** (`due_day: 5`, created 2026-09-07 — after that month's due day had passed; `isDueOn` never checks `start_date`) — confirmed by reading `functions/lib/scheduler.js` live, not assumed. This is why the window runs through September, unlike `065`'s Feb-Aug for wei's `due_day: 1` subscriptions (the same underlying mechanism, found too late to fold back into `065` — retroactively fixing `065`'s own gap is out of scope here).
- **No manual entry anywhere in the Jan-Sep 2026 window matches either subscription's exact amount** (3172, 1145) under any category or payer — confirmed by a full live scan of production's 4,976-row Expenses tab. The plan is a clean 18 rows, 0 skips (unlike `065`'s Uber/February collision).
- **Entity `066`'s own 203 `exp-mig066-` rows are live on production** (confirmed, not merely staging-rehearsed-then-undone) for exactly Jan-Apr 2026, ijac's own real ledger — none carry 健保/勞保-related notes or the target amounts. The known-likely collision this checklist flagged did not materialize, but had to be checked, not assumed clean.
- **Neither subscription's own `notes` field is set, and no manual reference row exists** to copy a notes/date convention from (unlike `065`'s captain-typed examples). The live scheduler's own future write (`notes: sub.name`, `date` = the actual due day) is used as the standalone source of truth, so a backfilled row and an eventual October 5 auto-fired row are visually identical except by id.
- **The Subscriptions tab's `paid_by` is "ijac" for both records** — unlike `065`'s wei-owned-but-ijac-administered case, the administrator and the true payer are the same person here, so there is no discrepancy to resolve.
- **Staging has no equivalent subscriptions, and its own `cat_024` is not Insurance** (a different category — the same staging/production id divergence `065`'s own verify-stage addendum already documented, where staging's `cat_024` showed as "Antkee"). A staging rehearsal must seed synthetic Subscriptions/Categories fixtures rather than assume staging mirrors production.
- **Running apply a second time, or after a partial mid-batch failure.** Ids are deterministic from (subscriptionId, isoDate), so a re-run must recognize every already-written id and skip it.
- **Undo run any time after these rows are live.** Must remove only this run's own `exp-sub067-` ids (checked against a saved manifest, not a bare prefix scan) and leave every other family — `exp-hist-`, `exp-hist-mortgage-`, `exp-sub065-`, `exp-mig066-`, `exp-auto-`, plain `exp-{timestamp}`, and the legacy `exp_{year}_{NNNN}` shape — untouched.
- **The live scheduler's first real fire for these 2 subscriptions, 2026-10-05 onward.** Must never collide with this backfill's ids (different namespace, by construction) and must never be affected by this backfill (no write to the Subscriptions tab).
- **A target's Categories tab where `cat_024` does not resolve, or resolves to something other than Insurance** (staging's `cat_024` is a different category entirely). The run refuses before writing if the id is literally absent; a staging rehearsal must use a fixture whose `cat_024` is seeded to mean Insurance, never a live staging write filed under staging's real, differently-meaning `cat_024`.

### Out of Scope

- Any month before January 2026 or after September 2026 for these 2 expenses.
- wei's own 健保/勞保 subscriptions — already backfilled by `065`, including `065`'s own unaddressed September gap (found here, not retroactively fixed).
- Any change to the Subscriptions feature itself, or to ijac's subscription configuration (`due_day`, `start_date`, `is_active`, amounts).
- The 5 pre-existing, unrelated `cat_024` rows for ijac (Libi/Alisa/ijac's own other life/medical insurance policies) — left exactly as they are.

## Acceptance criteria

Verification split: **offline** — AC-1 through AC-9. **Interactive** — AC-10, AC-11. No harness is built to automate AC-10 or AC-11; both are judged on a live drive of the deployed app, per the pattern `065`/`066` already established.

**AC-1 — No pre-existing expense row (any payer, any month, any id family) is altered or deleted by this backfill.**
Verified by: offline — a before/after snapshot diff (staging rehearsal seeded with decoy rows under every known family: `exp-hist-`, `exp-hist-mortgage-`, `exp-sub065-`, `exp-mig066-`, `exp-auto-`, plain `exp-{timestamp}`, and the legacy `exp_{year}_{NNNN}` shape) plus a live dry-run against production reports 0 modified, 0 deleted among rows whose id does not begin `exp-sub067-`.
Falsified by: switching from row-insertion to an in-place `values.update`, or writing before checking existing coverage — a decoy or a real pre-existing row then shows modified or deleted in the diff.

**AC-2 — All 18 subscription-months (2 subscriptions × Jan-Sep 2026) are written exactly once; today, that means 18 new rows and 0 skips, matching this spec's own live scan finding no pre-existing coverage.**
Verified by: offline — a live dry-run against production reports exactly 18 candidates, 0 skips; a unit test against a fixture asserts the same 18-candidate shape and separately proves a fixture-seeded decoy at the exact (date, amount, category_id, paid_by) key IS recognized and skipped, exercising the dedup path even though production needs no skips today.
Falsified by: a dedup rule keyed only on the new-scheme id (never checked against existing rows' own date/amount/category_id/paid_by) — a future pre-existing row landing on one of these 18 slots would then be double-counted instead of recognized.

**AC-3 — Each new row carries the correct amount, category_id, date (the 5th of its month — the subscriptions' own `due_day`, not the 1st), paid_by, created_by, and notes, for both subscriptions, matching this spec's pinned figures: 9 rows at 3172/`cat_024`/ijac/ijac/"健保 ijac" (Jan-Sep), 9 rows at 1145/`cat_024`/ijac/ijac/"勞保 ijac" (Jan-Sep).**
Verified by: offline — a unit test against the 2 known subscription ids asserts this exact 18-row set (values, not counts alone); a live dry-run diffs the same set against production.
Falsified by: reading amount/category_id/due_day from the Subscriptions tab's *current* live values at run time instead of this spec's pinned figures — a later captain edit to either subscription would then silently rewrite Jan-Sep 2026 history on a re-run.

**AC-4 — New row ids are minted under a dedicated namespace, `exp-sub067-{subscriptionId}-{isoDate}`, disjoint by construction from every other id family present on any target: `exp-hist-`, `exp-hist-mortgage-` (`060`-`064`), `exp-sub065-` (`065`), `exp-mig066-` (`066`), `exp-auto-` (the live scheduler's own, including whatever it mints for these same 2 subscriptions from 2026-10-05 onward), plain `exp-{timestamp}`, and the legacy `exp_{year}_{NNNN}` shape.**
Verified by: offline — a unit test asserts all 7 known families and the new prefix are pairwise disjoint by pattern; a live read of both staging's (1,409 rows) and production's (4,976 rows) full Expenses tabs confirms zero existing id matches the new prefix.
Falsified by: reusing `exp-auto-` for these rows — the live scheduler's first real October 5 fire for either subscription would then either silently no-op against an id it thinks it already wrote, or become indistinguishable from this run's own rows in an audit or undo.

**AC-5 — Undo removes only this run's own written ids (from its own saved manifest, cross-checked against the `exp-sub067-` prefix) and leaves every other row — all 7 other families above — byte-identical.**
Verified by: offline, on staging seeded with a decoy row under each of the other 6 known id shapes — apply, undo, diff shows only this run's own ids removed and every decoy survives.
Falsified by: scoping undo to a bare prefix match with no manifest cross-check — a coincidental future id starting `exp-sub067-`, or a re-run of this same script for a different window, would then also be deleted.

**AC-6 — The backfill never writes to the Subscriptions tab, and the candidate-date window is fixed to the 9 dates 2026-01-05..2026-09-05 by construction, never derived from the current date.**
Verified by: offline — a unit test asserts two calls to the candidate generator are deep-equal regardless of what `now` the script is run with; a grep of the script for any Subscriptions-tab reference or write path returns nothing.
Falsified by: deriving the window from `taipeiDate(now)` the way the live scheduler does — a run any month after September 2026 would then silently propose October-onward dates too.

**AC-7 — Before any row is written, `cat_024` is confirmed live against the target's own Categories tab, and the run refuses if it is missing.**
Verified by: offline — a fixture missing `cat_024` aborts the run with zero rows written; confirmed live today `cat_024` resolves to `Insurance`/`保險` on production.
Falsified by: resolving the category by name instead of by this spec's pinned id — since staging's own `cat_024` is a different category entirely (a known divergence `065` already documented), resolving by name could silently write staging rows under a wrong category, or resolving by id could silently "succeed" filed under staging's differently-meaning `cat_024` — the pinned-id design surfaces this at the fixture-seeding stage instead of masking it live.

**AC-8 — Running `--apply` a second time against the same target writes nothing further.**
Verified by: offline — a second `--apply` reports `created: 0`, all 18 candidates recognized as already-written.
Falsified by: any non-deterministic component in the id (e.g. a timestamp) — a re-run would then duplicate all 18 rows.

**AC-9 — The script refuses to run without an explicit `--target`, matching `060`-`065`'s established safety discipline.**
Verified by: offline — invocation without `--target` exits non-zero and writes nothing to either spreadsheet.
Falsified by: falling back to a default resolved spreadsheet id.

**AC-10 — Reports → Monthly, stepped through January-September 2026, shows each month's Insurance (`cat_024`) total increased by exactly 4,317 (3,172 + 1,145) over its pre-backfill total, and October 2026 is unaffected by this backfill.**
Verified by: interactive — live drive on staging (seeded fixtures) then production after merge: record each month's Insurance total before, apply, re-check after; step to October and confirm its total reflects only the live scheduler's own behavior, not this backfill.
Falsified by: a row written under a wrong month/date, or the dedup check failing to catch a real pre-existing row — the observed per-month delta then does not match 4,317, or October's total moves from this backfill alone.

**AC-11 — Everyday use is unaffected: adding a new expense still writes and appears in today's list, and nothing about the Subscriptions tab (`due_day`, `start_date`, `is_active`) changed for these 2 records, so the live scheduler's own October 5 fire is unaffected.**
Verified by: interactive — live drive: add and see an expense; separately, a live read of the Subscriptions tab after this backfill confirms both records' `due_day`/`start_date`/`is_active` are byte-identical to the values captured at this spec stage (`due_day: 5`, `start_date: 2026-09-07`, `is_active: true`).
Falsified by: a row wider than the Expenses header row — `buildColumnMap` throws and `GET /api` starts failing — or any write path in this entity touching the Subscriptions tab.

## Risk evidence

**Riskiest unverified mechanism this cycle: whether entity `066`'s own Jan-Apr 2026 migration rows already covered ijac's real 健保/勞保 payments — flagged as *known-likely*, not a generic caution.** Exercised, not assumed: confirmed live that `066`'s 203 `exp-mig066-` rows are in fact live on production today (not merely staging-rehearsed-then-undone), then scanned all 203 for the target amounts (3172, 1145) and for 健保/勞保-related notes — zero matches. A separate full scan of the entire 952-row Jan-Sep 2026 window (any payer, any category, any id family) for those two amounts also found zero matches. The concern was real enough to require checking; it did not materialize.

**Second, exercised: why the window includes September.** Not assumed by analogy to the ideation's own text — traced `isDueOn`/`runSubscriptionScheduler` in `functions/lib/scheduler.js` directly: `isDueOn` never reads `start_date`, only `due_day`/`due_month` against today. Both subscriptions (`due_day: 5`, created 2026-09-07) had already missed September's due day, so their first real fire is 2026-10-05 — confirmed further by a live scan finding zero `exp-auto-` rows yet for either subscription id.

**Third, found rather than assumed: staging cannot rehearse against real data for this entity.** Staging's Subscriptions tab holds no 健保/勞保 records for ijac, and staging's own `cat_024` is a different category (not Insurance) — the same staging/production id divergence `065`'s own verify-stage addendum already documented for a different category id. Build/verify must seed fixtures rather than assume a staging apply is meaningful against staging's real, differently-meaning `cat_024`.

**No spike needed:** the write mechanism (`insertRowsAtTop`/id-scoped row deletion via `batchUpdate`, the manifest-backed undo, the staging-first + explicit `--target` discipline) is already built and proven by entity `065`'s `backfill-subscription-065.js`; this entity reuses that exact shape with a new 2-subscription/9-month candidate list and a new id prefix — no new mechanism, no classification engine, no evidence-inference needed.

## Expected surface and tolerance

Estimate: **+150 net LOC across 3 files, tolerance ±60%** (60-240). Nearly identical in shape to `065` (2 subscriptions × 9 months here vs. 3 × 7 there) reusing the same proven mechanism, but the band stays wide because `065` itself, estimated at +180 (90-270), shipped +707 (293% over) — driven by falsification-style tests this entity's own AC-2, AC-4, and AC-5 falsifiers are written the same way, on purpose.

- `functions/scripts/backfill-subscription-067.js` — new, ~100-150 LOC. Candidate generation (2 known subscriptions × 9 fixed dates), the (date, amount, category_id, paid_by) dedup check against existing rows, the `exp-sub067-` id scheme, `--dry-run`/`--apply`/`--undo`, manifest write/read for scoped undo.
- `functions/test/backfill-subscription-067.test.js` — new, ~60-90 LOC. Covers AC-2 (dedup), AC-3 (row values), AC-4 (id disjointness across all 7 known families), AC-6 (fixed window), AC-8 (idempotent re-run).
- `functions/scripts/fixtures/backfill-067-sample/` — new, ~10-20 LOC. Synthetic Subscriptions/Categories/Expenses fixtures — since staging has neither the real subscriptions nor a matching Insurance category id — including decoy rows under each of the other 6 known id families (AC-1/AC-5).

Semantics this may change: **stored data only** — 18 new Expenses rows for Jan-Sep 2026. No category created (`cat_024` already exists on production — AC-7). No API shape change, no auth change, no scheduled-behavior change, no change to the Subscriptions tab, the live scheduler, or any other entity's id scheme.

## Test plan

- **Unit, offline:** the 2-subscription/9-month candidate generator against a fixture reproducing the live shapes. Covers AC-2, AC-3, AC-6.
- **Falsification, offline:** an id-only dedup check (ignoring date/amount/category/payer) against a fixture with a seeded decoy, asserted to miss it and write a duplicate — committed as a permanent regression test, matching this workflow's house style. Separately, a prefix-disjointness test against all 7 existing id families. Covers AC-2, AC-4.
- **Dry-run, offline:** against live production data, confirming the plan is exactly 18 rows with 0 skips, and zero id overlap with any existing row. Covers AC-2, AC-3, AC-4, AC-7, AC-9.
- **Apply + undo rehearsal on staging, offline:** since staging has neither the real subscriptions nor a matching `cat_024`, rehearse against seeded fixtures — snapshot → apply → verify → undo → diff, with decoys under all 6 other known id shapes to prove undo scoping. Covers AC-1, AC-5, AC-8.
- **Live drive, interactive:** deployed staging (fixtures), then production after merge: Reports → Monthly stepped through Jan-Sep 2026 (and October re-checked unaffected by this backfill), then add/see an expense and re-read the Subscriptions tab unchanged. Covers AC-10 and AC-11.
- **Cost:** unit, falsification, and dry-run steps run in seconds against a fixture or a single live read. The apply+undo rehearsal is the one expensive, must-not-skip step, since it is the only way to prove the undo-scoping property against realistic decoys before a production write.

### Feedback Cycles

## Stage Report: spec

- DONE: Confirm live against the Subscriptions tab whether ijac's 健保 and 勞保 already exist as app Subscriptions, and if so read their real amounts, due_day, start_date, is_active, and subscription ids
  Live read of production's Subscriptions tab (44 rows): `sub-1788741741902` (健保 ijac, 3172, `cat_024`, monthly, due_day 5, ijac, active, start_date 2026-09-07) and `sub-1788741714162` (勞保 ijac, 1145, `cat_024`, monthly, due_day 5, ijac, active, start_date 2026-09-07). Staging holds no equivalent. See "Resolved at spec" point 1.
- DONE: Confirm live why the Jan-Sep 2026 window needs backfilling, and check the live Expenses tab for pre-existing coverage, specifically entity 066's own exp-mig066- rows for Jan-Apr 2026
  Traced `isDueOn`/`runSubscriptionScheduler` in `functions/lib/scheduler.js`: no `start_date` check, and both subscriptions' due_day (5) had already passed when created (2026-09-07), so their first real fire is 2026-10-05 — confirmed further by zero existing `exp-auto-` rows for either subscription id. Confirmed 066's 203 `exp-mig066-` rows are live on production (not just staging-rehearsed) and scanned all of them plus the full 952-row Jan-Sep 2026 window for the target amounts (3172, 1145) and 健保/勞保-related notes: zero matches. See "Resolved at spec" points 2-3.
- DONE: Write `## Spec` (Goal, User Stories, Edge Cases, Out of Scope) reflecting what was actually found, and design a collision-safe id scheme with its own scoped undo
  Added, including edge cases for the September/due_day finding, the no-manual-reference-row notes decision, and the staging category-id divergence. Id scheme `exp-sub067-{subscriptionId}-{isoDate}`, checked disjoint against all 7 known live id families across both spreadsheets (production 4,976 rows, staging 1,409 rows); manifest-backed undo per `065`'s design.
- DONE: Write a top-level `## Acceptance criteria` section (sibling of `## Spec`) where each AC has a Verified by: {offline|interactive} clause and a Falsified by: clause
  11 ACs added (AC-1 through AC-9 offline, AC-10/AC-11 interactive), each with both clauses, following the Spec Template's structure exactly.

### Summary

Live investigation confirmed both ijac subscriptions exist on production (健保 ijac 3172, 勞保 ijac 1145, both `due_day: 5`, created 2026-09-07), and that tracing the scheduler's own code — not analogy to `065` — shows their first real fire is 2026-10-05, confirming Jan-Sep 2026 is the correct window. The known-likely collision with entity `066`'s 203 live `exp-mig066-` rows (Jan-Apr 2026) was checked directly and found clean: zero matching amounts or insurance-related notes, so the plan is 18 new rows with 0 skips. Two findings shaped the row shape beyond the checklist's literal ask: the backfilled date should be the 5th of each month (the subscriptions' own `due_day`), not the 1st, and since no manual reference row exists for these subscriptions (unlike `065`'s captain-typed examples), notes/created_by follow what the live scheduler itself would produce (`notes: sub.name`, `created_by: sub.paid_by`) rather than a guessed convention. Id scheme `exp-sub067-{subscriptionId}-{isoDate}` is disjoint by construction from all 7 known id families found live across both spreadsheets.
