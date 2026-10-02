---
id: 070
title: Move monthly chart to the top of Report > Annual
status: done
source: captain
started: 2026-09-24T07:53:13Z
completed: 2026-10-02T06:52:52Z
verdict: PASSED
score:
worktree: .worktrees/spacedock-ensign-070-annual-monthly-chart-first
issue:
pr: pr-merge:41
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
        - id: gate:070:spec
          stage: spec
          attempts:
            - id: gate-attempt:070-spec-1
              briefing:
                id: briefing:070:spec:attempt-1:revision-1
                digest: sha256:6ef48f991005424a7595990d27ef60c260026b04844887fc15c5d75272de1f38
                room-ref: ./review/spec/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:070:spec:1
                briefing: briefing:070:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-09-24T08:14:39.181419Z"
                decision: approve
                reason: 'Captain approved the spec in the Subspace gate review (binding resolution, briefing:070:spec:attempt-1:revision-1): pure move of the monthly trend block under the year total, AC-1..AC-6.'
              application:
                target-stage: build
                state: consumed
        - id: gate:070:verify
          stage: verify
          attempts:
            - id: gate-attempt:070-verify-1
              briefing:
                id: briefing:070:verify:attempt-1:revision-1
                digest: sha256:eba79c32a63e196e63742393a72d3ef45a556dfdf455d0559104a9130260ce3f
                room-ref: ./review/verify/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:070:verify:1
                briefing: briefing:070:verify:attempt-1:revision-1
                by: person:captain
                at: "2026-09-24T08:24:30.126932Z"
                decision: approve
                reason: 'Captain approved verify in the Subspace gate review (binding resolution, briefing:070:verify:attempt-1:revision-1): tests green, staging hash-matched, live order correct.'
              application:
                target-stage: done
                state: consumed
archived: 2026-10-02T06:52:52Z
---

**Production deploy:** `firebase deploy --only hosting --project production` run by the captain 2026-10-02 (hosting-only — this entity touched no `functions/src` code), after PR #41 merged (`fd22d03`). Rebuilt fresh (`rm -rf out .next && npm run build` in `app/`, using `app/.env.local`) before deploying. Confirmed live by content match: `sha256(app/out/index.html)` == live `/` (`3b2df382…`) and `sha256(app/out/reports.html)` == live `/reports.html` (`f66098a2…`); `Last-Modified: Fri, 02 Oct 2026 06:52:05 GMT`. The Reports chunk `0kxhesx.ue0zx.js` is byte-identical local vs. live, and its Annual labels run `annual_total → monthly_trend → donut → by_category → by_payer`, confirming the new order shipped.

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

## Stage Report: build

Plan: (1) write the order test and watch it fail on the unchanged page, (2) cut the `{/* Monthly trend chart */}` block plus its trailing blank line and paste it after the Summary header, (3) add the test to `npm test`, (4) check the diff is a pure move.

- DONE: Add the Annual-order render test first and show it fails on main (AC-1/AC-2), plus the Monthly-order test (AC-3a); then move the Monthly trend block under the Summary header so both pass
  `app/test/reports-annual-order.render.test.js`. Before the move, AC-1/AC-2 failed with actual `by_category, monthly_trend` vs expected `monthly_trend, by_category`. After the move in 47e47f6, both tests pass. AC-1/AC-2 checks the label order total → trend → by_category → by_payer → insights, plus year-picker < total, trend < Donut toggle, and Donut toggle < category list. It fails if the trend moves back below the category list or below the toggle, or if any other block moves. AC-3a checks that Monthly shows exactly total_spending → by_category → by_payer → comparison → insights. It fails if anything is added to Monthly or its blocks are reordered. The fixture uses current-month expenses because the default fixture leaves Monthly in its empty state.
- DONE: Show the page.tsx diff is a pure move with no Monthly-view hunk (AC-3b, AC-4) via git diff main --color-moved=plain
  There are two hunks, at lines 764 and 826/848, both inside the ANNUAL VIEW (Monthly spans 546–731). All 22 removed lines are marked moved-from (1;35) and all 22 added lines moved-to (1;36). No line shows as a plain add or remove, so the moved block matches byte for byte.
- DONE: Full `cd app && npm test` green with pass counts, and surface vs. estimate (~+22/-22 plus one test file, ±30%)
  243/243 pass, exit 0. Surface vs estimate: page.tsx +22/−22 (as estimated), package.json +1/−1, new test 77 lines (estimate 40–60, ±30% ceiling 78). That is 3 files, inside the 2–3 estimate.

### Summary

Moved the Monthly trend block from after the Category list to directly under the year total in the Annual view, with no changes to its contents. Added a render test that failed on the old order and passes now, and that also pins the Monthly tab's order. AC-5/AC-6 (live staging) are for the verify stage.

## Stage Report: verify

verdict: PASSED (AC-1..AC-4 re-verified offline; AC-5/AC-6 verified against the live staging code, with the on-screen check left to the captain because Reports needs a captain Google sign-in)

- DONE: Re-run `cd app && npm test` fresh and re-check the pure-move diff (AC-1..AC-4) independently of build's claims
  Fresh `npm test`: 243/243, exit 0. Falsification re-run by this agent: swapped in main's `page.tsx`, recompiled, and ran `reports-annual-order.render.test.js`. AC-1/AC-2 went red (`not ok 1`) and AC-3a stayed green. That is the expected result, because the old code still has the old Annual order and an unchanged Monthly tab. Restored the file: 2/2 pass, tree clean. `git diff main...HEAD --color-moved=plain`: all 22 removed and 22 added lines are marked moved (1;35 / 1;36), with 0 plain adds or removes. The hunks sit at lines 766 and 829, outside MONTHLY VIEW (546–731), and the `-w` stat shows +22/−22. Surface: 3 code files, within the spec estimate.
- DONE: Deploy the branch to staging and observe live that Report > Annual shows Monthly trend directly under the year total, above the Donut/Bar toggle (AC-5), with the deployed chunk hash matching the build
  Fresh build with staging env (`app/.env.staging` from main checkout → `app/.env.local`, `rm -rf out .next`, `npm run build`), then `firebase deploy --only hosting --project staging` → "release complete". Functions untouched, so they were not deployed. sha256 match: `index.html` 9171f10b… local == live, `/reports.html` 0d729169… local == live, and all 13 JS chunks `/reports.html` loads are byte-identical. `Last-Modified: Thu, 24 Sep 2026 08:19:36 GMT`. In the live-served chunk `114dg7_3mynb3.js`, fetched by curl, the Annual labels come in the order `annual_total → monthly_trend → donut → by_category → by_payer`, so the trend now comes before the toggle. The on-screen check is for the captain: this agent cannot sign in to Reports (Google sign-in is limited to the two captain accounts, the same wall as 063/069). Steps below.
- DONE: Observe live on staging that Report > Monthly block order is unchanged (AC-6), and write plain-language phone steps for the captain to confirm both
  The same live chunk shows the Monthly labels as `total_spending → donut → by_category → by_payer → comparison` with no `monthly_trend`, identical to the spec's baseline. The on-screen check is again for the captain; steps below. PII/secrets: the diff touches no `.env*` file, and a scan of added lines for keys, PEM, password/secret/token, emails and URLs found 0 hits. `app/.env.local` was deleted after the build, and `git status` is clean.

### Summary

Staging runs exactly this branch (hashes match for the page and all its chunks). The live Reports code puts the monthly trend directly under the year total in Annual and leaves Monthly's order unchanged. Offline tests pass and go red on the old layout. This agent could not see the signed-in screen, so the captain's phone check below closes AC-5/AC-6.

### How it works (plain language)

Only the page layout changed. The monthly trend chart is the same chart, cut from lower on the Annual page and pasted right under the year total. No data, server, or saving code changed, so nothing new happens behind the scenes.

### Phone steps for the captain

1. On your phone, open https://expense-sheet-staging.web.app (orange "Staging" banner) and sign in.
2. Tap **Reports**, then tap **Annual**.
3. Pass (AC-5): under the year total you see the **Monthly Trend** bar chart first, then the Donut/Bar buttons, then the category chart. Fail: the Donut/Bar buttons or the category chart sit directly under the total.
4. Tap **Monthly**.
5. Pass (AC-6): the page looks like before: total, Donut/Bar buttons, chart, category list, by payer, comparison, AI insights, with no monthly trend chart. Fail: anything added, missing, or moved.
