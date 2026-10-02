---
id: 071
title: Split Report > Annual categories into fixed and flexible
status: ideation
source: captain
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
---

## Open questions (captain answers inline)

1. **Where does the split go?** Recommended: replace today's single "By category" list in Annual with two sections — Fixed and Flexible — each with its own total. Alternative: keep today's list and add a separate fixed/flexible summary block above it.
   - Answer:
2. **Fixed section detail:** show the total only, or the total plus each of the four categories underneath? Recommended: total plus each of the four (one tap still opens the drill-down, same as today).
   - Answer:
3. **Who decides which categories are fixed?** Recommended: the four are fixed in code for now (insurance, babies, mortgage, tuition). Alternative: a "fixed" switch per category in Settings, so the list can change without a code change.
   - Answer:
4. **Annual only, or the Monthly tab too?** Recommended: Annual only for this round; Monthly can follow if the split proves useful.
   - Answer:
5. **Donut/bar chart:** keep it as today (all categories), or split it too? Recommended: keep as today.
   - Answer:

## Goal

In Report > Annual, separate spending the household cannot adjust from spending it can cut, so the places to cut back are obvious at a glance.

- **Fixed** (cannot adjust): insurance, babies, mortgage, tuition. Show their combined total.
- **Flexible** (everything else): show the combined total and each category, since these are the ones to cut back.
- The monthly trend chart stays at the top of Annual (shipped in 070).

## User Stories

- As a user opening Report > Annual, I want fixed and flexible spending shown as two totals so that I see how much of the year is locked in versus adjustable.
- As a user reviewing where to save, I want each flexible category listed with its amount so that I can pick which ones to cut.
- As a user, I want the fixed categories kept out of the flexible list so that they don't distract from what I can change.

## Success

- Annual shows a Fixed total and a Flexible total that add up to the year total.
- Each flexible category is listed with its spend.
- Insurance, babies, mortgage, and tuition never appear in the flexible list.

## Known risks (for spec)

- Category ids can differ between staging and production (e.g. staging-only `cat_003`); `app/app/lib/reportService.ts:25` already resolves by name. The fixed list must match on the same basis so it works in both environments.
- No "fixed" flag exists on categories today (`app/app/lib/categories.ts`).

### Out of Scope

- Marking single recurring items (e.g. one sports subscription) as fixed — carried over from the original 071, deferred.
- A "realistic cut" estimate (projected monthly/yearly savings) — carried over from the original 071, deferred.
- Multi-year projection of when fixed costs end — dropped with 072 (captain already has a forecast).
- Changing the monthly trend chart (done in 070).

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles
