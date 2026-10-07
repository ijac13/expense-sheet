# Annual report: cost groups first, last-year comparison

## Decisions

- Annual view only. Monthly may come later, after you've used this.
- Remove the Donut / Bar toggle.
- Monthly trend: this year and last year side by side, plus an enlarge icon.
- "Compare to last year" compares the same stretch of time: Jan 1 to today's date, last year.

## One question (new, from the enlarge icon)

**How landscape works.** iPhones don't let a web page turn the screen sideways by itself. So the enlarge icon opens the chart full screen, already drawn sideways: you turn the phone and read it. Tap ✕ to close. If the phone is already sideways, it fills the screen normally.
- Your answer:

## Goal

One annual card that answers "where did the money go, and how does it compare to last year?" — instead of two overlapping lists and two donuts.

## Changes (Annual view)

### 1. Remove the total donut

- Remove the Donut / Bar toggle and the all-categories chart under it.
- Keep the Fixed / Big extras / Living costs donut inside the cost groups card.

### 2. Merge "By category" into the cost groups card

- Remove the separate "By category" list.
- The rows under Fixed and Living costs take over its look: name, amount, colored progress bar, and percent of the year total. Tapping a row still opens the drill-down.
- Big extras keeps its list of individual expenses.
- Every category still appears exactly once, under its group, so nothing is lost.

### 3. Monthly trend vs last year

- Each month gets two bars: this year (green) and last year (light gray). Tapping a month shows both amounts.
- A small legend shows which color is which year.
- Months not reached yet this year show only last year's bar.
- An enlarge icon in the card's corner opens the big landscape version (see question above).

### 4. "Compare to last year" button

- A button at the top of the cost groups card toggles comparison on and off. Off by default.
- When on, each group header and each category row shows last year's amount and a ▲/▼ % badge (same badge as the Monthly view: red = spent more, green = spent less).
- **What "last year" covers:** viewing 2026 today (Oct 7) compares against Jan 1 – Oct 7, 2025. Viewing a finished year (e.g. 2025) compares full year against full year (2024).
- The button label says the range, e.g. "vs Jan 1 – Oct 7, 2025", so it's clear which period you're seeing.
- A category that existed only last year shows up with NT$0 this year, so drops are visible.

## How it's built (for reference)

- Report data (`app/app/lib/reportService.ts`): the annual summary also computes last year's monthly totals and last year's cost groups for the matching date range, using the same grouping rules. No backend change; all data is already loaded in the app.
- Screen (`app/app/reports/page.tsx`): the edits above.
- Tests updated for the removed sections and the new comparison.
- Ship: branch → PR → merge → deploy, per the README.
