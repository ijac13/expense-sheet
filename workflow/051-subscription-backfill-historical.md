---
id: 051
title: Backfill Missing Historical Subscription Expense Entries
status: build
source: captain (found while scoping entity 050)
started:
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-051-subscription-backfill-historical
issue:
pr:
---

Entity 050 fixes subscription auto-add going forward, but explicitly excludes backfilling — the scheduler never ran successfully, so every month since Jan 2025 that should have generated an expense entry never did. An approximate check (matching by amount within the due month, ±2%) against the 21 currently-active subscriptions found the picture is mixed, not uniformly missing:

- Several subscriptions (the gym payments, a couple of others) are already ~100% covered — the captain has been logging these by hand consistently, so there's likely nothing to backfill there.
- Several others have real, substantial gaps: Libi 投資贊助 (7/20 months covered), 網路 中華電信 (8/20), Netflix (11/20), 0975379852 (12/20).

The amount-matching check is approximate — a price change, a bundled charge, or an unrelated expense of the same amount could produce a false positive or false negative. This needs a careful, subscription-by-subscription review before writing anything, not an automated blanket fill.

## User Stories

- As the captain, I want my expense history to actually reflect the recurring payments I made in 2025 and early 2026, so my spending totals and reports for that period are accurate.
- As the captain, I want to review what would be added before it's written, category by category, since a wrong guess here corrupts real historical financial data.

## Success

- For each active subscription with a real gap, historical expense entries exist for the months genuinely missing — not duplicated for months already logged by hand.
- The captain reviews and confirms the specific list of entries to be added before any write happens.
- The distinction between "genuinely missing" and "already logged, just not linked to the subscription" is resolved per subscription, not assumed either way.

### Out of Scope

- Changing the going-forward auto-add mechanism itself — entity 050.
- Subscriptions that are already fully or near-fully covered by existing manual entries.
- Any subscription no longer active today (only 2026-08 known subscriptions were checked; a cancelled subscription's history is a separate call).

## Plan

Re-run and tighten the gap analysis per subscription (date proximity, not just amount, to cut down false positives/negatives), present the specific candidate list to the captain for review, then write only the confirmed entries — using entity 050's own deterministic-id scheme so a backfilled entry is indistinguishable from one the scheduler would have generated, and so re-running this is itself idempotent.

## Spec

### Goal

Add the historical expense entries the never-running scheduler should have created between 2025-01 and today — but only the ones the captain confirms are genuinely missing, written with entity 050's deterministic id so a backfilled row is indistinguishable from a scheduler-generated one and re-running is a no-op.

### What the live data actually shows (production, traced read-only 2026-08-18)

The ideation's approximate check (amount within the due month, ±2%) is not merely imprecise — **every simple matching rule tested against the real sheet produces both false positives and false negatives, and they disagree with each other violently.** 1,974 expense rows, dates 2025-01-01 → 2026-08-18, 21 active subscriptions, zero `exp-auto-` ids present (the scheduler has not yet fired in production).

Four failure modes, each proven on real rows rather than hypothesised:

1. **The subscription's current amount is not the amount that was logged.** YouTube's subscription says NT$497; all 33 rows whose notes mention YouTube are NT$399. Netflix's says NT$380; all 16 rows mentioning Netflix are NT$560. Amount-matching therefore scores both at **0/20 covered** and would have proposed 40 duplicate rows for two subscriptions the captain has been logging faithfully for 17 and 16 months. A price change is the normal case here, not an edge case.

2. **Unrelated expenses collide on amount constantly.** 8 rows match Netflix's NT$380 exactly — under `eating-out`, `gifts`, `groceries`. 27 rows match 捐款 OFC's NT$800 — under `eating-out`, `groceries`, `car-repair`, `other`; **none** under `donate`, and no row anywhere mentions it. Month+amount matching scores 捐款 OFC at 19/20 "covered" purely from unrelated spending, which would silently skip a subscription that has in fact never been logged once.

3. **One subscription's rows get credited to another.** All 33 rows at NT$399 + `digital` belong to YouTube (every one mentions it in notes). 0928110757's subscription amount is also NT$399 in `digital`, and zero rows anywhere mention it — so an amount+category rule hands it YouTube's entire payment history and reports 17/20 covered. It is actually 0/20.

4. **Due day and notes text drift from the subscription record.** 0981811423 is due on day 26 at NT$850; it is logged on day **7** every month with the note `電信`, which contains nothing resembling the subscription's name. Date-proximity matching (±7d) scores it 0/19; notes matching scores it 1/19 off a single incidental mention. The truthful answer — visible only by looking at the NT$850 + `digital` cluster — is that it was logged monthly through 2026-04 and is missing only since 2026-05.

Two further structures shape the design:

- **Four subscriptions are mutually indistinguishable.** `ijac 健身`, `Wei 健身`, `公公健身`, `婆婆健身` all carry NT$788, `sports`, `due_day: 1`. Per-subscription attribution by amount, category or date is impossible; only counting rows per month works. Their notes do distinguish them, but only after normalisation — the sheet holds `ijac健身` (no space) and `wei 健身` (lowercase) against subscription names `ijac 健身` and `Wei 健身`.
- **A month can be logged in its neighbour.** 2026-03 holds **8** gym rows (two complete sets of four); 2026-04 holds **zero**. April was paid and logged early, in March. A per-month "is anything there?" test reports four missing April rows that would all be duplicates.

Net effect: a naive rule proposes ~161 rows, of which at least 4 (April gym) are provable duplicates, ~17 (0928110757) are wrongly suppressed, and 40 (YouTube + Netflix) flip between "all missing" and "all covered" depending on which rule is chosen. **No automatic rule is safe enough to write financial history unattended** — which is why the captain review below is the feature, not a formality.

### Decision: a two-phase script with a captain-edited decision file

Phase 1 (`--analyze`) reads the sheet and writes a per-subscription candidate report. Phase 2 (`--apply`) writes only what the captain marked. The two phases are separated by a file the captain edits by hand, so approval is a durable, reviewable artifact rather than a chat message, and phase 2 is reproducible by anyone from that file alone.

This follows entity 042's existing admin-script pattern (`functions/scripts/apply-insurance-tax-categories.js`: `--dry-run`, `--fixture`, `load-local-env.js`) rather than adding an endpoint or a UI screen. A one-off historical correction needs no permanent product surface, and shipping a "write arbitrary dated expenses" endpoint into a public-facing app for a one-time job would be a worse trade.

**The report contains the captain's real financial history and the GitHub remote is public** (flagged in 050's verify findings). It is therefore written to a gitignored path and never committed; only aggregate counts appear in the entity file.

### User Stories

- As the captain, I want to see, per subscription, exactly which months would be added and what evidence says they are missing, so I can catch a wrong guess before it touches real financial history.
- As the captain, I want nothing written unless I explicitly approve that subscription, so an unreviewed default can never corrupt my data.
- As the captain, I want backfilled entries to look exactly like the ones the scheduler creates from now on, so my history has one consistent shape rather than a visible seam at 2026-08.
- As the captain, I want to re-run the backfill safely if it half-finishes, so a network error mid-write does not leave me guessing what landed.

### Acceptance Criteria

**Analysis (read-only)**

- [ ] **AC-1 — Analysis performs zero writes.** `--analyze` opens the Sheets client with the `spreadsheets.readonly` scope only. Test: run the full analysis against a fixture whose write methods throw; it completes with exit code 0.
- [ ] **AC-2 — Expected occurrences reuse the scheduler's own semantics.** The occurrence generator imports `isDueOn` and `daysInMonth` from the deployed `functions/src/scheduler.ts` rather than reimplementing them. Test: a monthly `due_day: 31` subscription yields 2025-02-28, 2025-04-30 and 2026-02-28 (clamped, one per month, never doubled); an annual `due_month: 6, due_day: 2` subscription yields exactly one occurrence per calendar year. The test fails if the clamp is dropped or the import is replaced by a local copy.
- [ ] **AC-3 — Window is 2025-01-01 through the last already-passed due date.** No occurrence later than the date the analysis runs is ever proposed. Test: with the clock stubbed to 2026-08-18, a monthly `due_day: 23` subscription's last occurrence is 2026-07-23, not 2026-08-23.
- [ ] **AC-4 — Notes matching is normalised.** Comparison lowercases and strips all whitespace from both the subscription name and the expense note. Test: name `Wei 健身` matches note `wei 健身`, and name `ijac 健身` matches note `ijac健身`. The test fails if either side is compared raw.
- [ ] **AC-5 — A row can be claimed by only one subscription, and notes evidence wins.** Rows matched by some subscription's notes fingerprint are removed from every other subscription's amount+category evidence pool. Test (the real YouTube/0928110757 shape): sub A named `YouTube` with 33 note-matching rows at 399/`digital`, sub B named `0928110757` at 399/`digital` with no note-matching rows anywhere → B's evidence count is 0 and all its occurrences are candidates. The test fails if B is credited with A's rows.
- [ ] **AC-6 — Conflicting signatures are reported, never silently resolved.** When a subscription's notes evidence and its amount+category evidence disagree by more than one occurrence, the report lists **both** signatures with their row counts and marks the subscription `CONFLICTED`. Test (the real 0981811423 shape): 1 note-matching row versus 16 amount+category rows → `CONFLICTED`, both counts present in the report, no single signature chosen for it.
- [ ] **AC-7 — Coverage is counted per month, not tested as a boolean.** Occurrences consume evidence rows one-for-one within the same calendar month. Test: four subscriptions sharing amount, category and `due_day` against a month holding 4 matching rows → 0 missing across the cohort; against a month holding 3 → exactly 1 missing across the cohort (not 0, not 4).
- [ ] **AC-8 — Over-logged neighbouring months are flagged.** When a cohort's month holds more rows than that month expects and an adjacent month holds fewer, the shortfall month's candidates carry a `DOUBLE_LOGGED_NEIGHBOUR` flag naming the surplus month. Test (the real gym shape): 8 rows in 2026-03 against an expected 4, and 0 rows in 2026-04 → all four April candidates carry the flag.
- [ ] **AC-9 — Subscriptions with no evidence at all are marked distinctly.** A subscription with zero note-matching rows and zero unclaimed amount+category rows is classed `NO-EVIDENCE`, and the report states that the full span is proposed with nothing corroborating it. Test: a subscription matching nothing yields `NO-EVIDENCE` with a candidate count equal to its full occurrence count.
- [ ] **AC-10 — Report is human-readable and per-subscription.** The report is Markdown, one section per active subscription, each carrying: classification, the signature used and its row count, distinct amounts seen in that evidence, expected / covered / missing counts, the explicit missing dates, any flags, and a `decision:` line. Test: every active subscription in the fixture appears exactly once with all nine fields present.
- [ ] **AC-11 — Report is gitignored.** The report path is covered by `.gitignore` and no report file appears in `git status --porcelain` after an analysis run. Test asserts the path is ignored via `git check-ignore`.

**Apply (writes)**

- [ ] **AC-12 — Skip is the default and an unedited report writes nothing.** Every `decision:` line is generated as `skip`. Test: `--apply` against a freshly generated, unedited report performs zero write calls and reports 0 created.
- [ ] **AC-13 — Only `backfill`-marked subscriptions are written, and only their listed dates.** Test: a report with one subscription set to `backfill` and three left at `skip` writes rows for exactly that subscription's listed missing dates and no others.
- [ ] **AC-14 — The amount written is explicit per subscription.** Each section carries an `amount:` line defaulting to the subscription's current amount; when the evidence shows a different historical amount, the line is annotated with the amounts actually observed so the captain must confirm which to use. Test: a subscription whose evidence rows are all 399 while its record says 497 produces a report whose `amount:` line names both, and `--apply` writes whichever value the line holds.
- [ ] **AC-15 — Ids and row shape are byte-identical to the scheduler's.** Ids come from `autoExpenseId` imported from `functions/src/scheduler.ts` — `exp-auto-{subscription_id}-{YYYY-MM-DD}` — and rows are built by `buildWriteRow` against the live header map. Test: a row produced by the backfill and a row produced by `runSubscriptionScheduler` for the same subscription and date, against the same stub sheet, are deeply equal — same width as the live header (10 today), blanks at the `month` and `amount value` indices, and neither `status` nor `subscription_id` present.
- [ ] **AC-16 — Existing ids are never rewritten.** Before writing, the Expenses id column is read and any candidate whose id is already present is skipped and counted. Test: pre-seed the stub with one of the candidate ids → that row is not rewritten and is reported as skipped.
- [ ] **AC-17 — Re-running apply is a no-op.** Test: run `--apply` twice against the same stub with the same decision file — the second run creates 0 rows, reports the full set as skipped, and leaves the sheet's row count and every existing row's contents unchanged.
- [ ] **AC-18 — `--dry-run` prints the exact rows and writes nothing.** Test: `--apply --dry-run` against a stub whose write methods throw completes with exit code 0 and prints one line per row it would have written.
- [ ] **AC-19 — Partial failure is recoverable and reported.** If a write batch fails partway, the script reports which ids were written and exits non-zero; a re-run creates only the remainder (guaranteed by AC-16). Test: stub a rejection after the first batch → non-zero exit, the written ids named in the output, and a second run completing the rest.
- [ ] **AC-20 — Backfill and scheduler cannot collide.** A date backfilled by this script and later seen by the daily scheduler produces no second row, because both derive the same id. Test: apply a backfill for date D, then invoke `runSubscriptionScheduler` for date D against the same stub → `created_count: 0, skipped_count: 1`, row count unchanged.

**Live evidence (verify stage)**

- [ ] **AC-21 — Demonstrated live on staging.** Against the staging spreadsheet, seed a subscription and a partial history, run `--analyze`, hand-edit one decision to `backfill`, run `--apply`, and show with HTTP responses from staging `GET /api/`: the candidate rows absent before, present after with `exp-auto-…` ids, and unchanged after a second `--apply`. Code inspection is not evidence for this AC.

### Edge Cases

- **Price changed mid-window** (YouTube NT$497 now vs NT$399 logged; Netflix NT$380 vs NT$560) — the amount is never used as the sole coverage signal, and AC-14 forces the captain to state which amount a backfilled row should carry.
- **Unrelated expense coincidentally matching a subscription's amount in its due month** (8 rows at Netflix's NT$380 under `eating-out`/`gifts`/`groceries`; 27 at 捐款 OFC's NT$800, none under `donate`) — amount+category evidence is reported as a weaker tier than notes evidence, and a subscription whose only "coverage" is an unclaimed amount cluster in the wrong category surfaces as `NO-EVIDENCE`.
- **Two subscriptions sharing an amount and category** (YouTube and 0928110757 both NT$399 `digital`) — AC-5's single-claim rule prevents one from absorbing the other's history.
- **Four subscriptions identical in amount, category and due day** (the gym cohort) — per-month counting (AC-7) replaces per-row attribution; the report presents them as a group so the captain sees "3 of 4 present in 2025-11" rather than four independent guesses.
- **A month logged inside its neighbour** (8 gym rows in 2026-03, 0 in 2026-04) — flagged by AC-8 rather than proposed blindly.
- **Due day changed or never matched reality** (0981811423 due day 26, logged day 7) — coverage is matched within the calendar month rather than by proximity to the due day, so a consistent offset does not read as 19 missing months.
- **Notes spelled differently from the subscription name** (`ijac健身` vs `ijac 健身`, `wei 健身` vs `Wei 健身`) — normalisation in AC-4.
- **Subscription started or was cancelled mid-window.** The Subscriptions tab has no created/started column, so this cannot be resolved automatically. Two bounds are reported and neither is applied silently: the `sub-<epoch-ms>` id decodes to when the *record* was created (four subscriptions were created 2026-07-29, three weeks ago), and the earliest evidence row gives when logging actually began. Where a subscription's proposed span starts before both bounds, the report says so explicitly — the extreme case is a subscription created 2026-07-29 with no corroborating row in 19 months, for which a full 20-month backfill is a pure guess and defaults to `skip`.
- **A due date in the future** (a day-23 subscription on 2026-08-18) — excluded by AC-3; the scheduler will create it on the day.
- **Annual subscriptions** (5 of the 21) — one occurrence per year in `due_month`, clamped like any other; the small occurrence count means a single wrong match flips the whole result, so their evidence is reported the same way rather than being auto-approved.
- **The scheduler fires while the backfill is being reviewed** — no interaction: different dates, and identical ids on any overlap (AC-20).
- **Expenses header renamed or reordered mid-run** — `buildColumnMap` throws `SheetSchemaError` and the script halts before writing, inheriting entity 047's guarantee rather than writing into the wrong column.
- **Report edited into an invalid state** (unknown decision word, a date not in the candidate list, a non-numeric amount) — the apply phase halts with the offending line quoted and writes nothing, rather than guessing intent.

### Out of Scope

- The going-forward auto-add mechanism itself (entity 050, shipped).
- The 10 cancelled subscriptions. Only the 21 active ones are analysed; a cancelled subscription's history is a separate call, carried from the entity's own scope.
- Adding a `subscription_id` or `started_at` column to the sheet. The deterministic id carries the link, per 050's own out-of-scope reasoning.
- Populating the `month` / `amount value` helper columns — left blank, matching `POST /api` and the scheduler.
- Correcting or de-duplicating existing hand-logged rows, including the double-logged 2026-03 gym set. This entity only adds genuinely missing rows; it never edits or deletes an existing one.
- Retagging historical rows to the categories their subscription now uses.
- Multi-currency handling (entity 009).
- Any automatic "just fill everything that looks missing" mode. The captain-edited decision file is mandatory by design.

### Prerequisite to flag before build

The apply phase needs **write** access to the production spreadsheet from a local script. This spec's analysis was run with the `spreadsheets.readonly` scope and confirmed working from `.env.local` via `functions/scripts/load-local-env.js`; write access from that same service account was deliberately not exercised, since no write may happen during spec. Entity 042 is currently blocked on `captain-action:production-sheets-credentials` — the same axis. Build should prove the write path against the **staging** spreadsheet first and treat production write access as a captain-action gate.

## Stage Report: spec

- DONE: Write the formal spec using the Spec Template (Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope) from the ideation body already in workflow/051-subscription-backfill-historical.md
  All five template sections present, plus a live-findings section and an explicit design decision (two-phase script + captain-edited decision file, following entity 042's admin-script precedent rather than a new endpoint or UI).
- DONE: Acceptance criteria must be binary/independently testable — especially: how "genuinely missing" is distinguished from "already logged by hand," how the per-subscription candidate list is presented to the captain for review before any write, and the exact backfill id scheme (must reuse entity 050's deterministic exp-auto-{subscription_id}-{date} scheme so backfilled rows are indistinguishable from scheduler-generated ones and re-running stays idempotent)
  21 ACs, each naming a test and the change that breaks it. "Genuinely missing" is AC-4 through AC-9 (normalised notes evidence, single-claim rule, conflict reporting, per-month counting, no-evidence class). Presentation is AC-10/AC-11 (nine fields per subscription, gitignored) and AC-12/AC-13 (skip is the default; an unedited report writes nothing). The id scheme is AC-15, which requires importing `autoExpenseId` from `functions/src/scheduler.ts` and asserts a backfilled row is deeply equal to one `runSubscriptionScheduler` builds for the same subscription and date; AC-17 and AC-20 cover idempotency and scheduler overlap.
- DONE: Edge cases: subscriptions with a price change mid-period (amount-match false negative), an unrelated real expense coincidentally matching a subscription's amount in the due month (false positive), a subscription active only part of the 2025-01..2026-08 window (started or cancelled mid-window), a subscription whose due day changed
  All four are in the spec with a real production example rather than a hypothetical: price change (YouTube NT$497 record vs NT$399 logged; Netflix NT$380 vs NT$560), coincidental amount match (8 unrelated rows at Netflix's amount; 27 at 捐款 OFC's, none in its category), partial-window (no started column exists — two bounds reported, `sub-<epoch>` record creation and earliest evidence row, neither applied silently), changed due day (0981811423 due day 26, logged day 7 every month). Seven further edge cases found in the data were added, including two the checklist did not anticipate.
- DONE: Confirm scope boundary: no write of any kind happens during spec — this stage produces the spec and the candidate methodology only, not the backfill itself
  Every probe used the `spreadsheets.readonly` OAuth scope; no write API was called and no candidate row was created. Probe scripts were written to the session scratchpad, not the repo. The one thing deliberately left unproven is write access to the production sheet — flagged in the spec as a build prerequisite.

### Summary

Tracing the live sheet turned the ideation's "the amount check is approximate" into something much stronger: **no simple rule is safe, and the rules contradict each other.** Amount-matching scores YouTube and Netflix at 0/20 covered, when the captain has in fact logged both for 16–17 straight months at a different price — 40 duplicate rows if trusted. Month+amount scores 捐款 OFC at 19/20 covered off unrelated groceries and eating-out, when it has never been logged once. And an amount+category rule hands 0928110757 all 33 of YouTube's payments, since both are NT$399 in `digital` — its true coverage is zero. A naive pass proposes ~161 rows; at least 4 are provably duplicates (April's gym payments were logged in March, which is why 2026-03 holds 8 gym rows and 2026-04 holds none).

So the spec makes the review the feature rather than a formality: evidence is tiered with notes beating amount, a row can be claimed by only one subscription, coverage is counted per month (the four gym subscriptions are identical in amount, category and due day, so per-row attribution is impossible), conflicts are surfaced rather than resolved, and every subscription defaults to `skip` so an unedited report writes nothing.

Two things worth the captain's attention at the gate. First, the candidate report holds real financial history and this GitHub remote is public, so the spec requires it to be gitignored and keeps only aggregate counts in this file — tell me if you would rather it live entirely outside the repo. Second, the highest-risk item is a subscription created three weeks ago (2026-07-29) with no corroborating row anywhere in 19 months of data, for which the naive rule proposes a full 20-month backfill; the spec defaults it to `skip` and asks you to decide, because nothing in the sheet can tell us whether that payment was actually being made in 2025.

## Stage Report: build

- DONE: Implement --analyze (read-only, spreadsheets.readonly scope only): occurrence generation must import isDueOn/daysInMonth from functions/src/scheduler.ts rather than reimplementing them (AC-2), window is 2025-01-01 through the last already-passed due date only (AC-3), notes matching normalizes case/whitespace on both sides (AC-4)
  `functions/scripts/backfill-subscription-history.js`; the AC-1 test captures the scopes actually requested (`[spreadsheets.readonly]`) against a sheet whose write methods throw, and asserts zero mutating requests reached it.
- DONE: Implement the single-claim evidence rule ... mark CONFLICTED rather than silently picking one (AC-5, AC-6)
  Fixtures are the real shapes: 0928110757 scores 0 rows beside YouTube's 19 at 399/`digital`; 0981811423 reports notes=1 / amount+category=16 and is CONFLICTED with neither signature chosen.
- DONE: Coverage must be counted per calendar month across a cohort ... DOUBLE_LOGGED_NEIGHBOUR ... NO-EVIDENCE with its full span proposed (AC-7, AC-8, AC-9)
  Gym cohort of 4: 4 rows → 0 missing, 3 rows → exactly 1, 1 row → 3. 8 rows in 2026-03 with none in 2026-04 flags all four April candidates `DOUBLE_LOGGED_NEIGHBOUR(2026-03)`. 捐款 OFC, whose only lookalikes sit in `groceries`, comes back NO-EVIDENCE with all 20 occurrences proposed.
- DONE: Report is Markdown, one section per active subscription with all required fields (AC-10), and the report path must be gitignored — confirm via git check-ignore, not just by convention (AC-11)
  `git check-ignore -v functions/backfill-reports/candidates.md` → `.gitignore:39`, and `git status --porcelain` after a real analysis run lists no report file.
- DONE: Implement --apply (writes): decision defaults to skip (AC-12); only backfill-marked subscriptions and only their listed dates (AC-13); amount explicit with historical annotation (AC-14)
  Unedited report → empty plan, 0 created, zero write calls. One section flipped to `backfill` among five writes only its two listed dates. YouTube's `amount:` line carries both 497 and 399; apply writes whichever value the line holds.
- DONE: Ids and row shape must be byte-identical to the scheduler's ... deep-equal test against a row runSubscriptionScheduler would produce (AC-15)
  `assert.deepEqual(backfilled, schedulerRow)` against the row the scheduler actually wrote to the same stub — 10 wide, blanks at `month`/`amount value`, no `status`/`subscription_id` column to occupy.
- DONE: Existing ids are never rewritten (AC-16); re-running --apply creates 0 rows the second time (AC-17); --dry-run writes nothing and prints the rows it would write (AC-18)
  Pre-seeded id survives byte-identical and counts as skipped; second apply reports created=0/skipped=3 with every row unchanged; dry-run against throwing write methods prints one line per row and leaves the sheet empty.
- DONE: Partial-failure recovery (AC-19); backfill and scheduler cannot collide (AC-20)
  Batch 2 rejected → typed `PartialWriteError` naming the one id that landed; re-run completes the remaining 2 and skips 1. Scheduler run on a backfilled date returns `created 0 / skipped 1`, row count unchanged.
- DONE: Self-check every AC against a fixture/stub before marking build complete — do not run --apply against the real production or staging spreadsheet during build
  35 new tests pass, 114/114 across the suite (no regressions). No `--apply` was run against any real spreadsheet. Falsifiability was checked by mutation rather than assumed: dropping the single-claim rule, removing notes normalisation, making coverage a per-month boolean, skipping the existing-id filter, replacing `autoExpenseId` with a local scheme, and defaulting `decision:` to `backfill` each break 1–5 tests; all six restore green.
- DONE (blocked during build, resolved after — see Addendum): Prove the write path against staging, not production, during build
  At build time, the staging service-account key in `functions/.env.staging` was unusable: the value had no PEM armour and was missing its leading character (started `IIEvQIBADANBgkq…`, no `-----BEGIN/END PRIVATE KEY-----`), so even a read-only staging run died at `error:1E08010C:DECODER routines::unsupported`. The build ensign did not attempt to reconstruct the key and correctly deferred the live write proof to verify's AC-21. The captain re-exported the key post-build; the write path is now proven live on staging — see Addendum below for the full seed/analyze/apply/re-apply/cleanup evidence.

### Summary

The script is `functions/scripts/backfill-subscription-history.js` — two phases (`--analyze`, `--apply`) split by a gitignored Markdown report the captain edits by hand, following entity 042's admin-script precedent. Occurrence generation and row construction import `isDueOn`, `daysInMonth` and `autoExpenseId` from the compiled scheduler rather than copying them, and one test pins the generated dates to the dates `runSubscriptionScheduler` actually fires on, so a future local copy would break the build rather than drift silently.

The design decision worth flagging: coverage is computed three times per subscription — notes-only, amount+category-only, and combined. The first two exist only to detect disagreement, and any gap wider than one occurrence marks the subscription `CONFLICTED` with both signatures printed and neither chosen. That deliberately over-flags: YouTube comes back CONFLICTED (19 notes rows vs 0 amount matches) even though its notes evidence is plainly the right read. Over-flagging costs the captain a glance; under-flagging writes wrong financial history, and every section defaults to `skip` regardless.

Two things need the captain before this can go further. **`captain-action:production-sheets-credentials`** — the apply phase needs write access to the production spreadsheet, the same axis entity 042 is blocked on. And a new one found during build: **the staging credentials are broken**, so the staging demonstration AC-21 reserves for verify cannot run until that key is re-exported with its PEM armour intact. My checklist also contradicted itself on this point — item 9 forbade running `--apply` against staging during build, item 10 required proving the write path against staging during build; I took the conservative reading and ran nothing live, so the live write proof is entirely verify's, and it is blocked until the key is fixed.

### Addendum (FO + captain, post-build)

Both blockers above are resolved as of this addendum:

- **Staging key fixed.** Captain re-exported a fresh JSON key for `expense-tracker-staging@expense-sheet-staging.iam.gserviceaccount.com` from Google Cloud Console (the old value in `functions/.env.staging` was an unrecoverable partial copy — Google never re-shows a private key after creation, so a new key was the only path). Verified byte-for-byte round-trip after being written into `functions/.env.staging` (gitignored, confirmed via `git check-ignore`), and a live read against the staging spreadsheet succeeded.
- **AC-21 proven live on staging, by the FO directly with captain's explicit go-ahead** (not a fresh build/verify ensign dispatch — this was a direct capability spike, same pattern as this session's other live-evidence checks): seeded a throwaway subscription (`AC21-TEST`, NT$100/mo) plus 2 matching expense rows (Jan/Feb 2025) on staging. `--analyze` correctly reported it PARTIAL, 18 missing months. Hand-edited its `decision:` to `backfill`. `--apply` created exactly 18 rows with the correct `exp-auto-sub-1787112835217-{date}` ids, confirmed present via `GET /api` on staging. A second `--apply` created 0 and skipped all 18 — idempotency confirmed live, not just in fixtures. All test data (18 backfilled rows, the 2 seed rows, the test subscription) deleted/deactivated from staging afterward.
- **Production write access**: not yet exercised. Same credential path that works for production reads (`functions/scripts/load-local-env.js` + root `.env.local`) is expected to work for writes too, per entity 042's precedent (042's writes were eventually refused only by the sandbox's own auto-mode classifier, not a credential problem, and succeeded on retry/captain's own terminal). Not yet attempted for this entity.
- **Captain's actual decision file for the real production backfill** (148 rows across 20 subscriptions, ~NT$589,000, 2 subscriptions left at skip) was reviewed line-by-line with the captain in chat, including catching and correcting two cases where a live data edit after the report was generated would have caused duplicate writes (0981811423's amount edit orphaning its own history from amount-matching; 房貸 turning out to already have 7 months logged that a naive "backfill everything since Jan" would have doubled). This decision file lives only in the worktree (gitignored `functions/backfill-reports/candidates.md`) — it is the actual write plan for entity 051's real goal, distinct from the AC21-TEST proof above.
