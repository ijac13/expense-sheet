---
id: "005"
title: Reports
status: ideation
source: commission seed
started:
completed:
verdict:
score: 0.7
worktree:
issue:
pr:
---

The point of logging everything is to understand where money is going. Monthly summary with category and payer breakdowns. Month-over-month comparison so I can see trends. Ability to drill into a specific category or person. Filter by date range, category, and who paid. This is how the app pays for the habit — the insight that comes from consistent logging.

## User Stories

- As a user, I want a monthly spending summary so I can see how much we spent in total and per category
- As a user, I want to compare this month to last month and the same month last year so I can spot trends
- As a user, I want to drill into a category to see all expenses that belong to it
- As a user, I want to filter by who paid so I can see my spending separately from my husband's

## Success

- Reports tab shows the current month's total spending by default
- Breakdown by category: each category shows total amount and percentage of total
- Breakdown by payer: total spent by each user
- Month-over-month comparison: this month vs last month, per category
- Drill-down: tapping a category shows all expenses in that category for the selected period
- Filter by date range, category, and who paid
- Reports require Google re-authentication before loading (see entity 006)

### Out of Scope

- Annual or custom fiscal year summaries — monthly is sufficient
- Export to CSV or PDF
- Budget targets or alerts
- Predictive spending forecasts

## Plan

### Reports Screen Layout

Default view: current month. Controls at top: month picker, payer filter (all / me / husband).

Sections:
1. **Total** — large number, total spend for selected month
2. **By category** — horizontal bar chart or list, sorted by amount descending
3. **By payer** — split between the two users
4. **Month comparison** — this month vs previous month, delta per category

Tapping a category row → drills into an expense list for that category and month.

### Data

All aggregation done server-side in a Firebase Function — reads Expenses tab, filters and sums, returns structured data. No raw expense rows sent to client for reports.

### Re-authentication

Reports screen triggers Google re-auth on every open (see entity 006 for auth flow).

## Open Questions

- **Chart type** — bar chart, pie chart, or just a sorted list for category breakdown? What feels most useful on mobile?
- **Comparison period** — always compare to the previous month, or let the user pick any two months to compare?
- **Payer filter default** — does it default to "all users" or "just me"?
- **Drill-down navigation** — when drilling into a category, does it open a new screen or expand inline?
