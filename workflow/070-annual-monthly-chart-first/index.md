---
id: 070
title: Move monthly chart to the top of Report > Annual
status: spec
source: captain
started: 2026-09-24T07:53:13Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:070:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:070-ideation-1
              briefing:
                id: briefing:070:ideation:attempt-1:revision-1
                digest: sha256:b27ce0d7fe0de1017869d88162fa4ca4642accbd45ecabd79ca11cdd6b0ec19b
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:070:ideation:1
                briefing: briefing:070:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-24T07:52:55.148373Z"
                decision: approve
                reason: 'Captain approved: clear, small, single-page outcome. Placement decided: monthly trend chart goes directly under the year total (year picker -> total -> monthly trend -> rest in current order).'
              application:
                target-stage: spec
                state: consumed
---

The monthly chart is the most useful view in Report > Annual, so it should be the first block people see.

## User Stories

- As a user opening Report > Annual, I want the monthly chart first so that I see the year's spending trend before the details.

## Success

- The monthly chart is the first block in Report > Annual.
- Every other block keeps its current relative order.

### Out of Scope

- Changing the chart itself or other Report tabs.

## Plan

Captain decision at ideation (2026-09-24): the monthly trend chart goes directly under the year total. Approach: move the existing `{/* Monthly trend chart */}` JSX block (currently `app/app/reports/page.tsx` lines 829–849) up to sit right after the `{/* Summary header */}` block (ends line 765) inside the ANNUAL VIEW. Pure cut-and-paste of one block; no prop, style, data, or copy changes.

Annual view order, before and after:

| # | Before | After |
|---|--------|-------|
| 1 | Navigation (year picker) | Navigation (year picker) |
| 2 | Summary header (year total) | Summary header (year total) |
| 3 | Chart type toggle | **Monthly trend chart** |
| 4 | Chart (annual, donut/bar) | Chart type toggle |
| 5 | Category list | Chart (annual, donut/bar) |
| 6 | **Monthly trend chart** | Category list |
| 7 | By payer | By payer |
| 8 | AI Insights | AI Insights |

## Spec

### Goal

Show the year's month-by-month spending trend right under the year total in Report > Annual, so it is the first chart people see.

### User Stories

- As a user opening Report > Annual, I want the monthly trend right under the year total so that I see how spending moved across the year before the category details.
- As a user switching years with the year picker, I want the trend to stay in that same spot so that the page layout is predictable year to year.
- As a user of Report > Monthly, I want that tab to look exactly as it does today so that nothing I rely on moves.

### Edge Cases

- **Year with no expenses:** the trend chart still renders (12 zero bars) directly under a NT$0 total; the block order is the same as a year with data. (The Annual view has no empty-state branch today, unlike Monthly; this spec keeps that behaviour.)
- **Before the page finishes mounting:** the trend is gated by `mounted`, same as today. During that instant the total shows alone, then the trend appears in its new slot; no layout shift below other than what happens today.
- **Payer filter active:** the trend reflects the filtered data as today; only its position changes.
- **Donut/bar toggle:** the toggle keeps controlling only the category chart; it now sits below the trend, directly above the chart it controls.
- **Two people viewing at once / offline:** no data or write path is touched, so there is no new concurrency or offline behaviour.

### Out of Scope

- Any change to the monthly trend chart itself (size, colours, bars, labels, tooltip, data).
- Any change to the Monthly tab of Reports.
- Any change to other reports or pages (History, Subscriptions, Settings, drill-down).
- Changing the donut/bar toggle to also control the trend chart.
- Adding an empty state to the Annual view.

## Acceptance criteria

**AC-1 — In Report > Annual, the monthly trend chart renders directly under the year total and above the chart-type toggle.**
Verified by: offline — new test in `app/test/reports-cache.render.test.js` (or a sibling `reports-annual-order.render.test.js` added to the `npm test` list) that mounts the real Reports page, clicks the Annual toggle, and asserts the section labels render in the order `reports.annual_total` → `reports.monthly_trend` → `reports.by_category` → `reports.by_payer` → `reports.insights_title`, and that the `reports.monthly_trend` label precedes the `reports.donut` toggle button in document order. Falsified by: leaving the trend block after the Category list (today's code produces `annual_total, by_category, monthly_trend, …` — observed in the spike below), or placing it below the toggle.

**AC-2 — Every other Annual block keeps its current relative order (year picker, total, toggle, category chart, category list, by payer, AI insights).**
Verified by: offline — the same AC-1 test asserts the full label order, plus that the year-picker label precedes the total and the `reports.donut` toggle precedes the category list. Falsified by: any other block moving (e.g. By payer ending up above Category list).

**AC-3 — The Report > Monthly tab is unchanged.**
Verified by: offline — (a) a test asserting the Monthly view's section labels are exactly `reports.total_spending` → `reports.by_category` → `reports.by_payer` → `reports.comparison` → `reports.insights_title` (today's order, captured in the spike) with no `reports.monthly_trend`; and (b) `git diff main -- app/app/reports/page.tsx` shows no hunk touching lines inside the MONTHLY VIEW block (lines 546–731 on main). Falsified by: any edit inside the Monthly view block.

**AC-4 — The trend chart itself is unchanged (same height, colours, data, labels).**
Verified by: offline — the diff of `page.tsx` is a pure move: the removed lines and the added lines of the trend block are byte-identical apart from leading whitespace (`git diff main --color-moved=plain` marks the block as moved, with no other `+`/`-` lines besides blank-line adjustments). Falsified by: any edited attribute on the moved block.

**AC-5 — On live staging, Report > Annual shows the monthly trend chart directly under the year total.**
Verified by: interactive — verify agent opens Report > Annual on the staging deploy (Firebase project `expense-sheet-staging`), confirms the deployed chunk hash matches the build, and records (screenshot or observed DOM order) that the first block under the year total is "Monthly Trend", followed by the Donut/Bar toggle; captain confirms on their phone. Falsified by: staging still showing the Donut/Bar toggle or category chart directly under the total.

**AC-6 — On live staging, Report > Monthly looks the same as before the change.**
Verified by: interactive — verify agent and captain open Report > Monthly on staging and confirm the block order is summary → toggle → chart → category list → by payer → comparison → AI insights, with no monthly trend chart added. Falsified by: any block added, removed, or reordered in the Monthly tab.

## Risk evidence

Riskiest mechanism: whether the existing jsdom render harness (`app/test/helpers/dom.js`) actually renders the `mounted`-gated trend block after switching to Annual, so AC-1/AC-2 can be proven offline rather than only on staging.

Spike (2026-09-24, throwaway test, deleted): mounted the compiled Reports page, clicked `reports.annual`, and listed `.uppercase.tracking-wide` labels. Output on current `main`:
`["reports.annual_total","reports.by_category","reports.monthly_trend","reports.by_payer","reports.insights_title"]`.
Same spike on the default Monthly tab: `["reports.total_spending","reports.by_category","reports.by_payer","reports.comparison","reports.insights_title"]` (baseline for AC-3).
This shows the harness renders the trend block and captures today's order, so the AC-1 test fails on `main` and passes only after the move.

## Expected surface and tolerance

Estimate: `app/app/reports/page.tsx` ~21 lines moved (+22/−22, net 0) plus one new render test (~40–60 lines) in `app/test/`, and `app/package.json` test-list update if a new test file is added (+0/1 line). 2–3 files, tolerance ±30%.
Semantics this may change: none (layout only; no stored formats, API, auth, or scheduled behaviour).

## Test plan

- `cd app && npm test` — compiles the page and runs the new Annual-order test plus the existing suite (including `reports-cache.render.test.js`) to catch regressions. Cost: ~1 minute.
- `git diff main --color-moved=plain -- app/app/reports/page.tsx` for AC-3(b)/AC-4.
- Live staging drive at verify (AC-5, AC-6): small-change fast path applies; one staging observation of each tab is required.

### Feedback Cycles

## Stage Report: spec

- DONE: Write the spec with the monthly trend chart placed directly under the year total in the Annual view (year picker -> total -> monthly trend -> remaining blocks in current order), naming the exact file(s) and expected lines changed with tolerance
  `## Plan` before/after table + `## Expected surface`: move lines 829–849 of `app/app/reports/page.tsx` to after line 765; ~+22/−22 plus one render test, 2–3 files, ±30%.
- DONE: Every acceptance criterion is binary and labeled offline or interactive; include one interactive AC observed on the live staging Annual page, and one confirming the Monthly tab is unchanged
  AC-1–AC-4 offline (render test order + pure-move diff), AC-5 interactive staging Annual, AC-3 offline + AC-6 interactive staging Monthly unchanged.
- DONE: Explicit Out of Scope: no change to the chart itself, the Monthly tab, or other reports
  `### Out of Scope` under `## Spec` lists chart, Monthly tab, other reports/pages, toggle scope, Annual empty state.

### Summary

Spec moves one existing JSX block (Monthly trend chart) up to sit under the year total in the Annual view; nothing else changes. Spiked the riskiest mechanism: the jsdom render harness does render the `mounted`-gated trend after clicking Annual, and today's order (`annual_total, by_category, monthly_trend, …`) makes the new AC-1 test fail on main. Monthly-tab baseline order also captured for AC-3.
