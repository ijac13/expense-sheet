---
id: "003"
title: Category System
status: spec
source: commission seed
started: 2026-04-20T10:30:00Z
completed:
verdict:
score: 0.8
worktree:
issue:
pr:
---

Categories are how every expense is classified. Without categories, the data is a list of amounts with no meaning. With them, the app can show you where your money actually goes.

## User Stories

- As a user, I want to see all my categories in a list so I can understand what's currently active and what's been archived
- As a user, I want to add a new category (name in EN + 繁中, emoji, sort order) so I can track a new type of spending
- As a user, I want to rename a category so that old expenses automatically reflect the new name everywhere
- As a user, I want to archive a category I no longer use so it disappears from the entry picker but stays in my history

## Success

- Settings → Category management shows all active categories with their emoji, EN name, ZH name
- Archived categories are hidden from the entry picker but still visible in Settings (clearly marked as archived)
- Adding a new category creates a row in the Categories tab with `is_active: true`
- Renaming a category updates `name_en` or `name_zh` in the Categories tab — all past expenses that reference this `category_id` immediately display the new name
- Archiving sets `is_active: false` — the category disappears from the entry picker but history shows it as-is (still resolved via `category_id`)
- Sort order controls the display sequence in the entry picker

### Out of Scope

- Deleting categories — categories are never deleted, only archived (data integrity across 20+ years)
- AI category suggestion — out of scope for the whole app (see entity 002)
- Merging two categories into one — future concern
- Category icons beyond emoji - never want to do that
- Concurrent edits — both users managing categories simultaneously is not handled

## Plan

### Data Model

Defined in `project-setup.md` Categories tab:

| Column | Notes |
|--------|-------|
| `id` | Stable forever — never reassigned |
| `name_en` | Editable — rename updates display everywhere |
| `name_zh` | Editable — same |
| `icon` | Emoji character |
| `sort_order` | Controls entry picker order |
| `is_active` | `true` = in picker; `false` = archived |

### Category Management Screen

Accessible from Settings. Shows two sections:

1. **Active** — list of active categories in `sort_order` sequence, each row has ↑↓ arrow buttons to reorder and is tappable to edit (rename, change emoji)
2. **Archived** — collapsed section showing archived categories with option to restore

### Add Category

Tapping "+ Add category" opens a form:
- Emoji picker or text input for icon
- Name (EN) — required
- Name (繁中) — required
- Sort order — defaults to last position (appended to end of active list)

On save: Firebase Function appends a row to the Categories tab.

### Edit Category

Tapping an existing category opens the same form pre-filled. Changes on save:
- Firebase Function updates `name_en`, `name_zh`, `icon`, `sort_order` in the Categories tab row

### Archive Category

From the edit screen, an "Archive" button (destructive style) sets `is_active: false`. No confirmation dialog needed — it's reversible.

### Rename Retroactivity

Because the Expenses tab stores `category_id` (not the name), renaming a category automatically affects all historical expenses on the next read — no migration needed.

## Spec

### Goal

Provide a Settings screen where both users can create, rename, reorder, and archive expense categories — so that every expense can be classified and that classification history is preserved permanently.

### User Stories

- As a user, I want to see all active categories in Settings so that I can understand how my expenses are currently organised.
- As a user, I want to add a new category (emoji, EN name, ZH name) so that I can track a new type of spending.
- As a user, I want to rename a category so that all past expenses automatically reflect the new name without any migration.
- As a user, I want to archive a category I no longer use so that it disappears from the entry picker but remains visible in my expense history.
- As a user, I want to reorder categories so that the most-used ones appear first in the entry picker.

### Acceptance Criteria

- [ ] Settings → Category Management displays all categories where `is_active: true`, ordered by `sort_order` ascending.
- [ ] Each active category row shows its emoji, EN name, and ZH name.
- [ ] Each active category row has ↑ and ↓ arrow buttons; tapping ↑ decrements its `sort_order` relative to the row above, and tapping ↓ increments it relative to the row below.
- [ ] The topmost category's ↑ button is disabled (or hidden); the bottommost category's ↓ button is disabled (or hidden).
- [ ] Tapping "+ Add category" opens a form with fields: emoji (picker or text), Name (EN) required, Name (繁中) required.
- [ ] Saving a new category writes a row to the Categories tab with `is_active: true` and `sort_order` set to one greater than the current maximum `sort_order`.
- [ ] Tapping an existing category opens an edit form pre-filled with its current emoji, EN name, and ZH name.
- [ ] Saving an edited category updates `name_en`, `name_zh`, and/or `icon` in the Categories tab row; the change is immediately reflected everywhere the category name is displayed.
- [ ] The edit form has an "Archive" button that sets `is_active: false` on the category row without a confirmation dialog.
- [ ] After archiving, the category no longer appears in the entry picker.
- [ ] After archiving, past expenses that reference the archived `category_id` still display the category name correctly.
- [ ] Settings → Category Management shows an "Archived" section listing all categories where `is_active: false`, each with a "Restore" button.
- [ ] Tapping "Restore" sets `is_active: true` and the category reappears in the entry picker and active list.
- [ ] Attempting to save a new or renamed category with a name (EN) that already exists among active categories is rejected with an inline error message.
- [ ] Adding a category with an EN name that duplicates an archived category name is allowed (archived names are not reserved).

### Edge Cases

- **Archiving a category that has past expenses:** The category is set `is_active: false`. Existing expenses retain their `category_id` reference and continue to display the category name when that row is resolved. No data loss occurs.
- **Restoring an archived category:** `is_active` is set back to `true`. The category reappears at the bottom of the active list (its prior `sort_order` may be stale; restored categories are placed at the last active position).
- **Reordering at the top of the list:** The ↑ button for the first item is disabled so the action is not possible.
- **Reordering at the bottom of the list:** The ↓ button for the last item is disabled so the action is not possible.
- **Duplicate category name (active):** Saving is blocked and an inline validation error is shown. The duplicate check is case-insensitive against `name_en`.
- **Duplicate category name (archived):** Allowed — archived names are not reserved.

### Out of Scope

- Deleting categories — categories are never deleted, only archived, to preserve 20+ years of expense history.
- AI-suggested categories — out of scope for the whole app (see entity 002).
- Merging two categories into one — future concern.
- Category icons beyond emoji — not planned.
- Concurrent edits by both users simultaneously — if both users edit categories at the same time, the last write wins and no conflict resolution is applied. This is explicitly not handled.

## Stage Report: spec

- DONE: Read entity file and README.md spec template
  `/Users/ijac/Claude-ijac/expense-sheet/workflow/category-system.md` and `workflow/README.md`
- DONE: Wrote `## Spec` section with Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope
  Appended below existing ideation content; ideation content preserved intact
- DONE: All key decisions incorporated as instructed
  Archive = `is_active: false` (reversible), rename retroactive via `category_id`, ↑↓ reorder, new = last sort, archive button no confirmation, concurrent edits out of scope, no AI/merge/non-emoji icons
- DONE: Acceptance criteria are binary and independently testable (15 criteria)
  Each criterion references a specific UI element, field, or observable state
- DONE: Edge cases cover all five requested scenarios
  Archiving with past expenses, restoring, top/bottom reorder, duplicate name (active + archived variants)
- DONE: Committed with required message
  `git commit -m "spec: category-system entity 003"`

### Summary

Converted the ideation body for entity 003 (Category System) into a formal spec following the README template. The spec covers the full CRUD lifecycle for categories — add, rename, reorder, archive, restore — with 15 binary acceptance criteria and five edge cases. Concurrent edits are explicitly called out as out of scope with a last-write-wins note.
