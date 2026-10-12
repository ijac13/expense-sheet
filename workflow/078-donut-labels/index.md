---
title: "Reports: % and short amount on each slice of the cost-group donut"
status: ideation
source: 'captain, 2026-10-12 — "on the report, the expense pie chart, can you add numbers of each — fixed, big extras, living costs, Uber, Rent" / "show % and short numbers, e.g. 57%, 17.5K"'
score: 0.5
id: 078
---

The cost-group donut on Reports shows only coloured slices and the total in the middle; the captain has to read the list below to know what each slice is worth.

## User Stories

- As the captain, I want each slice of the donut to show its share and amount (e.g. `57%` / `17.5K`) so I can read the split at a glance.

## Success

- Every visible slice (Fixed, Big extras, Living costs, and Uber / Rent when "Include business costs" is on) carries a label with its % and short amount: under 1,000 as-is, then `17.5K`, `1.2M`.
- Labels follow the same shares the legend shows (the % adds up the same way), in monthly and annual views, light and dark themes, and fit a phone screen.

## Plan

- `app/app/reports/page.tsx` `DonutChart`: optional `labels` mode that places a two-line label (`57%` over `17.5K`) at each slice's mid-angle, just outside the ring; the SVG grows a margin so labels fit at phone width.
- ~~Rename Living costs to Life~~ — dropped by the captain the same day ("Don't rename Living costs to Life").
- A small `shortAmount(n)` helper (17,500 → `17.5K`), unit-tested.
- Render test: each group's slice label shows its % and short amount; the % matches the legend's.

Open questions for ideation:

1. Very small slices — hide their label or always show? — **captain: always show every label** (2026-10-12).

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles

- 2026-10-12: built on branch donut-labels (65bcbbc, on top of 077's earnings-drilldown so staging shows both). App tests 290/290. Deployed to staging; served index.html matches build, chunk carries slice-label.
