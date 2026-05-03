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

## Likely Cause

The bar component likely hardcodes a green fill color instead of pulling from the same color palette/mapping used by the pie chart. The fix is to share the category→color mapping between the pie chart and the bar list.

## Acceptance Criteria

- **AC-1** Each category bar uses the same color as its corresponding pie slice
- **AC-2** Color assignment is consistent — same category always gets the same color within a view
- **AC-3** Works for both Monthly and Annual views
