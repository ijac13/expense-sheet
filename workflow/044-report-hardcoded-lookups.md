---
id: 044
title: Reports/History Show Stale or Wrong Category & Payer Names (Hardcoded/Cached Lookup)
status: spec
source: captain (found while manually verifying entity 040 on staging)
started: 2026-08-01T14:52:44Z
completed:
verdict:
score:
worktree:
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
