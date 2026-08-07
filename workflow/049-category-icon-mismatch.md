---
id: 049
title: Category Icons/Emoji Don't Match Category Management Settings
status: ideation
source: captain (found manually testing entity 044 on staging)
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Category icons shown around the app (Home, History, Reports) don't match what's actually configured in Category Management — many categories show the same, wrong emoji. Very likely the same root-cause pattern entity 044 just fixed for category *names* (hardcoded `DEFAULT_CATEGORIES`/`CATEGORY_ICONS` lookups in `app/app/lib/categories.ts` instead of the live category data from the API) — but 044's fix was scoped to name resolution only and never touched icon resolution, so this is a distinct entity, not a regression or a duplicate.

## User Stories

- As the captain, I want a category's icon shown everywhere in the app to match what's actually set in Category Management, so the visual is trustworthy and not just the name.

## Success

- Every category's displayed icon, everywhere in the app, matches its live `icon` field from the category data — not a hardcoded fallback map.
- Changing a category's icon in Category Management is reflected everywhere immediately, no code deploy needed.

### Out of Scope

- Category name resolution (already fixed by entity 044)
- Adding new icon choices or changing the icon picker UI itself

## Plan

Same pattern as entity 044: find every place a category icon renders from `CATEGORY_ICONS` or another hardcoded map instead of the live category object's own `icon` field, and switch it to live resolution, with the same hardcoded-fallback-on-genuinely-missing-id behavior 044 established for names.
