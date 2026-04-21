---
id: "012"
title: Expense History
status: spec
source: commission seed
started: 2026-04-20T10:00:00Z
completed:
verdict:
score: 0.8
worktree:
issue:
pr:
---

Every expense ever logged should be browsable in one place. History gives both users a complete view of all past spending across all categories and dates.

## User Stories

- As a user, I want to browse all past expenses so I can review my full spending history
- As a user, I want to see who billed and who paid for each expense so I can track contributions between me and my husband
- As a user, I want expenses sorted by date so I can find recent transactions quickly

## Success

- History tab shows all expenses across all time, sorted by date (most recent first)
- Each row shows: date, who paid, amount, category
- Both users' entries are visible to both users


### Out of Scope

- Filtering or searching expenses (entity 013)
- Editing or deleting from this view (entity 010)
- Reports and analytics (entity 005)

## Plan

### List View

Each row:

| Element | Value |
|---------|-------|
| Date | Expense date |
| Who billed | `created_by` — who logged it |
| Who paid | `paid_by` — who actually paid |
| Amount | In TWD |
| Category | Icon + name |

Sorted by expense date, most recent first. Grouped by day with a date header and daily total (same pattern as today's list on Home).

## Spec

### Goal

Display all expenses across all time, grouped by day and sorted most recent first, so both users can review the complete shared spending history in one place.

### User Stories

- As a user, I want to browse all past expenses across all time so I can review the complete spending history.
- As a user, I want expenses grouped by day with a daily total so I can quickly scan how much was spent on a given date.
- As a user, I want to see who billed and who paid for each expense so I can track each person's contribution.
- As a user, I want to see the current category name and icon for each expense so I understand what each spend was for.

### Acceptance Criteria

- [ ] History screen loads all expenses from the database, sorted by expense date descending (most recent first).
- [ ] Expenses are grouped under date headers; each date header displays the date and the sum of all expenses for that day.
- [ ] Each row displays: expense date, `created_by` (who billed), `paid_by` (who paid), amount in TWD, and the category icon and current category name resolved via `category_id`.
- [ ] Both users can see all expenses regardless of which user created them.
- [ ] When there are no expenses, an empty state message is shown (e.g., "No expenses yet").
- [ ] If a category has been renamed, the current name is shown (not the name at time of entry).
- [ ] Two expenses on the same day created by different users appear under the same date header.

### Edge Cases

- Empty state: no expenses have been logged yet — show a clear empty state message rather than a blank screen.
- Two expenses on the same day by different users: both appear under the same date header, daily total sums both amounts.
- Renamed category: category name is resolved at render time via `category_id`, so the current name is always shown.
- Very long history (performance): the list must remain responsive; consider pagination or virtual scrolling if the expense count is large.

### Out of Scope

- Filtering or searching expenses (entity 013)
- Editing or deleting expenses from this view (entity 010)
- Reports and analytics (entity 005)

## Stage Report: spec

Spec written from ideation content. All key decisions confirmed:

- Full history across all time, most recent first
- Grouped by day with date header and daily total
- Row fields: date, `created_by`, `paid_by`, amount, category icon + name
- Category name resolved to current value at render time
- Both users see all entries
- Edge cases covered: empty state, same-day multi-user entries, renamed categories, large dataset performance
