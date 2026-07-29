---
id: 041
title: Generate Insights Uses Latest Month, Not Viewed Month
status: ideation
source: captain (previously discussed, not yet tracked)
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Spending Insights (entity 014) was specced to analyze whichever period the user is currently looking at — "monthly or annual depends on user is looking at monthly report or annual report" — but it actually always generates analysis for the latest month, regardless of which month is open in Reports. Example: viewing May in Reports and tapping Generate Insights returns July's analysis.

## User Stories

- As a user, I want Generate Insights to analyze the month I'm currently viewing in Reports, so the advice matches the numbers on screen.
- As a user, I want annual insights to analyze the year I'm currently viewing, for the same reason.

## Success

- Tapping "Generate Insights" while viewing a specific month in Reports generates analysis for that month, not the latest/current calendar month.
- Tapping "Generate Insights" while viewing a specific year (annual view) generates analysis for that year.
- Navigating to a different month/year and generating again produces analysis for the newly selected period.
- Verify against the currently-deployed insights-cache work (entity 039): the cache key must be scoped per period, so cached insights for one month aren't shown while viewing another.

### Out of Scope

- Changing the analysis content, tone, or AI prompt itself (entity 014)
- Changing how results are cached or the "Regenerate" mechanic (entity 039) — only which period's data feeds it

## Plan

Likely the Firebase Function that gathers insights data defaults to `now()` instead of receiving the month/year currently selected in the Reports UI. Trace how the Reports screen calls the insights endpoint and confirm the selected period is passed through and used for both the "this period" data and the comparison periods (previous 3 months, same period last year).
