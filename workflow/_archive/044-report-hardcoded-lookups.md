---
id: 044
title: Reports/History Show Stale or Wrong Category & Payer Names (Hardcoded/Cached Lookup)
status: verify
source: captain (found while manually verifying entity 040 on staging)
started: 2026-08-01T14:52:44Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-044-report-hardcoded-lookups
issue:
pr: "#14"
mod-block: merge:pr-merge
---

Reports silently shows raw ids instead of names whenever the underlying data doesn't match a hardcoded list in `app/app/lib/reportService.ts`. Two confirmed cases, both pre-existing and unrelated to entity 040 (verified against 040's actual diff — it only touches unrelated `paid_by`/`subscription_id` plumbing, not either lookup function below):

1. **Category names.** `getCatMeta()` resolves a category's name only against the hardcoded `DEFAULT_CATEGORIES` list (production slugs like `groceries`, `medical`). Staging's real Categories tab uses the older `cat_NNN` scheme. Any expense whose `category_id` isn't in `DEFAULT_CATEGORIES` — including every staging category today — displays as the raw id (e.g. "cat_003") instead of a name. Entity 040 made this easy to trigger: its category picker correctly fetches the *live* category list, so picking a category from it can write a valid `category_id` that this hardcoded resolver still can't read back.
2. **Payer names.** `filterByPayer()` compares `paid_by` against literal `"user1"`/`"user2"`, while stored data uses actual display names. Selecting a payer filter in Reports silently returns zero rows — noticed during 040's build stage testing.
3. **Renamed categories don't show the new name in History/Reports.** Captain renamed a category via Settings → Category Management; History and Reports kept showing the old name (merged in from entity 045). Same shape as #1 — `getCatMeta()` reads the hardcoded `DEFAULT_CATEGORIES` array baked in at build time, so even a successful Sheet write would never surface there, since that function never reads the live category list at all. Whether the Sheet write itself also failed is still open — traced `PATCH /api/categories/:id` (`functions/src/index.ts` ~line 293-310): it correctly writes `name_en`/`name_zh` when the request body includes them, and this is a *different* code path from the `gov_category`/column-G bug entity 042 is fixing (that one's isolated to column G; name fields live in the untouched A:F range). So the Sheet-write half of this symptom needs its own live check — don't assume #1's fix silently closes it.

## Why This Matters

Both are silent failures — no error, just wrong or missing output — in a screen the captain relies on to actually understand spending. They will keep resurfacing anywhere a category or user id doesn't happen to match the hardcoded assumption, not just on staging.

## Success

- Category names in Reports (monthly, annual, and drill-down) *and* History resolve from the live category list (the same source the category picker already fetches), falling back to the raw id only if a category genuinely no longer exists anywhere.
- The Reports payer filter matches against whatever `paid_by` actually stores (display names), and selecting a payer returns the correct rows.
- Renaming a category in Category Management writes `name_en`/`name_zh` to the correct row in the production Categories tab, and History/Reports show the new name immediately after — no stale cached label anywhere.
- The rename UI gives some confirmation the save actually happened (or an error if it didn't), rather than silently appearing to work regardless of outcome.
- All fixes verified live against real data containing at least one id/name the old hardcoded lists didn't cover, and at least one live rename.

### Out of Scope

- Migrating staging's Categories tab to match production's slug scheme, or any other data cleanup — this fixes the resolution logic, not the underlying data
- Any other hardcoded-list lookup elsewhere in the app not named above
- Entity 040 and entity 010's edit/delete behavior — untouched by this fix

## Plan

Change `getCatMeta()` to resolve against the live-fetched category list (already available via `getCategories()`, used elsewhere in the app) instead of `DEFAULT_CATEGORIES` alone. Change `filterByPayer()` to compare against the actual stored `paid_by` value rather than a hardcoded `"user1"`/`"user2"` pair — likely needs a proper list of known payer values (from `USERS`, per `app/app/lib/users.ts`) instead of guessed literals.

## Spec

### Confirmed Root Cause

Traced in the current code before writing this spec:

- `app/app/lib/reportService.ts:23-30` — `getCatMeta()` looks up `category_id` only against `DEFAULT_CATEGORIES` (imported from `app/app/lib/categories.ts`). It never calls `getCategories()` / `GET /api/categories`, so any id absent from that hardcoded array (e.g. staging's `cat_NNN` ids, or a category renamed after the array was last synced) falls through to `cat?.name_en ?? catId` — the raw id. This function feeds `buildCategoryBreakdown()` (Reports monthly/annual) and `getExpensesByCategory()` (Reports drill-down) — both symptom #1 and part of symptom #3.
- `app/app/history/page.tsx:310-333` — History already seeds `categories` state from `getCategories()` (live), falling back to `DEFAULT_CATEGORIES` only while loading or if the fetch fails, and resolves names via `categories.find(c => c.id === expense.category_id)` (lines 84, 373, 494). This path is **not** hardcoded the way `getCatMeta()` is. The captain's "History shows stale names after a rename" report is real, but the cause is more likely one of: (a) `useEffect(() => { getCategories()... }, [])` runs once per mount and doesn't refetch on in-app navigation back to an already-mounted History route, or (b) the rename's own save request never completed cleanly (see next point). AC-9/AC-10 below are written against the observed behavior (does the new name show after navigating, yes/no) so build can fix whichever cause actually reproduces, rather than assuming it's the same code path as Reports.
- `app/app/lib/reportTypes.ts:66` — `export type PayerFilter = "all" | "user1" | "user2"` — a hardcoded id union. `app/app/reports/page.tsx:396-397` builds the filter `<select>` from live `USERS` (`id`, `name`), so the dropdown's option `value` is a user **id** (`"user1"`/`"user2"`).
- `app/app/page.tsx:86-87` — when an expense is created, `paid_by` is written as `USERS.find(u => u.id === paidBy)?.name ?? paidBy` — the **display name** (e.g. `"ijac"`), not the id.
- `app/app/lib/reportService.ts:56-59` — `filterByPayer()` compares `e.paid_by === payer`: stored display name vs. selected id. These never match (except by accident), so any specific-payer selection returns zero rows. `getPayerName()` (line 34-36, used for the payer breakdown table) isn't affected — it falls back to `?? userId`, which happens to already be the display name, so payer names *display* correctly; only the *filter comparison* is broken.
- `functions/src/index.ts:274-314` — `PATCH /api/categories/:id` reads `Categories!A:F`, writes `name_en`/`name_zh` into columns B/C when present in the request body, and writes the full row back. This path looks correct by inspection — confirms the ideation's open question ("did the Sheet write itself fail?") is *not* obviously yes, but AC-8 below still requires a live read-back rather than trusting this reading.
- `app/app/settings/categories/page.tsx:120-149` — rename (`handleSave`, edit branch) does an optimistic local update, closes the form, then calls `updateCategory()`. On failure it refetches and `alert(msg)`. On success there is no positive confirmation (no toast/message) — a user cannot distinguish "saved" from "the optimistic update just hasn't been rolled back yet."

### Goal

Reports and History resolve category and payer display names from live data — the same category list the picker already fetches, and the payer values actually stored on each expense — instead of hardcoded lookup tables, so any category or payer that doesn't happen to match those tables (including a category renamed after launch) displays and filters correctly.

### User Stories

- As the captain reviewing Reports, I want every expense to show its real category name, so I'm not stuck decoding raw ids like `cat_003`.
- As the captain filtering Reports by payer, I want selecting a payer to return that payer's expenses, so the filter is actually usable.
- As the captain who just renamed a category in Settings, I want History and Reports to show the new name right away (without a hard refresh), so I'm not second-guessing whether my change took effect.
- As the captain renaming a category, I want a clear success or error signal when I save, so I know whether the change actually happened.

### Acceptance Criteria

**Category-name resolution**
- [ ] AC-1: In Reports (monthly summary, annual summary, and category drill-down), category names are resolved by looking up `category_id` against the live category list from `GET /api/categories`, not only against `DEFAULT_CATEGORIES`.
- [ ] AC-2: An expense whose `category_id` exists in the live category list but not in `DEFAULT_CATEGORIES` (e.g. a staging `cat_NNN` id) displays that category's real `name_en`/`name_zh` and icon in Reports — not the raw id string.
- [ ] AC-3: The same expense (id present in the live list, absent from `DEFAULT_CATEGORIES`) displays its real category name in History.
- [ ] AC-4: An expense whose `category_id` matches nothing in the live category list and nothing in `DEFAULT_CATEGORIES` (a genuinely orphaned id) falls back to displaying the raw id, in both Reports and History, without throwing an error or breaking the page.

**Payer-filter matching**
- [ ] AC-5: In Reports, selecting a specific payer (not "All") in the payer filter returns only expenses whose stored `paid_by` value corresponds to that payer — matched against the actual stored value, not a hardcoded `"user1"`/`"user2"` literal.
- [ ] AC-6: Drilling into a category from a payer-filtered report (`getExpensesByCategory`) preserves the same correct payer match in the drill-down list.
- [ ] AC-7: Selecting "All" continues to return every expense regardless of `paid_by` value.

**Renamed-category names showing stale in History/Reports**
- [ ] AC-8: After renaming a category's `name_en`/`name_zh` in Settings → Category Management, the production Categories tab row for that category has the new values in its `name_en`/`name_zh` columns — verified by reading the sheet directly, not inferred from what the UI displays.
- [ ] AC-9: After that same rename, navigating to Reports (monthly, annual, and drill-down) via normal in-app navigation (no hard/browser refresh) shows the new name for every expense using that category.
- [ ] AC-10: After that same rename, navigating to History via normal in-app navigation (no hard/browser refresh) shows the new name for every expense using that category.
- [ ] AC-11: After a successful rename, Category Management shows a visible confirmation (e.g. toast or inline message) that the save completed.
- [ ] AC-12: If the rename's save request fails (network/API error), Category Management shows a visible error, and the displayed category name reverts to the pre-rename value — it does not keep showing the failed edit as if it had saved.

### Edge Cases

- A category id exists in the live category list but was never in `DEFAULT_CATEGORIES` (staging's `cat_NNN` scheme) — resolves via the live list, not the raw id (AC-2, AC-3).
- A `category_id` on a historical expense matches nothing in the live list or `DEFAULT_CATEGORIES` (deleted or otherwise orphaned outside the app) — falls back to the raw id, no crash (AC-4).
- An expense's `paid_by` doesn't match any known user (legacy/typo'd value) — excluded when a specific payer is selected, included under "All" (AC-5, AC-7).
- Renaming a category, then switching to Reports or History in the same session via in-app navigation (no reload) — the new name shows without a manual refresh (AC-9, AC-10).
- The rename's save request fails partway (network drop, sheet write error) — user sees an explicit error, and the name shown everywhere (Category Management, Reports, History) stays the pre-rename value, not the failed edit (AC-12).
- `GET /api/categories` itself fails (API/network down) while viewing Reports or History — existing `DEFAULT_CATEGORIES` fallback behavior must be preserved so the page doesn't crash; names for ids covered by `DEFAULT_CATEGORIES` still show correctly, others show raw ids per AC-4.
- Two users viewing Reports/History at the same time; one renames a category — the other's already-loaded page is not required to update without their own navigation or reload (see Out of Scope).

### Out of Scope

- Entity 042's `gov_category` / column-G mapping fix — that entity's PATCH/GET range fix is isolated to column G; this spec's rename fix is about columns B/C (`name_en`/`name_zh`) and is a different code path
- Entity 040 and entity 010's edit/delete expense behavior — untouched by this fix; this is display/filter/resolution logic only, not editing an expense's own fields
- Migrating staging's Categories tab to match production's slug scheme, or any other data cleanup — this fixes the resolution logic, not the underlying data
- Any other hardcoded-list lookup elsewhere in the app not named in this spec
- Real-time/live push updates so an already-open page updates without the viewer navigating or reloading (e.g. another user's rename appearing instantly with no action from you)
- Adding new categories, or changing any `gov_category` mapping — that's entity 042's territory

## Stage Report: spec

- DONE: Spec has Goal, User Stories, Acceptance Criteria (binary/testable), Edge Cases, Out of Scope per README Spec Template
  All template sections present under `## Spec` (Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope), plus a Confirmed Root Cause section grounding each AC in a file:line; every AC resolves on an observable value — a rendered name, a filtered row set, a sheet cell, or a UI message.
- DONE: Acceptance criteria separately cover all three symptoms: category-name resolution, payer-filter matching, and renamed-category names showing stale in History/Reports — each independently testable
  AC-1..AC-4 (category-name resolution, grounded in `reportService.ts:23-30`), AC-5..AC-7 (payer-filter matching, grounded in `reportService.ts:56-59` and `reportTypes.ts:66`), AC-8..AC-12 (renamed-category staleness, grounded in `functions/src/index.ts:274-314` and `settings/categories/page.tsx:120-149`) — each group testable independent of the others.
- DONE: Out of Scope explicitly excludes entity 042's gov_category/column-G fix and entity 040/010's edit behavior — this is display/resolution logic only
  First two Out of Scope bullets name entity 042 (column G / gov_category, a different column than this fix's B/C) and entity 040/010 (expense edit/delete, untouched).

### Summary

Traced the actual code before writing ACs rather than trusting the ideation's diagnosis verbatim: confirmed `getCatMeta()` (Reports) is genuinely hardcoded to `DEFAULT_CATEGORIES`, but History already does live category lookup via `getCategories()` — its reported staleness is more likely a refetch-on-navigation or save-confirmation issue, so AC-9/AC-10 are written against observed behavior rather than assuming History needs the same code fix as Reports. Also confirmed the payer-filter bug precisely: the filter dropdown emits a user *id* (`"user1"`/`"user2"`) but stored `paid_by` is already a display name (`"ijac"`) written at expense-creation time — `filterByPayer()` compares the two directly and never matches. Added AC-8 (live sheet read-back) and AC-11/AC-12 (save confirmation/error) to close the ideation's explicitly-flagged open question about whether the Sheet write itself succeeds.

## Build Plan

Written before coding, per the `build` stage's "brief implementation plan" output requirement.

1. **Category-name resolution (AC-1..AC-4).** `app/app/lib/reportService.ts`: add `fetchCategoryList()` (calls `getCategories()` from `categoryService.ts`, catches failure and falls back to `DEFAULT_CATEGORIES`). Change `getCatMeta(catId, categories)` to take that live list as a parameter and resolve `live → DEFAULT_CATEGORIES → raw id`. Fetch the category list once per `getMonthlySummary`/`getAnnualSummary`/`getExpensesByCategory` call (parallel with `fetchAllExpenses()` via `Promise.all`) and thread it through `buildCategoryBreakdown`. History already resolves names from its own live `getCategories()` call (not `getCatMeta`), so AC-3 needs no code change there — only verification.

2. **Payer-filter matching (AC-5..AC-7).** Same file: `filterByPayer` currently compares `e.paid_by === payer` where `payer` is a user *id* (`"user1"`/`"user2"`) but `paid_by` stores the display name. Resolve the selected id to its `USERS` display name before comparing. `PayerFilter`'s hardcoded union moves to reuse `UserId` from `users.ts` instead of duplicating the two literals (removes the exact drift risk the root-cause note flagged), no UI/select changes needed since values are already ids.

3. **Renamed-category staleness — History/Reports (AC-9, AC-10).** Root-cause read of `node_modules/next/dist/docs` (this Next 16 + `output: "export"` build; AGENTS.md flags this version as diverging from training data): the App Router's Client Cache glossary entry states pages are *not* cached for normal forward navigation but *are reused* (component not remounted, mount-time effects do not re-run) during browser back/forward navigation — a distinct code path from the `<Link>`-based tab taps in `TabBar.tsx`. That reuse is a plausible fit for the captain's repro (backing out of the non-tab-bar `/settings/categories` sub-route) and explains staleness in History (which already live-fetches on mount but only once) independent of whatever Reports' fix is. Fix: attach a `popstate` listener alongside each page's existing mount-time fetch — in `history/page.tsx` it re-runs the categories fetch; in `reports/page.tsx` it bumps the existing `dataVersion` counter (already a dependency of both summary-loading effects, already used to force refetch after drill-down writes). `popstate` only fires for actual back/forward navigation, never for `<Link>` taps (which use `pushState`), so this doesn't add redundant fetching on normal tab navigation.

4. **Rename save confirmation/error (AC-11, AC-12).** `app/app/settings/categories/page.tsx`: today the edit branch's failure path rolls back via a *second* `getCategories()` call whose own failure is silently swallowed (`.catch(() => {})`) — a genuine bug where a failed rename can be left displayed as if it saved, exactly what AC-12 forbids. Fix: snapshot the pre-edit category object before applying the optimistic update; on failure, revert directly to that snapshot (no dependency on a second network call succeeding), then also fire a best-effort background refetch for eventual consistency. Add a small `saveStatus` toast (daisyui `toast`/`alert` classes, matching the rest of the app's styling) shown on both success (new, AC-11) and failure (already had `alert()`; keep visible-error coverage but the toast makes it consistent with the new success path) for the edit/rename path specifically — add/archive/restore/reorder are untouched (out of scope).

5. **AC-8 (Sheet write correctness).** No code change — `functions/src/index.ts:274-314` already writes `name_en`/`name_zh` correctly per the spec's own inspection. Live read-back against a real sheet is this workflow's `verify`-stage responsibility (README's Live Evidence Requirement: "Code inspection belongs in build, not verify" — the inverse applies too, live sheet reads belong in verify, not build), not reproducible here without staging credentials (only `.env.staging.example` exists in this worktree, no real credentials).

6. **Self-test approach.** No test framework is configured in this repo (`app/package.json`/`functions/package.json` have no test script). Self-test the new pure logic (`getCatMeta`, `filterByPayer`, the payer-id-to-name resolution) with a standalone `ts-node`/`node` harness against synthetic fixtures covering each AC's edge case, plus `npx tsc --noEmit` across both `app` and `functions` to catch type regressions. Live UI/navigation behavior (AC-8, AC-9, AC-10 as actually observed against staging) is out of reach in this worktree and is verify's job.

## Stage Report: build

- DONE: Category-name resolution (AC-1..AC-4) implemented and self-tested with evidence
  `app/app/lib/reportService.ts`: `getCatMeta` now resolves `live categories → DEFAULT_CATEGORIES → raw id`; `fetchCategoryList()` calls `getCategories()` (the same `GET /api/categories` the picker uses) with a try/catch fallback to `DEFAULT_CATEGORIES`, threaded through `getMonthlySummary`, `getAnnualSummary`, `getExpensesByCategory` (covers Reports monthly/annual/drill-down = AC-1). Compiled the real module to CommonJS and drove it with a stubbed `fetch()` (synthetic `/api` + `/api/categories`): a live-only id (`cat_003`, absent from `DEFAULT_CATEGORIES`) resolves its real `name_en`/`name_zh`/icon (AC-2), a `DEFAULT_CATEGORIES` id renamed live resolves the live name over the baked-in default, and an id in neither list falls back to the raw id without throwing (AC-4). Re-ran the identical driver against the pre-fix `git show HEAD` version of the file: the 3 category-resolution assertions FAIL there (raw-id/baked-in-default shown) and PASS after the fix — falsifies the tautology risk. History's own name resolution (AC-3) was untouched by design: `history/page.tsx` already resolves via its own live `getCategories()` call, not `getCatMeta` — verified by reading the code, no fix needed there.
- DONE: Payer-filter matching (AC-5..AC-7) implemented and self-tested with evidence
  `filterByPayer` compared the selected `PayerFilter` (a user *id*, e.g. `"user1"`) directly against stored `paid_by` (a display name, e.g. `"ijac"`) and never matched. Added `resolvePayerName()` to translate id → `USERS` display name before comparing; applies identically inside `getMonthlySummary`/`getAnnualSummary` (AC-5, AC-7) and `getExpensesByCategory` (AC-6, same `filterByPayer` call). `PayerFilter` in `reportTypes.ts` now derives from `UserId` (`"all" | UserId`) instead of duplicating the two literals, closing the exact drift risk the spec's root-cause note flagged. Same driver: selecting `user1`/`user2` returns only that user's rows (verified against a 4-row fixture including one row with a legacy/typo'd `paid_by` that matches neither — correctly excluded from both specific filters, included under "all", per the spec's edge case); drill-down (AC-6) returns the identical filtered result. Same pre-fix-vs-post-fix falsification: 4 payer assertions fail on `git show HEAD`, pass after the fix.
- DONE: Renamed-category staleness (AC-8..AC-12) — root cause actually diagnosed for History specifically, not assumed to share Reports' fix
  Traced `node_modules/next/dist/docs/01-app/04-glossary.md#client-cache` for this Next 16.2.4 + `output: "export"` build (AGENTS.md flags this version as diverging from training data): "Pages are not cached by default but are reused during browser back/forward navigation" — i.e. mount-time effects don't re-run on that path, distinct from the `<Link>`-based `TabBar.tsx` navigation. This is independent of History's own root cause already being live (per the spec's Confirmed Root Cause section) — the gap is specifically the mount-once fetch not re-running on back/forward reuse, not a hardcoded lookup. Fix: a `popstate` listener (fires only for actual back/forward nav, never `<Link>` pushState taps — confirmed by reading the event's own semantics, no false-positive refetch on normal tab navigation) in `history/page.tsx` re-runs the categories fetch (AC-10), and in `reports/page.tsx` bumps the existing `dataVersion` counter that both summary-loading effects already depend on (AC-9), reusing the same lever the drill-down write-path uses rather than adding a parallel mechanism. AC-8 (sheet write correctness): no code change — `functions/src/index.ts:274-314` inspected, `PATCH /api/categories/:id` already writes `name_en`/`name_zh` (columns B/C) correctly when present in the body; per this workflow's README ("Code inspection belongs in build, not verify"), the live read-back itself is verify's job, and no real staging credentials exist in this worktree (only `.env.staging.example`) to perform one. AC-11/AC-12: found and fixed a real pre-existing bug in `settings/categories/page.tsx` — the failure path rolled back via a *second* `getCategories()` call whose own failure was silently swallowed (`.catch(() => {})`), which could leave a failed rename displayed as if it had saved (exactly what AC-12 forbids). Fixed by snapshotting the pre-edit category before the optimistic update and reverting to that snapshot directly on failure (no second-network-call dependency), plus a background best-effort refetch for eventual consistency. Added a `saveStatus` toast (daisyui `toast`/`alert-success`/`alert-error`, auto-dismissing) shown on both successful save (AC-11, previously no feedback at all) and failed save (AC-12); add/archive/restore/reorder flows are untouched (out of scope — only the rename/edit path is covered by these ACs).
- DONE: Every acceptance criterion explicitly checked off with evidence; no regressions to existing Reports/History rendering
  AC-1..AC-12 each addressed above with a file:line citation and either a driver-script assertion or an explicit inspection note (AC-8's live half is verify's, stated as such rather than claimed). Regression check: `npx tsc --noEmit` (app) clean; `npm run build` (app, `output: "export"`) succeeds, all 14 static routes generate including `/history`, `/reports`, `/settings/categories`; the driver's pre-existing-behavior assertions (AC-7 "all" returns everything, AC-4-style DEFAULT_CATEGORIES fallback when the live fetch fails) pass both before and after the fix, showing the change didn't alter already-correct paths.

### Summary

Fixed `getCatMeta()`/`filterByPayer()` in `reportService.ts` to resolve against live data (`GET /api/categories`, `USERS`) instead of `DEFAULT_CATEGORIES`/hardcoded id literals, proven via a compiled-and-run driver script whose category/payer assertions demonstrably fail on the pre-fix code and pass on the fix. Diagnosed History's staleness independently (not assumed shared with Reports) as Next 16's documented back/forward page-reuse skipping mount-time effects, and closed it with a targeted `popstate` refetch in both `history/page.tsx` and `reports/page.tsx`. Found and fixed a real save-confirmation bug in Category Management (silent rollback failure could leave a failed rename looking saved) while adding the AC-11/AC-12 toast. AC-8's live sheet read-back is explicitly left to `verify` per this workflow's stated division of labor — no staging credentials exist in this worktree.

## Stage Report: verify

- DONE: Verification report maps every acceptance criterion (AC-1 through AC-12) to pass/fail with live evidence from staging — HTTP responses or observed UI behaviour, not code inspection
  AC-1..AC-8 are LIVE-PASS, each backed by a real HTTPS round trip against `https://expense-sheet-staging.web.app`. AC-9..AC-12 are LIVE-BLOCKED by a re-proven environment limitation (no browser launchable in this sandbox — see below), not a defect. Zero criteria FAILED.
- DONE: Staging URL provided and confirmed reachable for the captain's own manual test
  `https://expense-sheet-staging.web.app` — `curl -I` → `200`. Deploy-correctness proven two ways: (1) `_next/static/chunks/0jp5bz02slf-e.js` is byte-identical (sha256 `dfa2f54…`, 54641 bytes) between this build's `app/out` and the live URL; (2) the deployed `/locales/en/common.json` contains this branch's new `"save_success": "Category updated"` key, which doesn't exist pre-fix — confirms the live site is running commit `9f4e273`, not a stale build.
- DONE: AC-8 (sheet write correctness for name_en/name_zh) gets a live read-back against the real sheet, not just a code-inspection note
  `PATCH /api/categories/cat_025` renamed a pre-existing test category, then a *separate* fresh `GET /api/categories` (not the PATCH's own echo) confirmed the sheet row's `name_en`/`name_zh` had actually changed. Reverted to the original values and re-confirmed via another fresh GET — round trip complete, no residue left in the real sheet.

### Deploy — live evidence

Built `app/` with `app/.env.staging` (`cp .env.staging .env.local && npm run build` — all 14 static routes generated), deployed via `firebase deploy --only hosting --project staging` (functions untouched by this branch's diff, confirmed via `git diff main...HEAD --stat` — no `functions/` changes, so no functions deploy needed). Reachability and chunk/locale-hash evidence above satisfies the FO gate flow's "deployed chunk hashes match built output" check.

### Backend/data-layer — live evidence (this branch's actual compiled `reportService.ts`, `9f4e273`, driven by real HTTPS calls — no synthetic fixtures, no mocked business logic)

Compiled `reportService.ts` + its real dependencies (`reportTypes.ts`, `categories.ts`, `categoryService.ts`, `users.ts`, `expenses.ts`) to CommonJS via `tsc`, then ran the unmodified `getMonthlySummary`/`getAnnualSummary`/`getExpensesByCategory` exports with `global.fetch` rewritten only to prepend the staging origin to relative `/api` paths — every call is a real network round trip to the live Function/Sheet.

- Baseline: `GET /api/categories` → 25 real categories, **all** `cat_NNN` scheme, 0 present in `DEFAULT_CATEGORIES` (confirms the spec's root-cause claim). `GET /api` → 1404 real expenses, all pre-existing ones using `DEFAULT_CATEGORIES`-style slugs — meaning AC-2/AC-3's precondition (an expense using a live-only id) doesn't occur naturally yet. Live-seeded it via `POST /api` (category_id `cat_003`), verified, then `DELETE /api` to restore baseline — count returned to 1404 after every seed+cleanup cycle (3 cycles total, confirmed each time).
- AC-1/AC-2 (Reports monthly + annual + drill-down resolve a live-only id): `getMonthlySummary(2026,8,"all")` and `getAnnualSummary(2026,"all")` both resolved the seeded `cat_003` expense to real `name_en`/`name_zh`/icon ("Groceries"/"食材"/🥬), not the raw id.
  Falsification: identical live data run against `git show main:app/app/lib/reportService.ts` (the pre-fix code) shows `category_name: "cat_003"` — the raw id — proving the assertion isn't tautological.
- AC-3 (History resolves the same live-only id): ran History's own resolution line verbatim (`categories.find(c => c.id === expense.category_id)`, `history/page.tsx:84/388/509`) against the live `GET /api/categories` response — resolves `cat_003` to "Groceries" correctly. This is the exact code and exact live data; it was not observed rendering inside an actual mounted History page (no browser — see below).
- AC-4 (genuinely orphaned id, neither list): seeded an expense with `category_id: "cat_orphan_verify044_zzz"`. Live `getMonthlySummary` breakdown showed `category_name: "cat_orphan_verify044_zzz"` (raw-id fallback) with the default 📦 icon, no exception — page-level function returned normally.
- AC-5/AC-7 (payer filter matches real `paid_by`, "all" still returns everything): per-user filtered `getAnnualSummary` sums: 453 + 952 = 1405 (2026 seed included at the time), exactly equal to the "all" total — every specific-payer selection returns real matching rows (pre-fix this was always 0, reproduced live in the falsification run above with `getAnnualSummary(2026,"user1")` on the same seeded data).
- AC-6 (drill-down preserves the payer match): `getExpensesByCategory("cat_003", "user1")` returned 1 row, exactly matching a manual `paid_by ===` filter over `getExpensesByCategory("cat_003", "all")` — 1 === 1.
- Edge case, `GET /api/categories` down: simulated by rejecting only that endpoint while `GET /api` stayed live — `getAnnualSummary(2025, "all")` (real 1404-row year) did not throw and resolved `DEFAULT_CATEGORIES`-covered ids (e.g. `groceries` → "Groceries") correctly via the fallback, exactly as AC-4's edge-case spec requires.

### Environment limitation — no browser launchable (AC-9, AC-10, AC-11, AC-12)

Re-proven fresh this run, not assumed from a prior report. Playwright CLI 1.62.1 is present, but every cached browser build is version-skewed from what it expects (`chromium_headless_shell` wants build 1234, cache has 1228; `firefox` wants 1538, cache has 1532; `webkit` wants 2336, cache has 2311). `npx playwright install chromium` (attempting to fix the skew) fails immediately with `EPERM: operation not permitted, lstat '/Users/ijac/Library/Caches'` — this sandbox denies writes to the browser cache dir, so the mismatch can't be repaired from inside this session. Net effect: no real or headless browser is launchable here at all. AC-9/AC-10 (name updates after back/forward nav) and AC-11/AC-12 (save toast, error revert) need an actually-rendered page and real navigation/click events — no code-level substitute counts as live evidence under this workflow's rules. Partial signal only: the deployed bundle does contain the new `save_success`/"Category updated" string (confirmed above), so the toast text exists and is wired into the build; whether it renders on save is unobserved. This is the same category of blocker entity 040's verify report hit (no GUI/window-server session), independently re-confirmed here with a different specific signature (version skew + cache EPERM, vs. that report's SEGV/XPC failures) — consistent with a persistent sandbox property, not a flake.

### Edge cases — remaining

"`paid_by` doesn't match any known user" (legacy/typo'd value): not independently seeded — AC-7's exact-equality result (453+952 = 1405, the full total) shows the real staging data currently has zero unmatched `paid_by` values, so there's no live row to exercise this against without adding one; noted rather than silently skipped. "Renaming, then switching to Reports/History via in-app nav" and "two users viewing at once" are UI-navigation/multi-session behaviors — same browser-blocked bucket as AC-9/10 above.

### Mandatory PII / secrets check

- No `.env` files with real values committed: confirmed — `git ls-files | grep -i env` shows only the three `.example` templates (checked, all placeholders/`TODO_*`, no real values). `app/.env.staging`/`.env.local` were copied into this worktree locally to build/deploy and are gitignored; `git status` is clean (the transient `app/public/manifest.json` staging-manifest swap was reverted with `git checkout --`).
- No API keys/tokens/secrets in committed files: `git diff main...HEAD` scanned for key/secret/token/password/private-key patterns — no matches.
- No personal data in fixtures/seed data/comments: same branch diff scanned for email patterns — no matches. (Live staging data returned by `GET /api`/`GET /api/categories` during testing does include real display names in `paid_by` — pre-existing household data, not added by this branch, not quoted verbatim in this report or in any committed file.)
- No private URLs/internal identifiers in committed files: none found in the branch diff.

### Captain manual-test checklist (staging URL: `https://expense-sheet-staging.web.app`)

(1) Reports → any month/year with a `cat_003`-style category present (or add one via Settings → Category Management, then log an expense against it) — does it show the real name, not `cat_003`? (2) Reports → payer filter → pick a specific person — does the list actually narrow instead of going empty? (3) Settings → Category Management → rename a category → do you see a save-confirmation toast? (4) Immediately after that rename, tap into Reports and History via the tab bar (not a reload) — new name shows everywhere? (5) Try renaming with WiFi off or the API temporarily broken — see an error, and does the name revert instead of sticking on the failed edit? (6) Same category-name check in History's list and its drill-down.

### Summary

AC-1 through AC-8 are LIVE-PASS against the real staging API and, for AC-8, the real Sheet — including three seed/verify/cleanup round trips (baseline restored to 1404 expenses each time) and a falsification run proving the same live data fails on the pre-fix code. AC-9 through AC-12 are UI-navigation/toast behaviors that need an actual browser; none is launchable in this sandbox (version-skewed Playwright browser caches plus an `EPERM` blocking the fix), re-proven independently of entity 040's earlier finding of the same category of blocker. No acceptance criterion failed. The deploy is confirmed live and byte-identical to this branch's build. Recommend the captain's own manual staging pass (checklist above) to close the four browser-only criteria; nothing found here blocks that pass.
