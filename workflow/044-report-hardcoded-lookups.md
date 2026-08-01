---
id: 044
title: Reports/History Show Stale or Wrong Category & Payer Names (Hardcoded/Cached Lookup)
status: build
source: captain (found while manually verifying entity 040 on staging)
started: 2026-08-01T14:52:44Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-044-report-hardcoded-lookups
issue:
pr:
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
