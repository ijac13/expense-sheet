---
id: "021"
title: Emoji Category Icons — Replace Lucide Icons Everywhere
status: verify
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

## Stage Report: build

- DONE: CategoryPicker.tsx — replaced `CATEGORY_ICONS` lookup + `<Icon size={22} />` with `<span className="text-2xl">{cat.icon ?? "💰"}</span>`; removed `Package` and `CATEGORY_ICONS` imports
  commit dac823c
- DONE: app/page.tsx — `SelectedIcon` and `CATEGORY_ICONS`/`Package` imports already absent from HEAD; meta row already used emoji via `selectedCat?.icon`; confirmed no changes needed
  git show HEAD:app/app/page.tsx confirms clean state
- DONE: history/page.tsx — replaced lucide icon in expense rows with `<span className="text-xl">{cat?.icon ?? "💰"}</span>`; replaced `SelectedIcon` in bottom sheet with `<span className="text-3xl">{selectedCat?.icon ?? "💰"}</span>`; removed `Package` and `CATEGORY_ICONS` imports
  commit dac823c
- DONE: reports/page.tsx — no `CATEGORY_ICONS` usage present; CategoryRow renders no icon; no changes needed
  verified via grep
- DONE: reports/DrillDown.tsx — icon prop already rendered as `<span className="text-3xl">{icon}</span>`; no changes needed
  verified via grep
- DONE: build passes — `npm run build` from `app/` compiled with no TypeScript errors
  14/14 static pages generated

### Summary

All five category display surfaces were audited. CategoryPicker and History page required changes; Home page, Reports page, and DrillDown were already using emoji or required no icon changes. CATEGORY_ICONS map is retained in categories.ts but no longer imported in any changed file. Build passes clean.
