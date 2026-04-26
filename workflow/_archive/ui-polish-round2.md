---
id: "018"
title: UI Polish — Round 2 Captain Review
status: done
source: captain feedback
started: 2026-04-22
completed: 2026-04-22
verdict: PASSED
score: 0.9
worktree:
issue:
pr:
---

Second round of visual tweaks from captain review. All items applied in commit `7a5abb6` and deployed to https://expense-sheet-b2db8.web.app.

## Applied Fixes

1. **Top padding too large** — reduced `pt-12` → `pt-6` across home, history, reports, settings, subscriptions, and DrillDown header

2. **Forest theme not active** — `data-theme="fantasy"` → `"forest"` in `layout.tsx`; `theme-color` meta tag updated from `#5c1a5a` → `#1e6d4a`

3. **Donut chart too small** — enlarged SVG from 180×180 → 240×240, radius 66 → 88, strokeWidth 18 → 22, center point updated to 120×120

4. **Reports page stale** — stale `app/out` from pre-i18n build caused reports to route to home. Fixed by clean rebuild (`rm -rf out .next`).

## Notes

- "Today" logged count in Home header made `text-base font-semibold` (larger) in a prior session
- "History" and "Reports" tab order swapped as requested — already in production
