---
id: 058
title: Stop the App Writing Legacy Category Slugs
status: ideation
source: captain (surfaced by entity 054's spec)
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Surfaced while writing entity 054's spec (normalizing existing `category_id` data to live `cat_NNN` ids): the app's write path never stopped creating the old legacy-slug style ids in the first place, so entity 054's migration would not stay done — new slug rows start accumulating again the moment someone logs an expense after the migration runs.

Root cause, traced to three real bugs:

- `getDefaultCategory()` (`app/app/lib/categories.ts:162-167`) returns `DEFAULT_CATEGORIES[0].id` — the slug `eating-out` — whenever nothing is stored. Its own guard, `DEFAULT_CATEGORIES.find(c => c.id === stored)`, actively *rejects* a live `cat_NNN` value, so even after a captain picks a live category and `saveLastCategory("cat_001")` runs, the very next page load discards it and falls back to `eating-out` again.
- `handleConfirm()` (`app/app/page.tsx:99`) posts whatever category id is currently selected, unchanged — it has no opinion on whether that id is a live category or a legacy slug.
- `POST /api/expenses` (`functions/src/index.ts:729`) stores whatever string it's given for `category_id` with no validation against the live Categories tab. The new-subscription and edit-subscription forms (`app/app/subscriptions/page.tsx:53,114`) have the same default-to-a-legacy-slug behavior.

## User Stories

- As the captain, I want a category I actually pick to stay picked across page loads, instead of silently reverting to the same fallback category every time.
- As the captain, I want entity 054's category-id cleanup to actually stay clean, not get undone by the next expense I log.

## Success

- `getDefaultCategory()` (or whatever replaces the "last used category" logic) can hold and return a live `cat_NNN` id without rejecting it.
- Logging an expense (or a subscription) after selecting a live category persists that selection across a fresh page load — it doesn't revert to `eating-out` or any other fixed default.
- New expense/subscription rows are never written with a legacy-slug `category_id` under normal use.

### Out of Scope

- Entity 054's actual data migration — this entity is the write-path fix that keeps 054's result durable, not the migration itself.
- Whether `POST`/`PATCH` should server-side validate `category_id` against the live Categories tab — worth deciding at spec time, but the minimum fix is the client-side default/persistence bug; server-side validation can be a stretch goal or its own follow-up if spec finds it's a bigger change than it looks.
- Removing `DEFAULT_CATEGORIES`, `resolveCategory()`'s bridge, or the offline fallback path — still needed for the offline case per entity 054's own findings.

## Plan

Sequencing matters: this should land and deploy *before or alongside* entity 054's actual migration script being run against production — not necessarily before 054's script is built, but before the live data cleanup happens, so the cleanup isn't immediately undone. Spec should trace exactly where `localStorage`'s last-used-category value gets read/written and fix the guard that rejects live ids, then decide whether `handleConfirm`/the subscription forms/the API need their own guardrails too.
