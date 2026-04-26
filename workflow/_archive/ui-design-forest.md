---
id: "015"
title: UI Design — Forest Theme
status: done
source: captain design
started: 2026-04-22T05:00:00Z
completed: 2026-04-25
verdict: PASSED
score: 0.9
worktree:
issue:
pr:
---

Full visual redesign of the app using a custom forest green daisyUI theme. Replaces emoji with lucide-react line icons, restructures the expense entry flow to be category-first with a compact entry dock, and updates the tab bar, history, and reports screens.

## Design Brief

- Theme: warm sage background (`base-100: #f4f7f2`), deep forest green primary (`#1e6d4a`)
- Font: Roboto 400/500/600
- Icons: lucide-react line style, strokeWidth 1.6, no emoji in UI chrome
- Entry flow: category grid as primary surface, amount/note/date/payer in a compact dock, full keypad opens as bottom sheet
- Tab bar: pill highlight on active tab
- Reports: SVG donut chart replacing recharts PieChart

## Success

- Forest theme renders on all screens
- All category emoji replaced with lucide icons
- Category picker is the default view on the home screen
- Amount entry opens as a bottom sheet from the dock
- Tab bar uses pill-style active indicator
- History page shows month headers + date group headers with lucide icon rows
- Reports page uses SVG donut chart with forest palette

## Feedback (from captain review)

- [ ] Home tab moved to the middle position (3rd of 5 tabs)
- [ ] Date, payer, and note inputs moved inside the keypad sheet — only category grid visible behind the dock
- [ ] Settings page shows the name of the currently signed-in user
- [ ] Keypad sheet "Done" button renamed to "Submit"

## Stage Report: build

- DONE: Install lucide-react
- DONE: Replace daisyUI theme in globals.css — forest green oklch palette, Roboto font
- DONE: Add CATEGORY_ICONS map to lib/categories.ts — 22 lucide icons
- DONE: Rewrite CategoryPicker.tsx — lucide icon tiles, primary fill on selection, 4-col grid
- DONE: Rewrite TabBar.tsx — 5 tabs with pill-highlight active state using lucide icons
- DONE: Rewrite page.tsx — category-first layout, entry dock, KeypadSheet bottom sheet
- DONE: Rewrite TodayExpenseList.tsx — lucide icon rows, grid layout
- DONE: Update history/page.tsx — month headers, date group headers, lucide rows
- DONE: Update reports/page.tsx — SVG donut chart, forest color segments, updated header
- DONE: Fix EditExpenseClient.tsx — updated CategoryPicker prop names
- DONE: Build passes — 14 static pages, TypeScript clean
- DONE: Commit b2d82de
