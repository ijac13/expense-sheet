---
id: 054
title: Normalize category_id to Live cat_NNN Scheme
status: ideation
source: captain
started:
completed:
verdict:
score:
worktree:
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
