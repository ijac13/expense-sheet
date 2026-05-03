---
id: "029"
title: Tab Navigation Shows Wrong Content
status: ideation
source: captain feedback
started:
completed:
verdict:
score: 0.9
worktree:
issue:
pr:
---

Switching tabs sometimes shows the previous tab's content instead of the new one. The bottom nav highlights the correct tab but the content area hasn't updated.

## Evidence

`feedback-screenshots/history-002.png` — History tab is selected (bottom nav shows History highlighted with the pill indicator) but the content area still shows the Home screen: category grid + numpad expense entry form.

## Steps to Reproduce

1. Open app on Home tab
2. Tap the History tab in the bottom nav
3. Tab indicator moves to History but content remains the Home expense entry screen

## Expected vs Actual

- **Expected:** Tapping History loads the expense history list
- **Actual:** Content area still shows Home (category selector + numpad), only the nav indicator updates

## Likely Cause

The tab/page component is not unmounting or re-rendering on route change. Possible causes:
- Shared state or cached render not cleared on tab switch
- Route change not triggering a content re-render (e.g., `key` prop not changing, or a navigation library not remounting the page)
- Prefetch or layout caching serving stale Home content

## Acceptance Criteria

- **AC-1** Tapping any tab always renders that tab's content immediately
- **AC-2** No flash of previous tab's content during transition
- **AC-3** Reproducible on both iOS Safari and Android Chrome
