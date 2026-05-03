---
id: "030"
title: Report Category Bars Use Wrong Color
status: spec
source: captain feedback
started: 2026-05-03T09:03:27Z
completed:
verdict:
score: 0.85
worktree:
issue:
pr:
---

The "BY CATEGORY" breakdown bars in the Reports page are all the same green instead of matching the colors used in the pie chart above them.

## Evidence

`feedback-screenshots/reports-003.png` — Pie chart shows multiple distinct colors per category (dark green, light green, yellow, orange/red). The "BY CATEGORY" list below (Fuel 43%, Groceries 27%, Daily Necessities 19%) renders all progress bars in the same dark green, losing the per-category color coding.

## Expected vs Actual

- **Expected:** Each category's bar uses the same color assigned to it in the pie chart (e.g. Fuel = its pie slice color, Groceries = its pie slice color)
- **Actual:** All bars are the same green regardless of category

## Root Cause

In `app/app/reports/page.tsx`, `CategoryRow` renders the progress bar with the hardcoded Tailwind class `bg-primary` (line ~134):

```tsx
<div className="h-full bg-primary rounded-full" style={{ width: `${cat.percentage}%` }} />
```

`DonutChart` assigns colors by array index from `DONUT_COLORS` at the top of the file, but never surfaces those colors to `CategoryRow`. The category list renders independently using `monthly.categories.map((cat) => <CategoryRow ... />)` with no color prop. Fixing this requires: (1) passing the per-index color to `CategoryRow`, and (2) replacing `bg-primary` with an inline `backgroundColor` style using that color.

---

## Spec

### Goal

Category progress bars in the "BY CATEGORY" list match the pie/donut slice color for the same category, making the two views visually consistent.

### User Stories

- As a user viewing the monthly report, when I see the pie chart and the category list below it, each bar's fill color matches that category's pie slice color so I can cross-reference at a glance.
- As a user viewing the annual report, the same color consistency applies between the donut chart and the category list.

### Acceptance Criteria

- **AC-1** In Monthly view, each category's progress bar fill color matches the corresponding slice color in the donut chart above it. Color is determined by the category's position index in the ordered `categories` array, using `DONUT_COLORS[index % DONUT_COLORS.length]`.
- **AC-2** In Annual view, each category's progress bar fill color matches the corresponding donut slice color using the same index-based lookup.
- **AC-3** `CategoryRow` receives the color as a prop and applies it via inline `backgroundColor` style, not a Tailwind color utility class.
- **AC-4** When fewer categories exist than palette entries, all bars use distinct colors (no two adjacent bars share a color unless there are more than 6 categories).
- **AC-5** When there are more than 6 categories, colors wrap using modulo — the 7th category gets the same color as the 1st, matching the donut chart's identical wrap behavior.
- **AC-6** No other visual appearance of the category list rows changes (layout, font, percentage text, amount, hover state).

### Edge Cases

- **Zero categories:** The "BY CATEGORY" section is already hidden when `total === 0`; no change needed.
- **Single category:** One bar fills to 100%, colored with `DONUT_COLORS[0]` — same as the single donut segment.
- **More than 6 categories:** Colors wrap via modulo, consistent with `DonutChart`.
- **Payer filter change:** Data reloads; color assignment is re-derived from the new array order, remaining consistent with the new donut chart.
- **Period switch (Monthly ↔ Annual):** Each view derives colors independently from its own `categories` array. Same category may get a different color if its position in the sorted list differs between periods — this is acceptable and consistent with the donut chart in each view.

### Out of Scope

- Assigning colors by stable category identity (e.g. category ID) across views or periods — the donut chart uses positional index today, and this fix matches that behavior.
- Changing the color palette (`DONUT_COLORS`).
- Fixing bar chart (Recharts `<Bar>`) colors — those use a separate `fill` prop and are a separate visual concern.
- Adding a color legend or tooltip.
- Changing the monthly trend chart in the annual view.

## Stage Report: spec

- DONE: Root cause identified with evidence from the codebase (specific component handling the category bar color)
  `app/app/reports/page.tsx` line ~134: `CategoryRow` uses hardcoded `bg-primary` Tailwind class; `DonutChart` assigns colors from `DONUT_COLORS` by index but never passes them to `CategoryRow`.
- DONE: Spec written with binary acceptance criteria covering the fix
  6 acceptance criteria added (AC-1 through AC-6), all independently verifiable; edge cases and out-of-scope section included.

### Summary

Root cause confirmed by reading `page.tsx`: `CategoryRow` always fills bars with `bg-primary` (dark green) while `DonutChart` uses a `DONUT_COLORS` array by position index, with no color passed between them. Spec defines the fix as adding a `color` prop to `CategoryRow` driven by `DONUT_COLORS[index % DONUT_COLORS.length]` and replacing the Tailwind class with an inline `backgroundColor` style. Acceptance criteria are binary and cover both Monthly and Annual views, wrap behavior, and visual-only change constraint.
