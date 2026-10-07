# Monthly report: compare to last month and to the same month last year

## Decisions

- Monthly gets the Fixed / Big extras / Living costs card; the total donut, Donut / Bar toggle and By category list go away.
- Two comparisons on the card: **last month** and **same month last year**.
- The bottom Comparison card keeps "vs previous month" and adds "same month last year", same days only (Oct 1–7, 2025 vs Oct 1–7, 2026).

## One question

**Does "last month" also count the same days?** Viewing October today (Oct 7), I'll compare against **Sep 1–7**, not all of September, so both comparisons are fair and the card and the button always agree. A finished month compares whole month to whole month. (A short month caps at its last day: Mar 1–30 compares against Feb 1–28.)
- Your answer:

## Goal

Monthly answers: "where did this month's money go, and how does it compare to last month and to the same days last year?"

## Changes (Monthly view)

- **Cost groups card**: Fixed / Big extras / Living costs with its donut; rows with bar + percent of the month; tap a row to drill down.
- **Compare control** at the top of that card, three options: Off · vs Sep 1–7 · vs Oct 1–7, 2025 (labels show the real range). The chosen one shows its amount and ▲/▼ % per group, per category and for the total. Categories spent on only in the compared period show at NT$0.
- **Comparison card**: two lines, "vs Sep 1–7" and "vs Oct 1–7, 2025", each with amount and ▲/▼ %, matching the button.
- Removed: total donut, Donut / Bar toggle, By category list.
- Unchanged: month picker, total header, By payer, AI Insights. Annual is unchanged.

## How it's built (for reference)

- Report data (`app/app/lib/reportService.ts`): the monthly summary returns cost groups for the month plus for both compared periods, reusing Annual's grouping and day cutoff.
- Screen (`app/app/reports/page.tsx`): Annual's card learns to hold one or two comparisons.
- Tests updated; ship: branch → PR → staging preview → merge → production deploy.
