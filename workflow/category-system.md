---
id: "003"
title: Category System
status: ideation
source: commission seed
started:
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
- Category icons beyond emoji

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

1. **Active** — list of active categories, each row tappable to edit (rename, change emoji, reorder)
2. **Archived** — collapsed section showing archived categories with option to restore

### Add Category

Tapping "+ Add category" opens a form:
- Emoji picker or text input for icon
- Name (EN) — required
- Name (繁中) — required
- Sort order — defaults to last position

On save: Firebase Function appends a row to the Categories tab.

### Edit Category

Tapping an existing category opens the same form pre-filled. Changes on save:
- Firebase Function updates `name_en`, `name_zh`, `icon`, `sort_order` in the Categories tab row

### Archive Category

From the edit screen, an "Archive" button (destructive style) sets `is_active: false`. No confirmation dialog needed — it's reversible.

### Rename Retroactivity

Because the Expenses tab stores `category_id` (not the name), renaming a category automatically affects all historical expenses on the next read — no migration needed.
