---
id: "012"
title: Expense History
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

Every expense ever logged should be browsable in one place. History gives both users a complete view of all past spending across all categories and dates.

## User Stories

- As a user, I want to browse all past expenses so I can review my full spending history
- As a user, I want to see who billed and who paid for each expense so I can track contributions between me and my husband
- As a user, I want expenses sorted by date so I can find recent transactions quickly

## Success

- History tab shows all expenses across all time, sorted by date (most recent first)
- Each row shows: date, who billed, who paid, amount, category
- Both users' entries are visible to both users

### Out of Scope

- Filtering or searching expenses (separate concern)
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
