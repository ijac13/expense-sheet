---
title: "Income & earnings: tap a cost to see its expenses"
source: captain, 2026-10-12 — "in the Report > 收入與盈餘, when I click the category, direct me to the expense detail like Report. e.g. when I click 修車 under Uber expense, direct me to see the 修車 under Uber detail."
score: 0.6
id: 077
status: done
completed: 2026-10-12T11:05:07Z
verdict: PASSED
pr: '#51'
archived: 2026-10-12T11:05:07Z
---

On Reports, tapping a category opens its list of expenses for the period. On Reports › 收入與盈餘 the Uber and Rent cards list their cost categories (e.g. 修車 under Uber) but tapping one does nothing, so the captain can't see which expenses make up a business cost.

## User Stories

- As the captain, I want to tap 修車 on the Uber card and see the 修車 expenses that counted toward Uber in that month (or year), the same list Reports shows.

## Success

- Every cost line on the Uber and Rent cards opens the existing Reports drill-down for that category, filtered to that business and the page's period; Back returns to 收入與盈餘 on the same period.
- Editing an expense from there refreshes the earnings numbers.

## Plan

- Reuse `app/app/reports/DrillDown.tsx`: it already accepts `group` (`"uber"` / `"rent"` are cost groups since the income feature), so the list is filtered to the business for free.
- `app/app/reports/earnings/page.tsx`: make each cost row a button that opens DrillDown with `categoryId`, `group = card.business`, and the page's year/month; refetch the summary on `onDataChanged`.
- Render test: tapping a business cost row shows only that category's expenses for that business.

Open questions for ideation:

1. Should the income lines also open a list of their income rows? — **captain: yes** (2026-10-12). Income lines open a list of that category's income rows for the period (business-filtered on the Uber/Rent cards).

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles

- 2026-10-12: captain checked on staging and said ship. PR #51 merged (0bc0e86); production website deployed — served index.html matches the build; slice-list, drill-total and the new colours are in the live chunks.
