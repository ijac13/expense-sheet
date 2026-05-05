---
id: "035"
title: New Category Not Persisted After Creation
status: build
source: captain feedback
started: 2026-05-04T05:47:31Z
completed:
verdict:
score: 0.95
worktree: .worktrees/spacedock-ensign-category-create-not-persisted
issue:
pr:
---

Creating a new category appears to succeed (it shows up immediately in the list) but the category is not saved to the spreadsheet — it disappears on the next page load and never appears in the expense entry category picker.

## Evidence

`feedback-screenshots/category-003.png` (9:53) — Category management page shows "Cost from Rent 房客支出" at the bottom of the list, just after creation. Has an up arrow (↑) but no down arrow, confirming it was just appended.

`feedback-screenshots/category-004.png` (9:54) — Same page one minute later after navigating away and back. "Cost from Rent 房客支出" is gone. Last entry is "Other 其他" — the list reverted to the state fetched from the spreadsheet.

Tested on production (`expense-sheet-b2db8.web.app`).

## What's happening

The category is being added to local React state immediately (optimistic update), making it appear to succeed. But either:
- The API call to write the new category to the Google Spreadsheet is failing silently, OR
- The API call is never fired, OR
- The write succeeds but the row is written to the wrong location / wrong format so it's not read back correctly on the next fetch

When the page is navigated away and returned to, a fresh fetch from the spreadsheet loads — which doesn't include the new category.

The expense entry category picker also never shows the new category because it reads from the same spreadsheet source.

## Acceptance Criteria

- **AC-1** Creating a new category via the category management page writes a row to the Categories tab of the Google Spreadsheet
- **AC-2** After navigating away and returning to category management, the new category is still present in the list
- **AC-3** The new category appears in the expense entry category picker immediately after creation (on next page load or without needing a hard refresh)
- **AC-4** Creating a category with the same name as an existing one is handled gracefully (no silent failure, no duplicate)
- **AC-5** If the API call to save the category fails, the user sees an error — the optimistic update is rolled back or an error state is shown

## Spec

### Root Cause

Two compounding gaps — neither the frontend service nor the backend have any category persistence wiring.

**Gap 1 — `categoryService.ts` is all stubs** (`app/app/lib/categoryService.ts`, lines 1–22)

Every exported function (`addCategory`, `updateCategory`, `archiveCategory`, `restoreCategory`, `reorderCategory`) logs to the console and returns a locally-constructed object. No `fetch` call is ever made. The page calls `addCategory` on line 75 of `page.tsx`, gets back a new `Category` object, and adds it to local React state — giving the appearance of success while nothing is sent to the backend.

**Gap 2 — No `/api/categories` backend route** (`functions/src/index.ts`)

The `api` handler routes on `path.includes(...)` for `users`, `subscriptions`, `insights`, and `migrate-users`. There is no `categories` branch. Even if `categoryService.ts` fired a `POST /api/categories`, the backend would fall through to the expenses handler and return a 400 or 404.

**Gap 3 — Page never fetches from the API on load** (`app/app/settings/categories/page.tsx`, line 29)

`useState` is initialized from `DEFAULT_CATEGORIES` (a hardcoded constant in `lib/categories.ts`). The page has no `useEffect` to fetch the live category list from the spreadsheet. This means the list always starts from the hardcoded set, so even if persistence were fixed, the page would not reflect the persisted state without also adding an API fetch.

The Categories tab schema is known: `id | name_en | name_zh | icon | sort_order | is_active` (from `apps-script/seed-categories.gs`).

### What needs to be built

1. Backend: add `CATEGORIES_TAB = "Categories"` constant and a `/api/categories` route handling:
   - `GET` — read all rows, return as JSON array
   - `POST` — append a new category row (generate id like `cat_NNN`, assign `sort_order = max + 1`, `is_active = true`)
   - `PATCH` — update `name_en`, `name_zh`, `icon`, `sort_order`, or `is_active` by id
2. Frontend `categoryService.ts`: replace stubs with real `fetch` calls to `/api/categories`
3. Frontend `page.tsx`: replace `useState(() => DEFAULT_CATEGORIES)` with a `useEffect` fetch on mount; keep optimistic state update but roll back on API error

### Acceptance Criteria (binary)

- **AC-1** `POST /api/categories` appends a row to the Categories tab; the row is readable on the next `GET /api/categories` call
- **AC-2** The category management page fetches categories from the API on load; a category added in a prior session is visible after navigating away and returning
- **AC-3** The `CategoryPicker` component (or wherever expense entry reads categories) uses the same API-sourced list, so new categories appear in the picker after the next fetch
- **AC-4** Attempting to create a category with a `name_en` already in the active list returns a client-side validation error; no duplicate row is written to the sheet
- **AC-5** If the `POST /api/categories` call fails (non-2xx), the optimistic list update is rolled back and the user sees an error message in the form

## Stage Report: spec

- DONE: Root cause identified with evidence (exact file and line where persistence fails — missing API call, failing write, wrong sheet tab, etc.)
  `categoryService.ts` lines 1–22: all stubs, no fetch calls. `functions/src/index.ts`: no `/api/categories` route exists. `page.tsx` line 29: state seeded from `DEFAULT_CATEGORIES`, never fetches from API.
- DONE: Spec written with binary AC covering the fix
  Five binary ACs added covering: backend write, page load fetch, picker integration, duplicate guard, and error rollback.

### Summary

The bug is a fully unimplemented feature: `categoryService.ts` is entirely placeholder stubs and the backend `api` function has no `/api/categories` route. The fix requires adding a backend route (GET/POST/PATCH against the Categories sheet tab), replacing the frontend stubs with real fetch calls, and changing the page to load categories from the API instead of the hardcoded constant.

## Stage Report: build

- DONE: Backend `/api/categories` route handles GET, POST, and PATCH correctly
  `functions/src/index.ts`: added `CATEGORIES_TAB`, `CATEGORIES_HEADER`, `rowToCategory`, and `/api/categories` branch (GET/POST/PATCH). PATCH extracts id from path segments. POST appends row with auto-generated `cat_NNN` id and `sort_order = max + 1`. `tsc --noEmit` passes clean.
- DONE: `categoryService.ts` stubs replaced with real fetch calls
  `app/app/lib/categoryService.ts` rewritten with `getCategories`, `addCategory`, `updateCategory`, `archiveCategory`, `restoreCategory`, `reorderCategory` — all calling `/api/categories`.
- DONE: `categories/page.tsx` fetches on mount; optimistic update rolls back on error; duplicate guard added
  `useState<Category[]>([])` replaces hardcoded init. `useEffect` calls `getCategories()` on mount. `handleSave` does optimistic placeholder, replaces on success, rolls back and re-opens form with error on failure. Client-side duplicate guard on `name_en` before API call.
- DONE: `CategoryPicker` (or equivalent in expense entry) uses API-sourced categories
  `app/app/page.tsx` (expense entry) and `app/app/expense/[id]/EditExpenseClient.tsx` both fetch categories via `getCategories()` on mount, falling back to `DEFAULT_CATEGORIES` on error.
- DONE: AC-1 through AC-5 self-checked in stage report
  AC-1: POST writes row, GET returns it on next call. AC-2: page fetches on mount, persisted categories visible after navigation. AC-3: both expense entry and edit screens use API-sourced list. AC-4: client-side duplicate guard on `name_en` shows error without calling API. AC-5: optimistic update rolled back and form re-opened with error message on POST failure.

### Summary

All three root-cause gaps are resolved: backend route added, service stubs replaced with real fetch calls, and the categories page now loads from the API on mount. The expense entry (home page) and edit expense screen were also updated to use API-sourced categories so new categories appear in the picker after creation. Both `tsc --noEmit` checks pass clean.

## Stage Report: verify

- DONE: AC-1 POST to `/api/categories` appends a row; GET returns it — confirm the backend route writes to `CATEGORIES_TAB` and returns the full row list
  `index.ts` lines 22–24: `CATEGORIES_TAB = "Categories"`. Lines 268–273: POST uses `spreadsheets.values.append` to `CATEGORIES_TAB!A:F`; returns `rowToCategory(row)`. GET (lines 212–219) reads full `CATEGORIES_TAB!A:F` and maps all rows via `rowToCategory`.
- DONE: AC-2 Page loads from API on mount — confirm `useEffect` + `getCategories()` in categories/page.tsx
  `page.tsx` line 30: `useState<Category[]>([])` — empty, no hardcoded fallback. Lines 36–43: `useEffect(() => { getCategories().then(setCategories)... }, [])` — single mount-time fetch with empty dep array.
- DONE: AC-3 Expense entry and edit screen use API-sourced list — confirm both files call `getCategories()`
  `app/page.tsx` line 7: imports `getCategories`; lines 55–64: `useEffect` calls `getCategories()`, filters active + sorts, updates `categories` state, fallback to `DEFAULT_CATEGORIES` on error. `EditExpenseClient.tsx` line 10: imports `getCategories`; lines 26–35: same `useEffect` pattern with `DEFAULT_CATEGORIES` fallback.
- DONE: AC-4 Duplicate guard — confirm client-side check on `name_en` before POST
  `page.tsx` lines 77–83: `active.some(c => c.name_en.toLowerCase() === form.name_en.trim().toLowerCase())` — sets form error and returns before any `addCategory` call if match found.
- DONE: AC-5 Error rollback — confirm optimistic update is reverted and error shown on POST failure
  `page.tsx` lines 107–113: catch block runs `setCategories(prev => prev.filter(c => c.id !== placeholder.id))` (rollback), then `setFormMode({ type: "add" })` and `setForm({ ...data, error: msg })` to re-open form with error text.
- DONE: PII/secrets check passed
  No hardcoded emails, API keys, or credentials in any of the five changed files. `SPREADSHEET_ID` accessed only via `process.env`; Anthropic key via `defineSecret`.

### Summary

All 5 ACs pass on direct code inspection. The backend route correctly appends to `CATEGORIES_TAB` and returns the full list; the categories page mounts with an empty state and fetches from the API; both expense entry and edit screens call `getCategories()` on mount; the duplicate guard fires before the POST; and the catch block rolls back the optimistic placeholder and re-opens the form with an error message. No PII or secrets found in the changed files. DONE.
