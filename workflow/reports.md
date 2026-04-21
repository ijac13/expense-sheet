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

## Spec

### Goal

Provide monthly and annual spending reports with category breakdowns, payer filters, and drill-down capability so users can understand where their money goes and spot trends over time.

### User Stories

- As a user, I want to see a monthly summary of spending by category and payer so I can understand where money went this month.
- As a user, I want to compare this month against last month and the same month last year so I can spot trends.
- As a user, I want an annual view with month-by-month totals so I can see the full year at a glance.
- As a user, I want to tap a category to drill into the individual expenses behind it so I can investigate specific spending.
- As a user, I want to filter the report by payer so I can see my spending separately from my husband's.

### Acceptance Criteria

- [ ] Reports tab defaults to monthly view showing the current month's total spend.
- [ ] A period selector at the top switches between Monthly (default) and Annual views.
- [ ] Monthly view displays: total spend, category breakdown (amounts and percentages), payer breakdown, comparison to previous month and same month last year (delta per category).
- [ ] Category breakdown renders as a pie chart by default; a toggle switches it to a bar chart.
- [ ] Payer filter (All / Me / Husband) defaults to All and applies to all charts and totals in the current view.
- [ ] Annual view displays: total spend for the year, category breakdown (pie or bar, same toggle), month-by-month totals for the year.
- [ ] Tapping any category in either view opens a drill-down screen listing all expenses in that category for the selected period.
- [ ] The drill-down screen has a Back button that returns to the report without resetting the period or payer filter.
- [ ] Spending Insights (entity 014) appears as a section at the bottom of both monthly and annual views.
- [ ] Reports screen triggers Google re-authentication once per session (entity 006) before data loads; subsequent navigations within the session skip re-auth.
- [ ] All aggregation is performed server-side via a Firebase Function; no raw expense rows are sent to the client for reports.
- [ ] Monthly view navigates back and forward one month at a time via prev/next controls.
- [ ] Annual view navigates back and forward one year at a time via prev/next controls.

### Edge Cases

- No expenses yet: both views show an empty state with a prompt to start logging; no chart is rendered.
- Only one month of data: monthly comparison section shows "no data" for the previous month and same-month-last-year slots rather than zeroes or errors.
- Same month last year has no data: the year-over-year comparison slot shows "no data" rather than a zero-delta.
- Switching between Monthly and Annual mid-session: payer filter persists; period resets to the current month or current year respectively.
- Payer filter set to a single user, then drill-down opened: drill-down list respects the active payer filter.
- Firebase Function returns an error: report screen shows an error state with a retry action; no partial data is displayed.

### Out of Scope

- Custom fiscal year or arbitrary date range summaries
- Export to CSV or PDF
- Budget targets or alerts
- Predictive spending forecasts
- Per-category trend lines across multiple months in monthly view
- Splitting individual expenses between payers within the report

## Stage Report: spec

- DONE: Read entity ideation content and workflow README spec template
  Source files: `/Users/ijac/Claude-ijac/expense-sheet/workflow/reports.md`, `/Users/ijac/Claude-ijac/expense-sheet/workflow/README.md`
- DONE: Wrote formal `## Spec` section with Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope
  Appended below existing ideation content; ideation not modified
- DONE: Incorporated all key decisions (two views, pie/bar toggle, payer filter, drill-down, entity 014 insights, entity 006 re-auth, server-side aggregation)
  All decisions from dispatch prompt reflected in acceptance criteria
- DONE: Covered all four specified edge cases plus two additional real-world scenarios
  Empty state, one month of data, same-month-last-year missing, mid-session view switch, filter+drill-down interaction, Firebase error
- DONE: Appended `## Stage Report: spec` section
  This section

### Summary

Converted the ideation and plan content for entity 005 Reports into a formal spec. Acceptance criteria are scoped to be binary and independently testable. Key architectural decisions (server-side aggregation, session-scoped re-auth, entity 014 and 006 integration) are encoded as explicit criteria rather than notes.
