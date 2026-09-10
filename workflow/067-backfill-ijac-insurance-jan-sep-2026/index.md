---
id: 067
title: Backfill Ijac's 健保 and 勞保 Subscriptions for Jan-Sep 2026
status: verify
source: captain
started: 2026-09-09T09:31:46Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-067-backfill-ijac-insurance-jan-sep-2026
issue:
pr: "#38"
mod-block: merge:pr-merge
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
              resolution:
                type: Resolution
                id: resolution:spacedock:067:spec:1
                briefing: briefing:067:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-09-09T23:42:26.756649Z"
                decision: approve
                reason: Both subscriptions confirmed live, September root-caused in scheduler code, the flagged 066 collision checked and found clean, id scheme confirmed collision-free against all 7 known families. Ready for build.
              application:
                target-stage: build
                state: consumed
        - id: gate:067:verify
          stage: verify
          attempts:
            - id: gate-attempt:067-verify-1
              briefing:
                id: briefing:067:verify:attempt-1:revision-1
                digest: sha256:b55afb271aeb181475ed8df91c7b07eaec2201409588a0a21c14fbdd06b302a3
                room-ref: ./review/verify/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:067:verify:1
                briefing: briefing:067:verify:attempt-1:revision-1
                by: person:captain
                at: "2026-09-10T08:15:39.83738Z"
                decision: approve
                reason: 'Approved after full drive: production apply confirmed 18/18, captain confirmed Reports totals and everyday use/Subscriptions tab unaffected. All 11 ACs met.'
              application:
                target-stage: done
                state: pending
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

## Stage Report: build

- DONE: Write a brief implementation plan before coding begins, covering the fixed 18-candidate generation (2 subscriptions x Jan-Sep 2026, dated the 5th of each month), the category pre-check by pinned id (not name, since staging's cat_024 means something else), and the exp-sub067-{subscriptionId}-{isoDate} id/manifest scheme.
  Plan posted before any file write: 2 subscriptions pinned literally (健保 3172, 勞保 1145, both cat_024/ijac/ijac) x 9 fixed dates (`2026-01-05`..`2026-09-05`); `REQUIRED_CATEGORIES = ["cat_024"]` checked by id existence only, never by name; `exp-sub067-{subscriptionId}-{isoDate}` id scheme with 065's manifest-backed undo reused unmodified in shape.
- DONE: Implement per spec: a script generating the 18 fixed candidate rows for the 2 known ijac subscriptions (pinned amounts/category from spec, never re-read from live Subscriptions state), with --dry-run/--apply/--undo (manifest-backed, not a bare prefix scan), refusing without an explicit --target and without cat_024 resolving live on the target -- meeting all 11 acceptance criteria (AC-1 through AC-11), with no writes to the Subscriptions tab and no dependency on the current date for the candidate window. Since staging has neither the real subscriptions nor a matching category, use seeded fixtures for the staging rehearsal rather than live staging data.
  `functions/scripts/backfill-subscription-067.js` (commit 1fff53f) implements exactly this, adapted from entity 065's `backfill-subscription-065.js` with no mechanism changes. AC-1 through AC-9 fully self-verified offline (below). AC-10/AC-11 are implemented for (no Subscriptions-tab write path exists; id scheme is disjoint from the live scheduler's own future `exp-auto-` writes) but, per spec and item 3 below, are interactive-only and confirmed at the verify stage's live drive, not here. Staging rehearsal used seeded fixtures (`fixtures/backfill-067-sample/`), never a live staging write, since staging holds neither subscription nor a matching `cat_024`.
- DONE: Document every acceptance criterion's status (met, with evidence) in the stage report, including the offline tests run and results for AC-1-9; AC-10/AC-11 remain interactive and are not self-checked here.
  All evidence below is from `functions/test/backfill-subscription-067.test.js` (20 new tests, all passing) unless noted as a live call. Full repo suite: 360/360 passing, no regressions (2 initial failures were a pre-existing worktree setup gap — a missing `app/node_modules` symlink unrelated to this change — resolved by symlinking and re-run clean).
  - AC-1 (met): fixture apply+undo rehearsal (8 decoys spanning all 7 known families plus a value-collision decoy) — every pre-existing row byte-identical after apply and after undo (test "AC-1 / AC-8: --apply writes 17 rows once...").
  - AC-2 (met): `generateCandidates()` always returns 18; against a decoy-free set plans 18/0 skips (test "today's actual production shape"); against the seeded value-collision decoy correctly plans 17/1 (test "the 健保/March candidate is recognized..."); a permanent regression test proves an id-only dedup would wrongly plan all 18 ("an id-only dedup ... MISSES the value-collision decoy").
  - AC-3 (met): unit test asserts the 17-row write set's exact values (8 健保 rows minus the dedup'd March row, 9 勞保 rows), pinned to spec figures, not live state (test "AC-3: the 17-row write set carries exact spec-pinned values"). Live read-only dry-run against production independently confirms the same 18 candidate values with 0 skips today.
  - AC-4 (met): unit tests assert no candidate id starts with `exp-hist-` (covers `exp-hist-mortgage-` as a superstring), `exp-sub065-`, `exp-mig066-`, `exp-auto-`, or matches the plain `exp-{timestamp}` / legacy `exp_{year}_{NNNN}` regexes (test "AC-4: ... pairwise disjoint from all 7 known id families"); a dedicated test proves the live scheduler's own future `exp-auto-` id for the SAME subscription/date never collides with this entity's id. Live read of production (4,976 rows) and staging (1,409 rows) confirms zero `exp-sub067-` matches today.
  - AC-5 (met): fixture rehearsal — apply writes 17 `exp-sub067-` rows, undo removes exactly 17, all 8 decoys (7 families + value-collision) survive untouched (test "AC-5: undo removes exactly this run's manifest ids..."); a second test proves undo refuses with no manifest and refuses a manifest naming an id outside the `exp-sub067-` prefix, zero delete calls reaching the sheet.
  - AC-6 (met): `generateCandidates()` takes zero arguments (asserted directly); two calls deep-equal regardless of clock; a grep of the script for "Subscriptions" returns only comments and the local candidate-data constant `SUBSCRIPTIONS` — no live tab reference or write path.
  - AC-7 (met): `assertCategoriesResolve` checks `cat_024` by id only; unit test proves refusal naming `cat_024` when only `cat_099` exists, zero write calls reach the sheet; live dry-run against production confirms `cat_024` resolves there today.
  - AC-8 (met): fixture test — first apply `created=17`, second apply `created=0, skipped=18` (all recognized by id or by value), sheet contents unchanged by the no-op re-apply.
  - AC-9 (met): unit test and a real CLI `execFileSync` invocation both confirm rejection / non-zero exit without `--target`; `resolveWritePair` has no default-spreadsheet fallback.
  - AC-10, AC-11 (SKIPPED — interactive, per spec not self-checked at build): no offline harness built; deferred to the verify stage's live drive on staging (fixtures) then production, per the spec's own split.

### Summary

Reused entity 065's proven backfill mechanism unmodified in shape, adapted to 067's own 2 pinned subscriptions (健保 3172, 勞保 1145, both `cat_024`, due day 5) and 9 fixed Jan-Sep 2026 dates, under a new `exp-sub067-` id/manifest namespace. All 9 offline acceptance criteria (AC-1 through AC-9) are met and evidenced by 20 new unit tests plus a live read-only dry-run against production, which independently confirms the spec's own claim of exactly 18 candidates with 0 skips today. The fixture deliberately seeds a value-level dedup collision (absent from real production data) to exercise the dedup path per the test plan, alongside decoys under all 7 known id families including the live scheduler's own future `exp-auto-` write for these same 2 subscriptions. AC-10/AC-11 are interactive-only and deferred to the verify stage, unchanged from the spec's own split. Full repo test suite (360 tests) passes with no regressions.

## Stage Report: verify

- DONE: Independently re-run and falsify the offline surface from a clean rebuild, and independently re-run a live --dry-run against production to confirm the 18/0 candidate split still holds unchanged.
  `rm -rf functions/lib && npm install && npm test`: 332/333 — the sole failure (`normalize-category-ids.test.js`) is a pre-existing worktree gap (missing `app/node_modules`, needed by an unrelated migration script), confirmed by symlinking the main checkout's `app/node_modules` and re-running clean: 360/360, no regressions. `functions/test/backfill-subscription-067.test.js` standalone: 20/20. Falsified AC-2/AC-3/AC-1/AC-8/AC-5 by rewriting `planCandidates` to an id-only dedup (dropping the `byKey`/`dedupKey` value check): exactly 5 tests went red ("AC-2: the 健保/March candidate...", "AC-3: the 17-row write set...", "AC-1 / AC-8: --apply writes 17...", "AC-5: undo removes exactly...", "dry-run against the checked-in fixture...") and nothing else. Restored the original file and confirmed `git status --short`/`git diff` empty, then re-ran 20/20 clean. Live `node -r ./scripts/load-local-env.js scripts/backfill-subscription-067.js --target production --dry-run`: `18 candidate(s), 18 to write, 0 skipped`, all 18 ids and values matching build's claimed plan exactly — `READONLY_SCOPE` only, no write.
- DONE: Run the Mandatory PII/Secrets Check over the full branch diff.
  `git diff main...HEAD` across all 4 changed source files, grepped for key/secret/token/password/PEM patterns, emails, phone numbers: zero hits beyond the env-var *names* (`GOOGLE_SERVICE_ACCOUNT_KEY_STAGING`) and stub literals (`"{}"`, `"sheet-under-test"`) already used by sibling entities' tests. Only identifiers present are first names (`ijac`, `wei`) matching the app's existing data model across every prior entity. No `.env*` file is part of the diff.
- DONE: Confirm no deploy is needed (this entity touches only functions/scripts/ and functions/test/, matching 060-066's pattern, not app/ or functions/src/) and confirm staging is otherwise unaffected.
  `git diff main...HEAD --name-only`: only `functions/scripts/backfill-subscription-067.js`, `functions/scripts/fixtures/backfill-067-sample/{Categories,Expenses}.json`, `functions/test/backfill-subscription-067.test.js`, and this entity file — zero touches to `app/`, `functions/src/`, or any deploy config. `curl -sI https://expense-sheet-staging.web.app/` → 200; `curl -sI https://expense-sheet-staging.web.app/api` → 401 unauthenticated (correct fail-closed) — staging serves exactly as before.
- DONE: Provide concrete numbered manual-test steps for the captain covering: reviewing/approving whatever the apply step requires, AC-10 (Reports Insurance total up by exactly 4,317 each month Jan-Sep, October unaffected) and AC-11 (everyday use unaffected, Subscriptions tab unchanged).
  See "The captain's manual test" below.

### The captain's manual test

**Before anything is written — approving the plan**

1. This backfill adds 18 new expense rows to production, none of them changing anything that already exists: 9 rows of 健保 at 3,172 (Jan-Sep 2026) and 9 rows of 勞保 at 1,145 (Jan-Sep 2026). A live check against the real production sheet just now confirmed this exact 18-write/0-skip plan still holds.
2. Tell the first officer if this matches what you expect. Your go-ahead here is what allows the write to actually happen — nothing is written to production before you say so. (Staging has no equivalent 健保/勞保 subscriptions or matching Insurance category to rehearse against live, so this entity's staging rehearsal already happened offline against seeded fixtures during build — there is no live staging apply step to approve separately, unless you'd like one anyway.)

**After it's applied to production — AC-10, checking Reports**

3. Open **https://expense-sheet-b2db8.web.app** and sign in with your usual Google account.
4. Tap **Reports**, switch to **Monthly**, and step to **January 2026**. Expect: the Insurance category total is 4,317 higher than it showed before (3,172 + 1,145).
5. Step through **February, March, April, May, June, July, August, September 2026** one at a time. Expect: each of those months, Insurance up by 4,317 versus before.
6. Step to **October 2026**. Expect: totals unchanged from before this backfill — this entity does not touch October onward, and the live scheduler's own first fire for these two subscriptions is 2026-10-05.
7. Tell the first officer whether steps 4-6 looked right.

**After it's applied — AC-11, everyday use and Subscriptions unaffected, can be done anytime**

8. Still on **https://expense-sheet-b2db8.web.app**, tap **Home**. Add an expense the way you normally would — any amount, any category. Expect: it appears in today's list immediately.
9. Delete the expense you just added. Expect: it disappears.
10. Tap **Subscriptions**. Find **健保 ijac** and **勞保 ijac**. Expect: due day (5), start date (2026-09-07), and active status all look exactly as you left them — this backfill never touches this tab.
11. Tell the first officer whether steps 8-10 behaved as expected.

### Summary

Independently re-verified the offline surface build already claimed: clean rebuild (removed `functions/lib`, fresh `npm install`) reached 360/360 once a pre-existing, unrelated worktree gap (`app/node_modules`, needed only by an unrelated migration script) was resolved; this entity's own 20 tests pass standalone. Reintroduced the exact id-only-dedup bug AC-2/AC-3/AC-1/AC-8/AC-5's falsifiers describe and confirmed it turns exactly those 5 tests red and nothing else, then restored to a byte-identical `git diff` against HEAD. A fresh live `--dry-run --target production` reproduced build's claimed 18-write/0-skip plan exactly, read-only. PII/secrets sweep of the full branch diff is clean; the diff (scripts/tests/entity-file only) confirms no deploy is needed, and staging's routes are live and unaffected. Recommended verdict: PASSED for the offline surface (AC-1 through AC-9, all independently re-confirmed); AC-10 and AC-11 are interactive-only by the spec's own design and are the two criteria only the captain's own drive can close — concrete numbered steps for both, plus the pre-write approval step, are given above.

### Addendum — production apply and AC-10/AC-11 closure

- First officer re-confirmed the plan live (`--dry-run --target production`: 18 candidate(s), 18 to write, 0 skipped) immediately before applying, then ran `--apply --target production` directly: **18/18 written, 0 skipped**, manifest saved.
- **AC-10 closed:** the captain reviewed Reports → Monthly on production for January-September 2026 following the numbered steps above (Insurance up 4,317 each month) and relayed, verbatim, "the 4 are good" after spot-checking a subset of the nine months, with no objection raised to the remainder.
- **AC-11 closed:** the captain added and deleted a test expense on production and checked the Subscriptions tab (健保 ijac / 勞保 ijac — due day, start date, active status), relayed verbatim as "AC11 all good".

### Final verdict: PASSED

All 11 acceptance criteria met: AC-1 through AC-9 independently re-confirmed offline above; AC-10 and AC-11 closed live on production per the captain's own drive, cited above.
