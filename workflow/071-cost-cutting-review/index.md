---
id: 071
title: Split Report > Annual into fixed, big extras, and living costs
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

1. **Past expenses:** the "big extra" tick is new, so every expense before it ships is unticked. How should past big extras get marked? Recommended: captain ticks them by hand in the app's expense edit screen (2026 only). Alternative: mark them directly in the Google Sheet's Expenses tab.
   - Answer:
2. **Tick vs. fixed category:** if an expense in a fixed category (e.g. a one-off insurance payment) is ticked as big extra, which group wins? Recommended: the tick wins, so the captain's explicit choice always applies.
   - Answer:

## Decisions (captain, 2026-10-02 review)

- **Placement:** keep today's "By category" list as is; add a new summary block above it.
- **Fixed detail:** show the fixed total plus each fixed category underneath (tap opens drill-down, as today).
- **Who sets "fixed":** an on/off "fixed" switch per category in Settings. Starts on for insurance, babies, mortgage, tuition.
- **Big extras (大筆額外):** a "big extra" tick on each expense, set when adding or editing it.
- **Scope:** Annual tab only this round.
- **Charts:** keep today's donut/bar chart; add a second donut showing the share of each group.

## Goal

In Report > Annual, split the year into the same three groups the captain's own planning sheet uses, so living costs — the part that can be cut back — stand out.

| Captain's sheet column | In the app |
|---|---|
| Insurance 保費, Babies, Mortgage 房貸, Tuition 學費 → Total 固定 | **Fixed:** categories switched on as fixed in Settings, each listed, plus their total |
| 大筆額外 | **Big extras:** expenses ticked "big extra", plus their total |
| 生活費預估 | **Living costs:** everything else, each category listed, plus their total |
| Total Spending | The year total already shown |

The three group totals add up to the year total. The monthly trend chart stays at the top of Annual (shipped in 070).

## User Stories

- As a user opening Report > Annual, I want fixed, big extras, and living costs shown as three totals so that I see how much of the year is locked in, one-off, or everyday.
- As a user reviewing where to save, I want each living-cost category listed with its amount so that I can pick which ones to cut.
- As a user adding a large one-off expense, I want to tick it as a big extra so that it doesn't inflate my everyday living costs.
- As a user, I want to choose which categories count as fixed in Settings so that the split changes when my life does.
- As a user, I want a donut showing each group's share of the year so that the balance is visible at a glance.

## Success

- Annual shows Fixed, Big extras, and Living costs totals that add up to the year total.
- Each fixed and each living-cost category is listed with its spend.
- A ticked expense counts under Big extras, not under its category's group.
- Switching a category's "fixed" setting in Settings moves it between groups on the next report load.
- A new donut shows the three groups' shares; the existing donut/bar chart is unchanged.

## Known risks (for spec)

- Category ids can differ between staging and production (e.g. staging-only `cat_003`); `app/app/lib/reportService.ts:25` already resolves by name. The fixed setting must be stored on the category itself so it works in both environments.
- No "fixed" field exists on categories and no "big extra" field exists on expenses today. Both need a new optional column in the Sheet (`functions/src/sheetSchema.ts` already supports optional columns created on demand).

### Out of Scope

- Monthly tab split (may follow later).
- Marking single recurring subscriptions as fixed — from the original 071, deferred.
- A "realistic cut" savings estimate — from the original 071, deferred.
- Multi-year projection of when fixed costs end — dropped with 072 (captain already has a forecast).
- Changing the monthly trend chart (done in 070) or the existing donut/bar chart.

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles

- 2026-10-02 review: captain answered the five ideation questions and added the big-extras group (per-expense tick, chosen over category-level or amount threshold).
