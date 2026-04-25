---
id: "021"
title: Emoji Category Icons — Replace Lucide Icons Everywhere
status: build
source: captain feedback
started: 2026-04-25
completed:
verdict:
score: 0.9
worktree:
issue:
pr:
---

Category icons are currently rendered as lucide-react SVG icons (e.g. `ShoppingCart`, `Coffee`). Captain wants emoji used consistently everywhere in the app — Home category picker, History rows, Reports drill-down, and Category Management — matching what is already shown in Category Management.

## What to change

- `DEFAULT_CATEGORIES` in `app/lib/categories.ts` already has an `emoji` field on each category. Use that field instead of `CATEGORY_ICONS` (lucide) wherever categories are displayed.
- Remove or stop using `CATEGORY_ICONS` map for display purposes (can keep for fallback or delete if unused).
- Affected surfaces: Home category picker grid, History expense rows, History detail bottom sheet, Reports category rows and drill-down header, DrillDown component header.
- Render emoji as a `<span>` with appropriate font size rather than an SVG icon component.
