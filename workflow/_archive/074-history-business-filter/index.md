---
id: 074
title: "History: Uber and Rent filters"
status: done
source: captain, 2026-10-12 — "in the History, we have All, Expense, Income, add Uber and Rent, so I can see the details of Uber and Rent"
started:
completed: 2026-10-12T10:43:42Z
verdict: PASSED
score: 0.6
worktree:
issue:
pr: #50
mod-block:
archived: 2026-10-12T10:43:42Z
---

History filters by All · Expenses · Income only, so the captain cannot see one business's whole story — its income and its tagged costs — in one list.

## User Stories

- As the captain, I want a Rent filter in History so that I see rent received, rent paid and tenant costs together.
- As the captain, I want an Uber filter in History so that I see Uber income and Uber-tagged costs (fuel, car wash) together.
- As the captain, I want the day and month totals under Uber or Rent to show the net, so I see what the business earned.

## Success

- History chips read All · Expenses · Income · 🚗 Uber · 🏠 Rent, scrolling sideways on a narrow phone.
- Uber / Rent show that business's income plus every expense whose business (own tag, else category default) matches.
- Under Income, Uber and Rent, day and month totals show the signed net; All and Expenses keep showing spending.

### Out of Scope

- New charts; the Income & earnings page already charts each business.

## Plan

Already built ahead of the workflow on branch `history-business-filter` (commit `daaae21`): `app/app/history/page.tsx` adds `uber`/`rent` to the kind filter, an `entryBusiness` resolver (income → category business; expense → `businessOf`), net totals for Income/Uber/Rent. New render test in `app/test/income-earnings.render.test.js`; app suite 285 pass. Not yet on staging.

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles

- 2026-10-12: captain checked on staging ("074 is good"). PR #50 merged (6a50fe6); production website deployed, served index.html matches build, history chunk carries month-total.
