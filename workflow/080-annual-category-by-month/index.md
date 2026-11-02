---
id: 080
title: Reports > Annual category drilldown shows monthly totals, trend chart, then expenses
status: ideation
source: captain (request, 2026-11-02)
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:080:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:080-ideation-1
              briefing:
                id: briefing:080:ideation:attempt-1:revision-1
                digest: sha256:bf5fc23e14fa53b796b03a5a5893c01b9f7a86df6efdb383f984993f607f9ef8
                room-ref: '@review/ideation/briefing-1'
---

In Reports > Annual, clicking a category lists every single expense from the year (e.g. five Daily Necessity items in October, five more in September), which makes it hard to see how spending in that category changes month to month.

## User Stories

- As the captain, I want clicking a category on Annual to show one total per month (October, September, August, ...) for that category, so that I can compare how it changes over the year.
- As the captain, I want a monthly trend chart for just that category, so that I can see the change at a glance.
- As the captain, I want to click a month (e.g. October) inside that category to see its individual expenses (e.g. the five Daily Necessity items), so that I can still check the details when I need them.

## Success

- Clicking a category on Annual shows one row per month with that category's monthly total, instead of the flat list of every expense.
- The category view includes a chart of that category's monthly totals across the year.
- Clicking a month row shows that month's individual expenses for the category.

### Out of Scope

- Changing the Monthly tab's category drilldown.
- Changing which expenses belong to a category.

## Plan

{Spec: decide layout, how the category trend relates to the Life only / Include business toggle, and how month rows open.}

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles
