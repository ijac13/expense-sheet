---
id: "013"
title: History Filter and Search
status: ideation
source: captain observation
started:
completed:
verdict:
score: 0.7
worktree:
issue:
pr:
---

The history list shows everything, which is overwhelming when you're looking for something specific. Filtering lets you narrow by who paid, which category, or a date range — and search lets you find by notes keyword.

## User Stories

- As a user, I want to filter history by category so I can see all food spending at once
- As a user, I want to filter by who paid so I can see my husband's entries separately from mine
- As a user, I want to filter by date range so I can review a specific month or period
- As a user, I want to search by keyword in notes so I can find a specific expense I remember partially

## Success

- History tab has a filter bar or icon that opens filter options
- Filter options: category (multi-select), paid by (me / my husband / both), date range
- Search bar accepts free text and matches against notes
- Filters and search can be combined
- Active filters are visually indicated so I know the list is filtered
- Clearing filters returns the full history list

### Out of Scope

- Saving filter presets
- Filtering on amount range (separate concern if needed)
- Full-text search across all fields — notes keyword search is sufficient

## Plan

Filter icon in the History tab header opens a bottom sheet (slides up from bottom). Active filters shown as chips below the header. Clear all resets to full history.

Filter options:
- **Category** — multi-select
- **Paid by** — me / husband / both (combinable with category)
- **Date range** — presets (this month, last month, last 3 months) + custom free range
- **Type** — all / manual only / subscription only

Search bar matches against: notes, category name, and subscription name.

Multiple filters can be active simultaneously. Filtering and searching happen client-side if the full history is loaded, or server-side via a Firebase Function query if the dataset is large.

## Open Questions

All resolved.
