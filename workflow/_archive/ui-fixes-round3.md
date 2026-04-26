---
id: "019"
title: UI Fixes — Round 3 Captain Review
status: done
source: captain feedback
started: 2026-04-25
completed:
verdict: PASSED
score: 1.0
worktree:
issue:
pr:
---

Six UI/UX fixes from captain review after first live session with real data.

## Issues

1. **History expense detail not showing** (history-001) — tapping a row in History opens nothing. The inline bottom sheet is not rendering. Likely a state or render bug introduced during the async rewrite.

2. **Category scroll area too small** (home-003) — category grid area is too small for comfortable scrolling. Calculator takes up too much vertical space. Captain has a reference screenshot at `ref-home-003` showing the desired proportions. Adjust the flex split between the scrollable category area and the fixed calculator dock.

3. **Date headers in History need more prominence** — each date group header should clearly show the date label AND the daily total amount so captain can scan totals at a glance without opening individual rows.

4. **Submit success feedback** — after tapping Save/Submit, there is no confirmation that the expense was recorded. Add a lightweight response: brief toast, amount flash, or similar — something that confirms success without interrupting flow.

5. **Remove "Log Another" button** — the calculator stays visible and users can just type a new amount after submitting. The "Log Another" button is redundant. Remove it; keep only the single Submit/Save button.

6. **Back button missing on User Management and Category Management pages** — no way to navigate back to Settings from either sub-page. Add a back button or header nav.

## Stage Report: build

- DONE: Fix 1 — History bottom sheet not opening
  Added `createPortal(…, document.body)` in `app/history/page.tsx` so the sheet renders at the document root, bypassing any stacking context from parent wrappers. Commit f6a8353.
- DONE: Fix 2 — Calculator vertical space reduction
  Already applied in a prior commit: keys are `h-10`, grid is `gap-1`. No further changes needed.
- DONE: Fix 3 — Date headers daily total prominence
  Already applied in a prior commit: `text-sm font-semibold text-base-content` on the daily total span.
- DONE: Fix 4 — Submit success flash
  Already applied in a prior commit: `saved` boolean state, `setSaved(true)` + 1500ms timeout, button shows "✓ Saved" with `bg-success` when active.
- DONE: Fix 5 — Remove "Log Another" button
  Already applied in a prior commit: submit row is `grid-cols-1` with only the Save button.
- DONE: Fix 6 — Back button on settings sub-pages
  Users page already had back button; categories page back button committed as part of f6a8353.

### Summary

All six fixes are in place. Fixes 2–5 and the users page back button were already applied in prior session work. This stage added the portal-based bottom sheet fix for history (Fix 1) and committed the categories back button (Fix 6). Build passes cleanly (14/14 pages).
