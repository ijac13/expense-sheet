---
id: 044
title: Reports Category/Payer Names Break on Real Data (Hardcoded Lookup)
status: ideation
source: captain (found while manually verifying entity 040 on staging)
started:
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

## Why This Matters

Both are silent failures — no error, just wrong or missing output — in a screen the captain relies on to actually understand spending. They will keep resurfacing anywhere a category or user id doesn't happen to match the hardcoded assumption, not just on staging.

## Success

- Category names in Reports (monthly, annual, and drill-down) resolve from the live category list (the same source the category picker already fetches), falling back to the raw id only if a category genuinely no longer exists anywhere.
- The Reports payer filter matches against whatever `paid_by` actually stores (display names), and selecting a payer returns the correct rows.
- Both fixes verified live against real staging data containing at least one id/name that the old hardcoded lists didn't cover.

### Out of Scope

- Migrating staging's Categories tab to match production's slug scheme, or any other data cleanup — this fixes the resolution logic, not the underlying data
- Any other hardcoded-list lookup elsewhere in the app not named above
- Entity 040 and entity 010's edit/delete behavior — untouched by this fix

## Plan

Change `getCatMeta()` to resolve against the live-fetched category list (already available via `getCategories()`, used elsewhere in the app) instead of `DEFAULT_CATEGORIES` alone. Change `filterByPayer()` to compare against the actual stored `paid_by` value rather than a hardcoded `"user1"`/`"user2"` pair — likely needs a proper list of known payer values (from `USERS`, per `app/app/lib/users.ts`) instead of guessed literals.
