---
id: 079
title: Reports > Annual chart ignores "include business cost" toggle
status: verify
source: captain (bug report, 2026-11-02)
started: 2026-11-02T02:57:48Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-079-annual-business-toggle
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:079:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:079-ideation-1
              briefing:
                id: briefing:079:ideation:attempt-1:revision-1
                digest: sha256:0f7062f2392e2fe92a03334ccfb2f5f2760dea9a46f9bcb0b8d03521c7c50572
                room-ref: '@review/ideation/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:079:ideation:1
                briefing: briefing:079:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-11-02T02:57:34.381054Z"
                decision: approve
                reason: 'Captain approved in Subspace review: bug is concrete and scoped; proceed to spec.'
              application:
                target-stage: spec
                state: consumed
        - id: gate:079:spec
          stage: spec
          attempts:
            - id: gate-attempt:079-spec-1
              briefing:
                id: briefing:079:spec:attempt-1:revision-1
                digest: sha256:6867ce36c5ad6b683b5844a627053f1c501f912d060b7ee72acf4be9b8e3704b
                room-ref: '@review/spec/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:079:spec:1
                briefing: briefing:079:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-11-02T03:30:47.408158Z"
                decision: approve
                reason: Captain approved spec in Subspace review with no annotations; By payer stays out of scope.
              application:
                target-stage: build
                state: consumed
---

In Reports > Annual, the monthly chart responds to "Live only" but stays unchanged when the captain switches to "Include business cost", so the chart misreports monthly totals that should include business costs.

Evidence: `feedback-screenshots/annual_liveonly.png` and `feedback-screenshots/annual_includebusiness.png` (captain's screenshots — same chart in both modes).

## User Stories

- As the captain, I want the Annual monthly chart to show live + business amounts when I pick "Include business cost", so that I see my real total spend per month.
- As the captain, I want switching back to "Live only" to show live-only amounts, so that the toggle reliably changes what I see.

## Success

- Toggling between "Live only" and "Include business cost" changes the Annual monthly chart's per-month amounts to match the selected mode.
- Other figures on the Annual view that follow the toggle stay consistent with the chart.

### Out of Scope

- Redesigning the Annual report or the toggle itself.

## Plan

Spec written below (`## Spec`). Root cause: the chart's monthly numbers are built as Life-only and carry no business amount, and the chart is never told which toggle is chosen.

## Spec

### Question for the captain

- The "By payer" card on Annual also stays Life only when you pick "Include business costs" (it was built that way on purpose, and a test pins it). This spec leaves it as is and fixes only the chart. Say so if you want By payer to follow the toggle too, and it becomes its own small task.

### Goal

Make the Annual "Monthly trend" chart show Life-only amounts under "Life only" and Life + Rent + Uber amounts under "Include business costs", matching the headline total above it.

### Root cause (plain language)

Think of the Annual page as a kitchen that prepares a few dishes before you look at them. For the headline total, it prepares two separate portions (Life, and the business costs), and the toggle simply decides whether to add the business portion onto the plate. For the chart, it prepares only the Life portion per month and throws the business part away. When you flip the toggle, there is nothing for the chart to add, and the chart is not even told the toggle moved. So it shows the same Life-only bars either way.

Your screenshots match this exactly: the headline jumps from NT$2,640,449 (Life only) to NT$3,398,001 (Include business costs), while October 2026 in the chart reads NT$206,081 in both.

Evidence in the code:

- `app/app/lib/reportService.ts:295-307` builds each month's bar with `monthTotal`, which wraps the month's expenses in `lifeOnly(...)` (business costs removed). Both `total` and `prev_total` (last year's bar) are Life only, and no business figure per month is kept.
- `app/app/lib/reportTypes.ts:42-47` (`MonthlyTrend`) has only `total` and `prev_total`, so the data has no room for a business amount.
- `app/app/reports/page.tsx:1098` renders `<TrendCard data={annual.monthly_trend} year={annualYear} />`, with no `includeBusiness` passed in. Compare `page.tsx:857`, where the headline uses `shownTotal(annual.total, annual.groups, includeBusiness)`, which does add business costs.

Reproduced against the real code path (scratch test `/private/tmp/claude-501/-Users-ijac-Claude-ijac-expense-sheet/11a82245-6a19-4ee0-a57b-293da39c46f0/scratchpad/repro-079.test.js`, run with `node --test` from `app/` after `npm run test:compile`): one January with NT$300 Eating Out and NT$30,000 Rent paid. The real Reports page, Annual tab, enlarged chart, January bar picked, reads `Jan · 2026 NT$300` under "Life only" and still `Jan · 2026 NT$300` after "Include business costs" is pressed (`aria-pressed=true`). It should read NT$30,300.

### Chosen approach

Keep the business amount per month next to the Life amount, and let the page add it when the toggle says so, the same way the headline already works.

- Data (`reportService.ts`, `reportTypes.ts`): each month in `monthly_trend` gains `business` and `prev_business` (that month's Rent + Uber costs, this year and last year), using the same payer filter as `total`. `total` and `prev_total` stay Life only, so nothing else that reads them changes.
- Page (`page.tsx`): `TrendCard` receives `includeBusiness`; when it is on, each bar shows `total + business` and `prev_total + prev_business`. The enlarged chart and its tap readout use the same adjusted numbers.

Alternative considered and dropped: refetching or recomputing the summary when the toggle moves. Slower, and it would split the "which amount to show" rule across two places instead of reusing the headline's pattern.

### User Stories

- As the captain, I want the Annual monthly chart to show Life + business amounts when I pick "Include business costs", so that I see my real total spend per month.
- As the captain, I want switching back to "Life only" to show Life-only amounts, so that the toggle reliably changes what I see.
- As the captain, I want last year's bars to follow the toggle too, so that the year-over-year comparison compares like with like.

### Edge Cases

- A month with only business costs (e.g. a water-heater month of Rent only): bar is 0 under "Life only" and the business amount under "Include business costs".
- Filtering by one person (payer dropdown): business amounts per month count only that person's expenses, same as the Life amounts.
- Last year's bars: follow the toggle as well (Life only vs Life + business). They keep showing last year's full months, as today.
- Enlarged (full-screen) chart: opened after a toggle change, its bars and tap readout show the selected mode.
- A year with no business costs at all: both modes show identical bars.
- Empty year: all bars 0 in both modes.

### Out of Scope

- Redesigning the Annual report, the chart, or the toggle.
- The "By payer" card (see question above).
- The Monthly tab (it has no trend chart) and AI Insights.
- Splitting bars into stacked Life/business colours or showing a breakdown in the tooltip.

## Acceptance criteria

**AC-1 — Under "Include business costs", each month's bar for the viewed year equals that month's Life + Rent + Uber costs.**
Verified by: offline — new page-level test in `app/test/income-earnings.render.test.js` (fixture dated in the current year, since the page opens on today's year: Life + Rent + Uber in one month, Rent only in another, amounts as in the file's existing `EXPENSES`): mounts the real Reports page, Annual tab, presses "Include business costs", opens the enlarged chart, picks the month, and asserts the readout shows the Life + business amount (e.g. Oct NT$67,600 = 32,750 + 32,450 + 2,400; Aug NT$38,900). Falsified by: leaving `TrendCard` without `includeBusiness` (readout stays NT$32,750 / NT$0), which is today's behaviour.

**AC-2 — Under "Life only", each month's bar equals that month's Life costs only (unchanged from today).**
Verified by: offline — same test, before pressing the toggle and again after switching back to "Life only": readout shows the Life amount (Oct NT$32,750, Aug NT$0); existing assertions in `reports-annual-compare.render.test.js` (`monthly_trend[...]` totals) and `income-earnings.render.test.js` ("the annual trend and total are Life only too") still pass. Falsified by: making `total` include business costs.

**AC-3 — Last year's bars follow the toggle the same way.**
Verified by: offline — data-level test on `getAnnualSummary`: `monthly_trend[i].prev_business` equals last year's Rent + Uber for that month, and the page test's readout for last year shows `prev_total + prev_business` under "Include business costs" and `prev_total` under "Life only". Falsified by: adding `business` but not `prev_business`.

**AC-4 — The chart agrees with the headline: the 12 bars of the viewed year sum to the headline total in both modes.**
Verified by: offline — data-level test: `sum(total) == annual.total` and `sum(total + business) == annual.total + groups.rent.total + groups.uber.total`. Falsified by: business per month computed differently from the Rent/Uber groups (e.g. ignoring a business-tagged fuel row).

**AC-5 — Payer filter applies to business amounts per month.**
Verified by: offline — data-level test calling `getAnnualSummary(year, "<one user>")` with business rows paid by two people: `business` counts only the filtered person's rows. Falsified by: computing `business` before `filterByPayer`.

**AC-6 — On staging with real data, flipping the toggle visibly changes the chart.**
Verified by: interactive — on the staging Reports > Annual page, the captain (or verify agent's live drive) taps October under each mode: "Include business costs" shows a larger amount than "Life only" for any month with Rent/Uber costs, and the 2026 bars' amounts under "Include business costs" add up to the headline. Falsified by: the screenshots' behaviour (same NT$206,081 in both modes).

## Risk evidence

Riskiest mechanism: whether a page-level jsdom test can read the chart's numbers at all (Recharts draws nothing in jsdom without a fixed size). Exercised in the scratch repro above: the enlarged chart has a fixed size, its bars render, clicking a bar fills `data-testid="trend-picked"` with the month's amounts, and toggling `scope-toggle` buttons works. The bug reproduces there (NT$300 in both modes), so the same harness proves the fix. No new automation harness is needed; the existing `test/helpers/dom.js` covers it.

## Expected surface and tolerance

Estimate: +60 net LOC across 4 files, tolerance ±40%.

- `app/app/lib/reportTypes.ts` (~+2): `business`, `prev_business` on `MonthlyTrend`.
- `app/app/lib/reportService.ts` (~+8, around lines 295-307): per-month business sum alongside the Life sum.
- `app/app/reports/page.tsx` (~+8, around lines 438-520 and 1098): pass `includeBusiness` to `TrendCard`, map shown amounts before handing data to the charts.
- `app/test/income-earnings.render.test.js` (~+40): AC-1 to AC-5 tests.

Semantics this may change: none stored. `MonthlyTrend` gains two fields; the summary is computed on the device each load, so there is no saved old-shape data to migrate.

## Test plan

- `cd app && npm test` (compile + full suite); new tests cover AC-1 to AC-5. Cost: a few minutes.
- Live staging drive for AC-6 at verify, against real data, per the workflow's Live Evidence Requirement.

### Feedback Cycles

## Stage Report: spec

- DONE: Root cause identified with file:line evidence for why the Annual monthly chart ignores "Include business cost" (reproduced against the code path, not guessed)
  `reportService.ts:295-307` builds trend bars Life-only with no business figure; `page.tsx:1098` passes no `includeBusiness` to `TrendCard`. Scratch page-level test reads `Jan · 2026 NT$300` in both modes with NT$30,000 Rent present.
- DONE: Spec + top-level ## Acceptance criteria with binary ACs, each split offline vs interactive, covering both toggle states and consistency with other Annual figures
  AC-1..AC-5 offline (both modes, last-year bars, sum-equals-headline, payer filter); AC-6 interactive staging drive.
- DONE: Chosen approach with expected files/lines and tolerance, plus proposed proof per AC
  Add `business`/`prev_business` per month, page adds them under the toggle; +60 LOC across 4 files ±40%; each AC names its test and falsifier.

### Summary

The chart's monthly data is computed Life-only and the chart never receives the toggle, so it cannot change; the screenshots (headline 2.64M vs 3.40M, Oct bar NT$206,081 in both) match. Reproduced on the real Reports page in jsdom via the enlarged chart's tap readout, which also proves the test harness for the fix. One open question for the captain: whether "By payer" (also Life-only by design) should follow the toggle; spec keeps it out of scope.

## Stage Report: build

Plan: keep Life and business apart per month in `getAnnualSummary`, add `business`/`prev_business` to `MonthlyTrend`, and have `TrendCard` map the shown amounts once under `includeBusiness`, then hand them to both charts. Commit `0f4fb05`.

- DONE: Implementation on the build branch: monthly_trend carries business/prev_business per month and TrendCard (inline + enlarged chart + tap readout) shows total+business when "Include business costs" is on
  `reportService.ts` `monthSplit` (payer-filtered, business = all minus Life); `page.tsx` `TrendCard` gets `includeBusiness` and passes the adjusted data to the inline and enlarged charts.
- DONE: AC-1 to AC-5 each checked off with evidence from new tests in `cd app && npm test`, full suite green, no regression to existing Life-only assertions
  `npm test`: 294/294 pass; `tsc --noEmit -p .` clean. Falsifiers were run as throwaway edits to the compiled output, then rebuilt:
  - AC-1/AC-2 (page test "enlarged chart's bars follow the … toggle"): Oct reads NT$32,750 then NT$67,600, Aug NT$0 then NT$38,900, and back to the same Life readouts after "Life only". Fails if TrendCard gets `includeBusiness: false`.
  - AC-2 regression: "the annual trend and total are Life only too" and `reports-annual-compare` `monthly_trend` asserts pass unchanged. Fail if `total` includes business.
  - AC-3 (data test + page test): `prev_business` Oct 28,000 / Aug 0; the readout shows last year at 29,200 with business. Fails if the page drops `prev_business`.
  - AC-4 (data test "…bars add up to the headline"): sum(total) = `a.total`; sum(total+business) = `total + rent + uber`. Fails if business ignores the Uber-tagged fuel row.
  - AC-5 (data test "…only the chosen payer's rows"): Oct business is 34,850 for user1 and 5,000 for user2. Fails if business is computed before `filterByPayer`.
- DONE: Diff size within the spec's +60 LOC ±40% tolerance across the 4 named files, or the deviation explained
  Same 4 files, +118/−16 (net +102, about 170% of the estimate; the ceiling is +84). Production code is +15 net, under the estimate. The overage is the test file (+87 against about +40): a separate payer-filter test, a last-year fixture, and a readout loop that taps every drawn bar.

### Summary

The chart now follows the toggle for this year's and last year's bars, and agrees with the headline in both modes. Unplanned addition, needed for AC-1 and already broken in production: Recharts 3.8 skips zero-height bars and passes `onClick` an index that counts only the drawn bars. So tapping a bar after a NT$0 month opened the wrong month in the readout (the Aug bar read as Jan). `TrendBars` now uses `originalDataIndex` (3 lines in `page.tsx`); without it the page test fails. Local setup note: the worktree's `app/node_modules` is a symlink to the main checkout's, which is untracked and not committed.

## Verify: how it works, and how to try it

### What you'll see (frontend)

- The Annual "Monthly trend" chart now moves with the toggle. Under "Life only" each bar is that month's Life spending. Under "Include business costs" each bar adds that month's Rent + Uber costs on top.
- Last year's (grey) bars follow the toggle too, so this year and last year are compared the same way.
- The 12 bars of the year add up to the big headline number in both modes.
- Extra fix: tapping a bar now always opens the month you tapped. Before, if an earlier month was NT$0 (no bar drawn), the chart counted only the drawn bars, so a tap could open the wrong month (for example tapping August showed January).

### How it works behind the scenes (backend)

- Nothing on the server changed. The app already downloads all your expenses and adds them up on your phone.
- Before: when adding up each month for the chart, it set the business costs aside and threw them away. So the chart had nothing to add back when you flipped the toggle, and the chart wasn't told about the toggle either.
- Now: for each month it keeps two piles, Life and business, the same way the headline already does. The toggle decides whether the business pile is added onto each bar.

### Try it on staging

Staging is a practice copy of the app with its own data. Your real data is untouched.

1. Open https://expense-sheet-staging.web.app in Chrome and sign in.
2. Tap Reports, then Annual. It opens on 2026.
3. With "Life only" selected, tap the enlarge button on the Monthly trend chart, then tap the October bar. Expected: `Oct · 2025 NT$174,779.8 · 2026 NT$1,243`.
4. Close it, tap "Include business costs", enlarge again, tap October. Expected: `Oct · 2025 NT$233,091.8 · 2026 NT$49,658`.
5. Check the headline under "Include business costs": NT$476,089 (under "Life only": NT$4,674). The 2026 bars add up to these.
6. Tap "Life only" again: October goes back to NT$1,243.

These expected numbers were read from the staging spreadsheet on 2026-11-02. If anyone adds or edits staging expenses before you test, they shift. (2026 on staging is mostly test entries plus NT$47,000/month of Rent; 2025 is real history. The `.8` in 2025 October comes from a staging row with a decimal amount, unrelated to this change.)

## Stage Report: verify

- DONE: Build branch deployed to staging (hosting) and confirmed live by content match, with the staging URL for the captain
  Built `356f8bc` with `.env.staging` loaded only in the shell (manifest "Expense Tracker (Staging)", no production project id in the bundle), `firebase deploy --only hosting --project staging`, then `git checkout app/public/manifest.json`. sha256 of `out/index.html` = curl of `/` = `b70a15a9…52a62f1`; `reports.html` = `79283ba4…91fc4` both sides; the 3 chunks containing `prev_business` (string absent on `main`) are byte-identical served vs local (`0387i0yy6abu2.js` also carries `originalDataIndex`). URL: https://expense-sheet-staging.web.app
- DONE: Verification report mapping AC-1..AC-6 to pass/fail with concrete evidence, including the AC-6 live staging drive (toggle changes the Annual chart; 2026 bars sum to the headline under "Include business costs")
  `cd app && npm test`: 294/294 pass. Falsifiers re-run independently, then reverted (tree clean):
  - AC-1 PASS: page test reads Oct NT$67,600 under "Include business costs". Forcing `includeBusiness={false}` at `page.tsx` TrendCard fails it (actual `2026 NT$32,750`).
  - AC-2 PASS: same test reads Life-only Oct NT$32,750 / Aug NT$0 before and after toggling back; existing Life-only asserts unchanged.
  - AC-3 PASS: `prev_business` Oct 28,000 data test; readout shows 2025 NT$29,200 with business.
  - AC-4 PASS: data test sums. Setting `business: 0` in `monthSplit` fails 3 tests (data, payer, page).
  - AC-5 PASS: payer test, Oct business 34,850 (user1) vs 5,000 (user2).
  - AC-6 PARTIAL, awaiting the captain's drive: live staging data (1,506 expenses, read-only Sheets read with the staging service account) fed through this branch's compiled code and the real Reports page: Oct 2026 Life only NT$1,243, Include business NT$49,658 (`aria-pressed=true`), back to NT$1,243; 2026 bars sum to the headline in both modes (NT$4,674 / NT$476,089). Unauthenticated `GET /api/expenses` on staging returns 401. A signed-in browser drive was not possible here (sign-in needs the captain's Google account; minting a session for it was ruled out in 061, and headless browsers crash in this sandbox per 048), so the on-screen check is steps 1-6 above.
- DONE: Plain-language explanation of the frontend behavior and backend flow, including the extra originalDataIndex tap-readout fix
  Section "Verify: how it works, and how to try it" above.
- DONE: Mandatory PII / secrets check
  Diff touches 4 app files + this entity; no `.env` committed (`.env.staging` copied into the worktree is gitignored, `git status` clean), no keys, emails, phone numbers or URLs in the diff; fixtures use `user1`/`user2`/`wei`.

### Summary

Recommend PASSED for AC-1..AC-5 with independent falsifiers; AC-6 has live-data evidence through the deployed code path and the real page, and needs the captain's signed-in tap on staging to close. Staging is serving exactly this build (hash match). Production was not touched.
