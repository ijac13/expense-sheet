---
id: "026"
title: UI Polish — Translation Gaps & Insights Error
status: done
source: captain feedback
started: 2026-04-27
completed: 2026-04-29
verdict: PASSED
score: 0.9
worktree:
issue:
pr:
---

Several UI issues found during real-device testing on staging. Screenshots in `feedback-screenshots/not-translate-001~005` and `insight-002`.

## Issues Found

### Translation gaps (not-translate-001 ~ 005)

The app is bilingual (EN / 繁中). When set to Chinese, some screens still render English text:

1. **Filter sheet** (not-translate-001) — date preset buttons (All time / This month…), category names, section labels, Reset/Apply buttons all showed in English. Root cause: code changes were committed but not yet deployed when screenshots were taken.

2. **Reports page** (not-translate-002, 005) — "Reports" title, Monthly/Annual tabs, All Users, Total Spending, By Category/Payer, Comparison, AI Insights card — all English. Same deployment gap, plus "Total" in the donut chart SVG was hardcoded.

3. **Home category picker** (not-translate-003) — category grid showed `name_en` for all items. Root cause: `CategoryPicker` component had `name_zh` as optional but always rendered `name_en`. Also the selected-category header in the home screen used `name_en`.

4. **Subscriptions page** (not-translate-004) — Active/Cancelled labels, Monthly/Annual, Due date prefix, Paid by, Edit/Cancel buttons, modal titles — all English. Deployment gap.

### AI Insights error (insight-002)

Tapping "Generate Insights" showed "Something went wrong. Try again?" with no detail. Causes:
- Old code was deployed (error detail surfacing was added but not yet deployed)
- Potential runtime error in the function (ANTHROPIC_API_KEY not accessible, or function cold-start timeout)

## What Was Fixed

All issues above were resolved across two commits (2026-04-26 → 2026-04-27):

- `CategoryPicker` now uses `name_zh` when language is `zh`
- Home header category name is locale-aware
- Donut chart "Total" label uses `t("reports.total")`
- All filter sheet, reports, subscriptions strings use `t()` calls
- `InsightsCard` surfaces actual error message (server detail, HTTP status, network error) in a monospace block
- Firebase Function + Hosting deployed on 2026-04-27

## Verification Needed

- [ ] Test on device with language set to 繁中: filter sheet, home picker, reports, subscriptions all show Chinese
- [ ] Tap "Generate Insights" — either shows insights or shows a specific error (not generic "Something went wrong")
- [ ] Confirm new expenses written to Sheets show display names (ijac / wei) in paid_by column
- [ ] Edit and delete an expense from History detail sheet
