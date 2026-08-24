---
id: 054
title: Normalize category_id to Live cat_NNN Scheme
status: verify
source: captain
started:
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-054-normalize-category-ids
issue:
pr:
---

Production's Expenses (and Subscriptions) `category_id` column is a genuine mix: 12 distinct values are live `cat_NNN` ids from the Categories tab, and 23 are legacy slugs (`groceries`, `eating-out`, `tax`, ...) left over from before the app had a live category system. The app still displays these correctly today only because of a bridge function (`resolveCategory()` in `app/app/lib/categories.ts`, added for entity 044): a slug id is matched against a hardcoded `DEFAULT_CATEGORIES` list by id, then bridged to the live category of the same `name_en`. It works, but it's a two-hop, name-matching workaround standing in for a direct id match — if a category is ever renamed in the sheet, or the hardcoded list drifts from it, every row still using the old slug for that category silently loses its live icon/data with no error.

## User Stories

- As the captain, I want every expense and subscription row to reference a real, current category id, so display doesn't depend on a name staying in sync between a hardcoded list and the live sheet.
- As the captain, I want to know if a row's category can't be resolved at all, rather than have it silently render however the fallback happens to guess.

## Success

- Every `category_id` value in the Expenses and Subscriptions tabs is a live `cat_NNN` id from the current Categories tab.
- `resolveCategory()`'s slug-bridging path becomes dead code after migration (kept or removed is a build-stage call, not a design commitment here).

### Out of Scope

- Changing how new expenses/subscriptions get their category_id going forward — entity 044 already resolves display correctly, and this entity is about the stored data, not the write path (unless the migration surfaces a write-path gap that also needs fixing).
- Any category renaming or restructuring — this only remaps existing ids, it does not change what categories exist.

## Plan

Following entity 042/051's precedent: a local admin script, `--dry-run` first, run manually against production with the captain's explicit go-ahead — not a new app feature. Build the slug→live-id mapping from the same `DEFAULT_CATEGORIES` name-matching logic `resolveCategory()` already uses (so the migration and the thing it's retiring agree by construction), rewrite every legacy-slug `category_id` cell in Expenses and Subscriptions to the matched live id, and halt rather than guess on any slug with no live-name match.

---

## Spec

### Goal

Rewrite every legacy-slug `category_id` value stored in the production Expenses and Subscriptions tabs to the live `cat_NNN` id it already resolves to today, so category display is a direct id match against the live Categories tab instead of a two-hop name-matching bridge that breaks silently on a rename.

### User Stories

- As the captain, I want every expense and subscription row to reference a real, current category id, so display doesn't depend on a name staying in sync between a hardcoded list and the live sheet.
- As the captain, I want the migration to stop and tell me if any row's category can't be mapped, rather than guess or silently skip it.
- As the captain, I want to see exactly what the migration will change before it changes anything, and to be able to re-run it safely if I'm unsure whether it completed.

### Live Baseline

Traced read-only against the production spreadsheet on 2026-08-21, applying `resolveCategory()`'s own logic (live id match → `DEFAULT_CATEGORIES` id → live category with the same `name_en`). This is the observed state the acceptance criteria below are written against; the build stage must re-derive it at run time rather than hardcode it, because the sheet is live.

Production Categories tab: 25 rows, `cat_001`–`cat_025`, all `is_active` true, all `name_en` values distinct, none with leading/trailing whitespace.

Expenses — 2133 data rows, 35 distinct `category_id` values: 12 already-live `cat_NNN` (102 rows) and 23 legacy slugs (2031 rows).

| Legacy slug | Rows | Resolves to | Legacy slug | Rows | Resolves to |
|---|---|---|---|---|---|
| `eating-out` | 643 | `cat_001` Eating Out | `car-repair` | 24 | `cat_019` Car Repair |
| `groceries` | 233 | `cat_003` Groceries | `entertainment` | 24 | `cat_016` Entertainment |
| `digital` | 222 | `cat_007` Digital | `clothing` | 21 | `cat_009` Clothing |
| `fuel` | 156 | `cat_015` Fuel | `gifts` | 21 | `cat_011` Gifts |
| `tolls` | 138 | `cat_013` Tolls | `donate` | 20 | `cat_020` Donate |
| `sports` | 102 | `cat_010` Sports | `insurance` | 6 | `cat_024` Insurance |
| `daily-necessities` | 99 | `cat_002` Daily Necessities | `other` | 6 | `cat_022` Other |
| `transportation` | 98 | `cat_006` Transportation | `tax` | 3 | `cat_025` Tax |
| `babies` | 51 | `cat_008` Babies | `equipment` | 3 | `cat_014` Equipment |
| `medical` | 46 | `cat_004` Medical | `rent` | 1 | `cat_017` Rent |
| `travel` | 41 | `cat_005` Travel | | | |
| `tuition` | 37 | `cat_012` Tuition | | | |
| `shopping` | 36 | `cat_018` Shopping | | | |

Already-live in Expenses (left untouched): `cat_020` (50), `cat_021` (20), `cat_015` (8), `cat_001` (7), `cat_023` (4), `cat_002` (3), `cat_024` (3), `cat_019` (2), `cat_022` (2), `cat_006` (1), `cat_003` (1), `cat_004` (1).

Subscriptions — 37 data rows, 10 distinct values: 2 already-live (`cat_024` ×5, `cat_021` ×1) and 8 legacy slugs (31 rows): `digital` 13 → `cat_007`, `babies` 6 → `cat_008`, `sports` 5 → `cat_010`, `entertainment` 2 → `cat_016`, `donate` 2 → `cat_020`, `tax` 1 → `cat_025`, `daily-necessities` 1 → `cat_002`, `rent` 1 → `cat_017`.

**Every slug currently in use maps cleanly — there are zero unmappable values today.** The halt behaviour below is therefore a guard, not a path this run is expected to take. Note that several slugs merge into an id already in use (`donate` + `cat_020`, `eating-out` + `cat_001`, `fuel` + `cat_015`, `daily-necessities` + `cat_002`, `transportation` + `cat_006`, `groceries` + `cat_003`, `medical` + `cat_004`, `car-repair` + `cat_019`, `other` + `cat_022`, `insurance` + `cat_024`); this is the intended collapse of two representations of one category, not a collision.

### Acceptance Criteria

**Migration correctness**

| # | Criterion |
|---|---|
| AC-1 | After a successful run, every non-empty `category_id` cell in the Expenses tab equals the `id` of a row present in the live Categories tab. Zero cells match a `DEFAULT_CATEGORIES` slug. |
| AC-2 | After a successful run, the same holds for every non-empty `category_id` cell in the Subscriptions tab. |
| AC-3 | Each rewritten cell's new value equals what `resolveCategory(oldValue, liveCategories).id` returns for that cell's old value — the script derives the mapping from `resolveCategory()`'s own logic (live-id match, then `DEFAULT_CATEGORIES` id → live `name_en` match) rather than a separately maintained table. |
| AC-4 | Expenses row count is unchanged at 2133 and Subscriptions at 37; per-category row totals after the run equal the pre-run totals summed across each slug and its live twin (e.g. `cat_001` = 643 + 7 = 650, `cat_020` = 20 + 50 = 70, `cat_015` = 156 + 8 = 164). |

**Safety and operation**

| # | Criterion |
|---|---|
| AC-5 | The migration is a local admin script under `functions/scripts/`, run manually via `node -r ./scripts/load-local-env.js …` following entity 042/051's precedent. No app route, API endpoint, scheduled function, or UI surface is added or changed. |
| AC-6 | Invoked with `--dry-run`, the script performs zero writes and prints the complete planned change set: per tab, each old value, its target live id, and the affected row count. Confirmed by the sheet being byte-identical after a `--dry-run` (spot-check via row count and a re-read of the distinct-value tally). |
| AC-7 | If any non-empty `category_id` value resolves to no live category — a slug absent from `DEFAULT_CATEGORIES`, a slug whose `name_en` has no live twin, or a `cat_NNN` id not present in the live Categories tab — the script exits non-zero having written nothing, naming every unmappable value and its row count. It does not skip the row and continue. This halt applies in `--dry-run` and live mode alike. |
| AC-8 | Re-running the script immediately after a successful live run reports zero rows to change and performs zero writes (exit 0). |
| AC-9 | For every touched row, only the `category_id` cell changes; `id`, `date`, `amount`, `paid_by`, `created_by`, `notes`, `created_at` (Expenses) and `id`, `name`, `amount`, `frequency`, `due_day`, `due_month`, `paid_by`, `is_active` (Subscriptions) are byte-identical before and after. Verified by diffing a full pre-run and post-run snapshot of both tabs. |
| AC-10 | No row is added or deleted, no column is added, removed, or reordered, and the Categories tab is not written to at all. |
| AC-11 | The script locates the `category_id` column by header name via `functions/lib/sheetSchema`'s `buildColumnMap`, not by a hardcoded column letter or index, so a reordered sheet cannot cause it to overwrite the wrong field. |

**Post-migration display**

| # | Criterion |
|---|---|
| AC-12 | After the run, History, Reports (including the category breakdown and DrillDown), the Subscriptions list, and the expense edit sheet each render every row's category name and icon from the live Categories tab — no raw `cat_NNN` text and no fallback placeholder icon. |
| AC-13 | **(Gate amendment — Surfaced Gap 2, folded in)** `TodayExpenseList` (`app/app/components/TodayExpenseList.tsx:24-25,37`) switches from a direct `DEFAULT_CATEGORIES.find(c => c.id === exp.category_id)` lookup to `resolveCategory()`, matching every other consumer since entity 044. After the run, the Home screen's today-list renders each row's real category name and icon, not the generic `Package` icon or a raw `cat_NNN` string. This is the one surface entity 044 didn't reach, and this migration makes the bug universal (currently only the 102 already-live rows trigger it) if left unfixed. |

### Edge Cases

- **A row already carrying a live `cat_NNN` id.** 102 Expenses rows and 6 Subscriptions rows are already correct. These must be recognised as already-correct and excluded from the write set — not written with an identical value. AC-6's dry-run output must show them as "already live", so a reviewer can tell "nothing to do" apart from "silently skipped".
- **A blank / empty `category_id` cell.** Zero exist today in either tab (verified: no empty string, no missing cell, no untrimmed value). If one appears at run time it must be left untouched and reported in the summary as blank — it is neither mappable nor an error, and blanking is not something the migration should try to fix.
- **A legacy slug whose live twin was renamed or deactivated since the slug was assigned.** `resolveCategory()` matches on exact `name_en`, so a rename breaks the bridge and the row silently falls back to the baked-in `DEFAULT_CATEGORIES` entry — wrong icon, no live `note`, and no error anywhere. This is the failure mode the entity exists to eliminate. Verified zero cases today (all 25 live categories active, every `DEFAULT_CATEGORIES` `name_en` has an exact live twin). If one appears between now and the run, AC-7's halt catches it and the captain decides the mapping by hand rather than the script guessing.
- **Two live categories sharing a `name_en`.** `resolveCategory()` uses `find`, silently taking the first. Zero duplicates today; the script must treat a duplicate `name_en` in the live list as a halt condition under AC-7 rather than picking one.
- **Whitespace.** `resolveCategory()` compares with `===` and the API's `rowToCategory`/`rowToExpense` do not trim, so a trailing space in either a stored `category_id` or a live `name_en` defeats the match. Zero untrimmed cells today. The script must compare on raw values (matching app behaviour) and route any value that fails to match into AC-7's halt, rather than trimming to force a match.
- **The four `resolveCategory()` bridge cases.** (1) live-id match — unaffected, this becomes the only path. (2) legacy-slug match via `name_en` bridge — this migration eliminates it for all 2062 rows that use it today. (3) legacy slug with no live twin, falling back to the baked-in entry — zero cases today, halts under AC-7 if one appears. (4) value in neither list, returning `undefined` — zero cases today, halts under AC-7.
- **Does `resolveCategory()`'s bridge become dead code?** On production data, yes: once every stored value is a live `cat_NNN`, the first branch hits every time and the slug branch never executes. **Removing it is explicitly out of scope for this entity**, and it must not be deleted as part of this work, because three things still reach it: the write path still emits slugs (see below), `localStorage`'s `expense_last_category_id` may hold a slug from before the migration, and every consumer falls back to `DEFAULT_CATEGORIES` when `GET /api/categories` fails. Deleting the bridge is a separate entity, gated on the write-path fix landing.
- **Offline after migration.** When the live fetch fails, the category list falls back to `DEFAULT_CATEGORIES`, which contains no `cat_NNN` ids — so a migrated row resolves to nothing and renders a placeholder. Today the same row resolves fine offline via its slug. This is a real (if minor and transient) regression the migration introduces; it is recorded here rather than fixed, since the offline fallback list is not this entity's subject.

### Surfaced Gaps — captain decision needed

The ideation puts the write path out of scope *"unless the migration surfaces a write-path gap that also needs fixing."* Tracing the live data surfaced two concrete problems. Neither is caused by the migration script being wrong; both are pre-existing and are made worse or made universal by the migration succeeding.

1. **The write path still creates new legacy slugs, so the migration does not stay done.** `getDefaultCategory()` (`app/app/lib/categories.ts:162-167`) returns `DEFAULT_CATEGORIES[0].id` — the slug `eating-out` — whenever nothing is stored, and its guard `DEFAULT_CATEGORIES.find(c => c.id === stored)` *rejects* a live `cat_NNN`, so even after the user picks a live category and `saveLastCategory("cat_001")` runs, the next load discards it and returns to `eating-out`. `handleConfirm()` (`app/app/page.tsx:99`) posts that value unchanged, and `POST /api/expenses` (`functions/src/index.ts:729`) stores whatever string it is given without validating it against the Categories tab. The new-subscription and edit-subscription forms default the same way (`app/app/subscriptions/page.tsx:53,114`). Result: a fresh page load followed by an amount and Confirm writes a brand-new `eating-out` row, and legacy slugs begin re-accumulating the moment the migration finishes.
2. **`TodayExpenseList` will show every row as raw `cat_NNN`.** `app/app/components/TodayExpenseList.tsx:24-25,37` looks up `DEFAULT_CATEGORIES.find(c => c.id === exp.category_id)` directly — it was missed when entity 044 introduced `resolveCategory()`. Post-migration that lookup returns `undefined` for every row, so line 25 renders the generic `Package` icon and line 37 prints the raw id (`cat_001`) as the category label. This is precisely the symptom entity 044 exists to fix, on the one surface 044 did not reach. It already affects the 102 rows that carry live ids today; the migration makes it universal, so it is visible on the home screen immediately after the run.

**Gate decision:** (2) is folded into this entity as AC-13. (1) is filed as its own entity (058), to be scheduled before or alongside actually running this migration against production — a durable fix touches the default-category logic, both subscription forms, and arguably API-side validation, which is a larger change than a data migration should carry, but leaving it unfixed means the migration doesn't stay done.

### Out of Scope

- Renaming, adding, removing, merging, or reordering categories — this only remaps existing ids to their current live equivalents; which categories exist is unchanged, and the Categories tab is not written to.
- Changing how new expenses and subscriptions get their `category_id` going forward — see Surfaced Gaps (1), which recommends a separate entity rather than expanding this one.
- Removing `resolveCategory()`'s slug-bridge path, `DEFAULT_CATEGORIES`, or `CATEGORY_ICONS` — the bridge becomes dead on production data but stays as the offline and legacy guard.
- Backfilling, correcting, or re-categorising any row's *choice* of category — a row filed under the wrong category stays under the wrong category, remapped to that category's live id.
- Any change to staging, or to the local fallback list used when the categories fetch fails.
- The Categories tab's unmapped column H (`notes` in the sheet vs `note` in `CATEGORIES_SPEC`) — unrelated to `category_id` and left exactly as found.

## Stage Report: spec

- DONE: Write the formal spec using the Spec Template (Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope) from the ideation body already in workflow/054-normalize-category-ids.md
  Spec added at `workflow/054-normalize-category-ids.md:38`; all five template sections present plus a Live Baseline and a Surfaced Gaps section.
- DONE: Trace the exact current mapping live against production before writing ACs
  Ran a read-only trace against the production spreadsheet (`node -r ./scripts/load-local-env.js` from `functions/`, `spreadsheets.readonly` scope) applying `resolveCategory()`'s own logic. Confirmed the ideation's counts exactly: Expenses 2133 rows / 35 distinct values = 12 live `cat_NNN` + 23 slugs; Subscriptions 37 rows / 10 distinct = 2 live + 8 slugs. Full slug→`cat_NNN` table with per-slug row counts recorded in Live Baseline.
- DONE: flag explicitly any slug that has NO live-name match
  Zero unmappable values — every one of the 23 Expenses slugs and 8 Subscriptions slugs bridges to a live `cat_NNN` via an exact `name_en` match. Recorded in Live Baseline; AC-7 keeps the halt as a guard for drift between now and the run.
- DONE: Acceptance criteria must be binary/independently testable, covering [the five listed items]
  AC-1/AC-2 (every cell a live id), AC-5 (`--dry-run`-first local admin script per 042/051, never an app endpoint), AC-7 (halt non-zero having written nothing, not skip), AC-8 (re-run is a no-op), AC-9/AC-10 (only the `category_id` cell changes, verified by full pre/post snapshot diff). AC-4 pins exact expected post-run per-category totals so a partial run is detectable.
- DONE: Edge cases [renamed/deactivated twin; already-live id; blank cell; the four resolveCategory() bridge cases; bridge-as-dead-code question]
  All covered under Edge Cases, each with its live-verified count (zero renamed, zero deactivated, zero blank, zero untrimmed, zero duplicate `name_en`; 102 + 6 rows already live). Added two cases the checklist did not name but the trace exposed: duplicate live `name_en` and whitespace-defeated `===` matching. The dead-code question is answered plainly: the bridge does become dead on production data, and removing it is explicitly out of scope and must not be done here.
- DONE: Confirm scope boundary
  Out of Scope holds the line — remap only, no category changes, no write-path change, no bridge removal. Kept per the checklist despite the finding below.
- DONE: Surfaced two pre-existing gaps the trace exposed, routed to the captain rather than absorbed
  The ideation's "unless the migration surfaces a write-path gap" clause fired. Recorded in Surfaced Gaps with a recommendation instead of a unilateral scope change.

### Summary

Traced the mapping live against the production sheet rather than inferring it, which confirmed the ideation's counts exactly and established that zero values are unmappable today — so the migration's halt path is a guard against drift, not an expected branch. The spec's ACs are pinned to concrete observed numbers (2133/37 rows, exact per-category post-run totals) so a partial or double run is detectable rather than a matter of judgment.

Two pre-existing defects surfaced that the migration would expose rather than cause, and both need a captain call at this gate: the write path still emits the `eating-out` slug on every fresh page load (`getDefaultCategory()` actively rejects a stored live id), so migrated data starts re-dirtying immediately; and `TodayExpenseList.tsx` never adopted `resolveCategory()`, so post-migration it renders every home-screen row as the raw text `cat_001` with a placeholder icon. I recommend folding the second into this entity and tracking the first separately.

## Stage Report: build

**Attribution.** AC-1 through AC-11 were built by a prior build ensign that died mid-response; its work is commit `6be0730`, independently verified by the FO before commit. I re-ran its suite and read the script, but did not re-derive its live-sheet trace — those lines are reported, not re-earned. AC-12's display proof and all of AC-13 are mine (commit `e0450b4`).

- DONE: AC-1 / AC-2 — every non-empty `category_id` in both tabs equals a live Categories id after a run
  `functions/scripts/normalize-category-ids.js` (`6be0730`). Test "AC-1/AC-2: after a live run no non-empty category_id is a slug" fails if any slug row is left out of the write set.
- DONE: AC-3 — each new value equals `resolveCategory(old, live).id`, derived at run time, not from a second table
  The script calls the app's own compiled `resolveCategory` (hence the `npm --prefix ../app run build:lib` precondition). Test "AC-3: every rewritten value equals resolveCategory(old, live).id" fails if a hand-maintained mapping table is substituted.
- DONE: AC-4 — row counts unchanged; each target's post-run total is slug rows plus its live twin's rows
  Test "AC-4: row counts are unchanged and each target's total is slug rows + live twin rows" fails if a merge case (`donate`+`cat_020`) drops either side.
- DONE: AC-5 — local admin script under `functions/scripts/`, no app route, endpoint, scheduled function, or UI
  `git show --stat 6be0730` touches only `functions/scripts/`, `functions/test/`, and two `package.json` script entries.
- DONE: AC-6 — `--dry-run` performs zero writes and prints the full per-tab plan
  `--dry-run` mints a `spreadsheets.readonly` token, so a write is impossible for the credential rather than merely skipped. Tests "AC-6: --dry-run leaves both grids byte-identical and issues no write call", "…names each old value, its target and its row count, per tab", and "…mints a readonly token; a live run mints a write token" fail if the scope is widened.
- DONE: AC-7 — any unmappable value halts non-zero having written nothing, naming every one
  Ten tests cover the four unmappable shapes (renamed twin, absent `cat_NNN`, untrimmed whitespace, in neither list) in both dry-run and live mode, plus the both-tabs-in-one-halt case. Each fails if the script skips the row and continues instead of halting.
- DONE: AC-8 — an immediate re-run reports zero changes and writes nothing
  Test "AC-8: an immediate re-run changes nothing and writes nothing" fails if already-live rows re-enter the write set.
- DONE: AC-9 / AC-10 — only `category_id` changes; no row, column, or reorder, and Categories is never written
  Full pre/post snapshot diff. Tests "AC-9: every column other than category_id is byte-identical after the run", "AC-10: no row or column is added, removed or reordered…", "the post-run verification fails loudly when a neighbouring cell moves", and "a run whose write lands in the wrong column throws VerificationError" fail if a write drifts one column.
- DONE: AC-11 — the `category_id` column is located by header name via `buildColumnMap`, not a hardcoded letter
  Test "AC-11: a reordered tab is written at the header's column, not at D" fails if the column index is hardcoded.
- DONE: AC-12 — History, Reports (breakdown and drill-down), Subscriptions, and the edit sheet render live names and icons post-migration
  New `app/test/post-migration.render.test.js` — 7 tests mounting the real surfaces against a 100%-`cat_NNN` fixture. The script's own tests never covered this; the existing render tests use a mostly-slug fixture, which exercises the bridge branch instead of the live-id branch this migration bets on.
- DONE: AC-13 — `TodayExpenseList` switches to `resolveCategory()` and renders the real name and icon
  `app/app/components/TodayExpenseList.tsx` (`e0450b4`), plus `app/test/today-list.render.test.js` (7 tests). The icon source moved from the `CATEGORY_ICONS` Lucide map to the live category's `icon` field: that map is keyed by legacy slug, so swapping only the lookup would still have rendered `Package` for every migrated row. `CATEGORY_ICONS` is left in place — entity 049 scoped its removal elsewhere.
- DONE: Edge cases from the spec
  Already-live rows reported apart from blanks and excluded from the write set; a Sheets-truncated row read as blank rather than crashing; duplicate live `name_en` halting rather than letting `find()` pick one; whitespace routed to the halt rather than trimmed. AC-13's tests add the display side: archived category, blank icon cell, orphan id, and the offline degradation the spec documents as an accepted cost.
- DONE: Self-check by mutation on the highest-risk ACs
  Reverting `TodayExpenseList.tsx` to `HEAD` fails 6 of 7 AC-13 tests with the exact bug symptom — label `cat_001` where `Eating Out` is expected. Stubbing `resolveCategory`'s live-id branch to `undefined` fails 9 of the 14 new tests; the 5 survivors are exactly those that do not depend on that branch (fixture guard, orphan fallback, slug bridge, offline, empty state).
- DONE: Full suite re-run fresh, no regressions
  app 118/118 (104 pre-existing, unchanged, plus 14 new), functions 160/160, `npm run build` clean. The app suite could not run at all before this commit: `6be0730` wired two test filenames into the test script without writing them.
- SKIPPED: Any write against production or staging
  Out of bounds for this stage — the production run is a separate captain-gated action after verify.

### Summary

AC-13 turned out to be more than a lookup swap. `CATEGORY_ICONS` is keyed by legacy slug, so pointing `resolveCategory()` at the live list while leaving the icon lookup alone would have satisfied the letter of "use resolveCategory" and still rendered the generic `Package` glyph on every migrated row — the exact symptom AC-13 exists to remove. The icon now comes from the live category's own `icon` field, matching every other surface since entity 049.

I also wrote the AC-12 display proof, which nothing had covered: the migration script's tests stop at the sheet, and the existing render tests run on a mostly-slug fixture that travels `resolveCategory`'s bridge branch rather than the direct live-id branch the migrated data will use. Both new test files were already named in `app/package.json` by the prior commit but never written, so `npm test` in `app/` was failing outright until now.

**One spec claim is wrong and the captain should see it before verify.** AC-13 and Surfaced Gap 2 both describe `TodayExpenseList` as the Home screen's today-list, "visible on the home screen immediately after the run". It is not rendered anywhere — a repo-wide grep finds no import of it, and `app/page.tsx` shows only a logged-today count. Entity 049 reached the same conclusion independently and recorded the component as dead code, also noting that entity 042's citation of it as a live surface was already stale. The fix is correct and worth keeping, but it repairs a component no user currently sees, so it does not by itself protect the Home screen. Whether to wire it up or delete it is a call for the captain, not something I should decide inside a migration entity.
