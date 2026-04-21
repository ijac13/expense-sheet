---
id: "005"
title: Reports
status: spec
source: commission seed
started: 2026-04-21T02:00:00Z
completed:
verdict:
score: 0.7
worktree:
issue:
pr:
---

The point of logging everything is to understand where money is going. Monthly summary with category and payer breakdowns. Month-over-month comparison and same-month-last-year comparison so I can spot trends. Annual summary to see the full year at a glance. Ability to drill into a specific category or person. This is how the app pays for the habit — the insight that comes from consistent logging.

## User Stories

- As a user, I want a monthly spending summary so I can see how much we spent in total and per category
- As a user, I want to compare this month to last month and the same month last year so I can spot trends
- As a user, I want an annual summary so I can see how the full year broke down by category
- As a user, I want to drill into a category to see all expenses that belong to it
- As a user, I want to filter by who paid so I can see my spending separately from my husband's

## Success

- Reports tab shows the current month's total spending by default
- Period selector: monthly view (default) and annual view
- Monthly view: breakdown by category with amounts and percentages, breakdown by payer, comparison to previous month and same month last year
- Annual view: total for the year, breakdown by category, month-by-month trend for the year
- Drill-down: tapping a category shows all expenses in that category for the selected period
- Reports require Google re-authentication before loading (see entity 006)

### Out of Scope

- Custom fiscal year or arbitrary date range summaries
- Export to CSV or PDF
- Budget targets or alerts
- Predictive spending forecasts

## Plan

### Reports Screen Layout

Period selector at top: **Monthly | Annual**. Payer filter: all / me / husband.

**Monthly view** (default: current month):
1. **Total** — large number, total spend for selected month
2. **By category** — pie chart (switchable to bar chart), sorted by amount descending, tappable to drill in; payer filter defaults to all users
3. **By payer** — split between the two users
4. **Comparison** — this month vs previous month and vs same month last year, delta per category
5. **Insights** — AI advice card (entity 014), auto-generated at month-end

**Annual view** (default: current year):
1. **Total** — total spend for the year
2. **By category** — pie chart (switchable to bar chart), full year breakdown sorted by amount
3. **Month trend** — month-by-month totals for the year
4. **Insights** — AI advice card (entity 014) for the full year

Tapping a category row in either view → opens a new screen showing the expense list for that category and period. Back button returns to the report.

### Data

All aggregation done server-side in a Firebase Function — reads Expenses tab, filters and sums, returns structured data. No raw expense rows sent to client for reports.

### Re-authentication

Reports screen triggers Google re-auth once per session (see entity 006 for auth flow).

## Open Questions

All resolved.
