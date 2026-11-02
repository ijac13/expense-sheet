---
id: 080
title: Reports > Annual category drilldown shows monthly totals, trend chart, then expenses
status: verify
source: captain (request, 2026-11-02)
started: 2026-11-02T03:53:32Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-080-annual-category-by-month
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:080:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:080-ideation-1
              briefing:
                id: briefing:080:ideation:attempt-1:revision-1
                digest: sha256:bf5fc23e14fa53b796b03a5a5893c01b9f7a86df6efdb383f984993f607f9ef8
                room-ref: '@review/ideation/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:080:ideation:1
                briefing: briefing:080:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-11-02T03:53:32.251045Z"
                decision: approve
                reason: Captain approved in Subspace review with no annotations; proceed to spec.
              application:
                target-stage: spec
                state: consumed
        - id: gate:080:spec
          stage: spec
          attempts:
            - id: gate-attempt:080-spec-1
              briefing:
                id: briefing:080:spec:attempt-1:revision-1
                digest: sha256:7747636e1028c8505381ed848603ddcef653e144a0097beef43b7fddda03c89e
                room-ref: '@review/spec/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:080:spec:1
                briefing: briefing:080:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-11-02T04:05:56.081211Z"
                decision: approve
                reason: Captain approved spec in Subspace review with no annotations; keep last year's bars (recommended default). Build waits for 079 to merge.
              application:
                target-stage: build
                state: consumed
---

In Reports > Annual, clicking a category lists every single expense from the year (e.g. five Daily Necessity items in October, five more in September), which makes it hard to see how spending in that category changes month to month.

## User Stories

- As the captain, I want clicking a category on Annual to show one total per month (October, September, August, ...) for that category, so that I can compare how it changes over the year.
- As the captain, I want a monthly trend chart for just that category, so that I can see the change at a glance.
- As the captain, I want to click a month (e.g. October) inside that category to see its individual expenses (e.g. the five Daily Necessity items), so that I can still check the details when I need them.

## Success

- Clicking a category on Annual shows one row per month with that category's monthly total, instead of the flat list of every expense.
- The category view includes a chart of that category's monthly totals across the year.
- Clicking a month row shows that month's individual expenses for the category.

### Out of Scope

- Changing the Monthly tab's category drilldown.
- Changing which expenses belong to a category.

## Spec

### Question for the captain

- **Should the category chart also show last year's bars?** The main Annual chart shows each month twice: last year (grey) next to this year. My recommendation: keep the same look, so October's Daily Necessity bar sits next to last October's. The other choice is this year's bars only, which is simpler but loses the "is it more than last year?" view. If you agree, leave this as is; otherwise write "this year only" here.

### Goal

Tapping a category on Reports > Annual opens a "month by month" view of that category: its total for each month, a chart of those totals, and a tap on a month shows that month's individual expenses.

### What the captain sees

1. Reports > Annual > tap **Daily Necessity** (under Living costs).
2. A new screen opens. At the top: the category name, the year, the year total (the same number as the row tapped) and how many expenses that is.
3. Below it, the **monthly trend chart** for Daily Necessity only, in the same style as the main Annual chart (same colours, same enlarge button, same tap-a-bar readout).
4. Below the chart, **one row per month, newest first**: October NT$1,000 · 4 expenses, September NT$400 · 2 expenses, August ... down to January.
5. Tap **October**: the list of October's Daily Necessity expenses opens (the same list screen used today, now showing one month). Tapping an expense still opens the edit sheet.
6. **Back** from October returns to the month list. **Back** again returns to Annual.

### The Life only / Include business costs rule

The category screen counts exactly the expenses behind the row that was tapped: same category, same group (Fixed, Living costs, Rent or Uber), same payer filter. So the toggle needs no separate handling here:

- A Living costs or Fixed row never contains Rent or Uber costs, so its month totals are the same with the toggle on or off.
- A Rent or Uber row only appears when "Include business costs" is on, and its month totals contain only that category's business costs.
- Last year's bars follow the same rule for last year.

This also means the 12 month totals always add up to the row amount on Annual. Big extras (#大筆) stay in the Big extras group, as today.

### User Stories

- As the captain, I want tapping a category on Annual to show one total per month (October, September, August, ...), so that I can compare how it changes over the year.
- As the captain, I want a monthly trend chart for just that category, so that I can see the change at a glance.
- As the captain, I want to tap a month (e.g. October) to see that month's expenses for the category, so that I can still check the details.
- As the captain, I want Back to take me one step back (month → month list → Annual), so that I can check several months in a row.

### Edge Cases

- **Current year:** months after this month are not listed (the chart still shows all 12 months, empty bars, as the main chart does). A past year lists all 12 months.
- **A month with no spending** in the category: shows NT$0 and cannot be tapped.
- **An expense dated in a later month** (e.g. entered ahead of time): that month is listed too, so the months always add up to the row.
- **Payer filter** (e.g. only ijac): the category screen and the month lists count only that payer, as the row on Annual did.
- **Editing or deleting an expense** inside a month: the month's list refreshes at once; going Back shows the updated month total and chart; Annual is refreshed as well (it already refreshes after an edit). An edit that moves an expense to another month or category shows up in the right place.
- **Deleting the last expense of a month:** the month list shows "No data for this period"; Back shows that month as NT$0.
- **Loading fails (offline):** the same "couldn't load" message with a Retry button the expense list has today.
- **Comparing to last year** on Annual shows categories spent only last year as NT$0 rows; these stay not tappable, as today.

### Out of Scope

- The Monthly tab's category drilldown (stays a flat list of the month's expenses).
- The Earnings page's drilldowns (they share the expense list screen and stay unchanged).
- Big extras rows (they are single expenses, not categories).
- Changing which expenses belong to a category.
- Tapping a bar in the category chart to open that month (the month rows do that).

## Acceptance criteria

Fixture used by the offline tests (current year, unless stated): Daily Necessity under Living costs with four October expenses (100, 200, 300, 400), one October #大筆 (9,000), one October Rent-tagged (5,000), two September (150, 250), one August paid by wei (700); last year one October (600). The spike below ran on exactly this fixture.

**AC-1 — Tapping a Living costs category row on Annual opens a month list, not a flat expense list: one row per month, newest first, from the current month down to January, each with the month's total and expense count.**
Verified by: offline — new render test mounts Reports > Annual, taps the Daily Necessity Living row, with today pinned to 2 November, asserts the month rows read Nov NT$0, Oct NT$1,000 · 4, Sep NT$400 · 2, Aug NT$700 · 1, Jul ... Jan NT$0 in that order, and that no expense notes (e.g. an October item) are on screen. Falsified by: leaving the annual branch rendering `DrillDown` with `month={null}` (shows every expense of the year).

**AC-2 — The month totals add up to the row tapped, and the #大筆 and Rent-tagged October items are not in them.**
Verified by: offline — same test sums the month rows and asserts it equals the row's NT$2,100 (not NT$16,100, the category's raw year total). Falsified by: computing months from the category's expenses without the group filter.

**AC-3 — The category screen's chart shows that category only, this year and last year.**
Verified by: offline — same test enlarges the category chart, taps each drawn bar, asserts Oct reads "Oct · {last year} NT$600 · {this year} NT$1,000" and Aug reads "Aug · {last year} NT$0 · {this year} NT$700". Falsified by: passing Annual's `monthly_trend` (whole-year totals) to the chart.

**AC-4 — Tapping a month opens that month's expenses for the category and group; Back goes month → month list → Annual.**
Verified by: offline — tap October: exactly 4 expense rows, header total NT$1,000; Back shows the month list; Back again shows the Annual page (cost-groups block present). Falsified by: opening the month without the group (shows 6 rows, NT$15,000), or Back from October returning straight to Annual.

**AC-5 — The toggle rule: the Living row's month totals are the same with "Include business costs" on or off; with it on, the Rent group's Daily Necessity row opens a month list with only the Rent-tagged NT$5,000 in October.**
Verified by: offline — same test file, toggling the scope before tapping each row. Falsified by: adding business costs into a Life category's months, or dropping the group when opened from a Rent row.

**AC-6 — The payer filter applies: with only ijac selected, August (wei's NT$700) shows NT$0 and cannot be tapped.**
Verified by: offline — test sets the payer filter, opens the category, asserts Aug NT$0 and the row button is disabled. Falsified by: fetching the category's months with payer "all".

**AC-7 — A past year lists all 12 months; months with NT$0 cannot be tapped.**
Verified by: offline — test steps Annual to last year, opens Daily Necessity, asserts 12 rows Dec→Jan with only October (NT$600) tappable. Falsified by: cutting the list at today's month for every year.

**AC-8 — Unchanged elsewhere: the Monthly tab's category tap and the Earnings page drilldowns still open the flat expense list.**
Verified by: offline — the existing tests in `reports-monthly-compare.render.test.js` and `income-earnings.render.test.js` pass with no edits; the existing Annual AC-6 test in `reports-annual-groups.render.test.js` is updated only to tap the month first. Falsified by: changing `DrillDown` itself for month = null.

**AC-9 — Editing an expense inside a month updates the month list and chart after Back.**
Verified by: interactive — on staging, Annual > Daily Necessity > October > change one expense's amount by NT$100 > Back: October's row and bar both show NT$100 more. Falsified by: the category screen not refetching after a write.

**AC-10 — The captain can do their own check on staging: Annual > Daily Necessity shows month totals and the category chart; tapping October shows its expenses.**
Verified by: interactive — captain on a phone on staging.

## Risk evidence

Riskiest mechanism: building the per-month totals from the existing per-category fetch with the row's group, so they match the row on Annual, and reusing 079's TrendCard (with its tap readout) for a category-only series. Exercised in a throwaway worktree of the `079-annual-business-toggle` branch (spike test, not committed), on the fixture above:

- `getExpensesByCategory(year, null, "cat_002", "all", "living")` bucketed by month gave `{10: 1000, 09: 400, 08: 700}`; their sum equalled the Living row read off the mounted Annual page (NT$2,100), with the #大筆 and Rent-tagged items excluded. Fetching October alone with the same group returned 4 rows totalling 1,000. Last year's fetch totalled 600. With payer `user1` only months 10 and 09 remained.
- 079's `TrendCard`, temporarily exported and mounted with category-only data (`business: 0`, `includeBusiness: false`), drew bars and its enlarged readout gave `Oct · 2025 NT$600 · 2026 NT$1,000` and `Aug · 2025 NT$0 · 2026 NT$700`, so its zero-height-bar fix (079) holds for a sparse category series too.
- Not exercised: Next.js refuses extra named exports from a `page.tsx` at build, so TrendCard cannot just be exported from page.tsx as the spike did. The plan moves it to its own file instead, which sidesteps this.

## Expected surface and tolerance

Approach: a new screen component for the annual category view; the existing expense-list screen (`DrillDown.tsx`) is reused unchanged for one month.

- `app/app/reports/TrendChart.tsx` (new): TrendLegend, TrendBars, useLandscapeSize, TrendFullscreen, TrendCard moved out of `page.tsx` (079's version) so both screens can use them. ~+130, page.tsx ~-125.
- `app/app/reports/CategoryYear.tsx` (new): header, TrendCard, month rows, opens `DrillDown` with `month` set, Back handling, refetch after writes, loading/error states. ~+140.
- `app/app/lib/reportService.ts`: `getCategoryMonths(year, categoryId, payer, group, today)` returning 12 months of `{ total, prev_total, count }` built with the same filters as `getExpensesByCategory`. ~+35.
- `app/app/lib/reportTypes.ts`: `CategoryMonth` type (MonthlyTrend plus `count`). ~+5.
- `app/app/reports/page.tsx`: the drill-down branch renders `CategoryYear` when on Annual, `DrillDown` as today when on Monthly. ~+15.
- `app/public/locales/{en,zh}/common.json`: a "by month" label and "N expenses" wording if not covered by existing keys. ~+4.
- Tests: new `app/test/reports-annual-category.render.test.js` (~+180), added to `app/package.json` test list; `reports-annual-groups.render.test.js` AC-6 test taps the month first (~+3).

Estimate: +370 net LOC across 9 files (moved chart code counts once), tolerance ±40%.
Semantics this may change: none (no stored data, API or backend change; front-end only).

Overlap with 079: 079 changes `TrendBars`/`TrendCard` and the Annual `TrendCard` call in `page.tsx`, and `getAnnualSummary` in `reportService.ts`. This feature moves those exact chart functions to a new file, so build must start from `main` after 079 has merged (or rebase onto it before moving the code); moving the pre-079 version would silently undo 079's toggle and bar-tap fixes. In `reportService.ts` the new function is separate from 079's `monthSplit`, so no overlap there.

## Test plan

- Offline: the new render test file covers AC-1 to AC-7 with the fixture above, using the existing jsdom harness (`test/helpers/dom.js`) with today pinned (the page reads today's date, so the fixture must not depend on when the test runs) and the enlarged-chart bar-tap technique 079's test already uses; full `npm test` covers AC-8. Cost: one test file, no new harness.
- Interactive: AC-9 and AC-10 on staging (front-end only, so a website deploy to staging; no backend deploy needed). The verify stage drives AC-9 live; the captain does AC-10.

### Feedback Cycles

## Stage Report: spec

- DONE: Current Annual category drilldown traced with file:line evidence (what it renders today and where its data comes from), and the riskiest mechanism for the new view exercised, not asserted
  Today: a cost-group row (`app/app/reports/page.tsx:218`) sets the drill category and group (`page.tsx:1114-1116`); `page.tsx:860-881` renders `DrillDown` with `month={null}` on Annual, which fetches `getExpensesByCategory(year, null, cat, payer, group)` (`DrillDown.tsx:52-54`, `reportService.ts:341-370`) and lists every expense of the year (`DrillDown.tsx:142-171`). Spike on a throwaway worktree of the 079 branch: group-filtered month buckets summed to the mounted Living row (NT$2,100) and 079's TrendCard read out category-only bars correctly (see Risk evidence).
- DONE: Spec + top-level ## Acceptance criteria, binary and split offline vs interactive, covering per-month totals, the category-only trend chart, and tapping a month to see its expenses
  AC-1 to AC-8 offline (month list, sums, category chart, month tap and Back, toggle rule, payer, past year, unchanged Monthly/Earnings); AC-9 and AC-10 interactive on staging. One plain-language question for the captain at the top of the Spec (last year's bars in the category chart).
- DONE: Chosen layout/approach with expected files/lines and tolerance, a stated rule for how the category view treats the Life only / Include business toggle, and a note on overlap with 079's in-flight changes to app/app/reports/page.tsx and reportService.ts
  New `CategoryYear.tsx` + chart moved to `TrendChart.tsx`, `DrillDown` reused unchanged for one month; +370 LOC ±40% across 9 files. Rule: the view counts exactly the tapped row's category + group + payer, so the toggle needs no extra handling. Build must start after 079 merges, since it moves 079's TrendCard.

### Summary

Wrote the spec for a month-by-month Annual category view: header, a category-only trend chart reusing 079's TrendCard, month rows newest first, and a tap into one month's expenses via the existing list screen. The spike confirmed the per-month totals add up to the tapped row and that TrendCard handles a sparse category series; the one open question for the captain is whether the category chart keeps last year's bars (recommended yes).

## Stage Report: build

Plan (written before coding): move 079's chart block out of `page.tsx` into `TrendChart.tsx` verbatim; add `getCategoryMonths` built on `getExpensesByCategory` (this year + last year, same payer and group) so months add up to the row; new `CategoryYear.tsx` renders header, `TrendCard` with `includeBusiness={false}`, month rows, and `DrillDown` for one month; route the Annual drill-down branch in `page.tsx` to it; pin today in the new test file.

- DONE: Implementation on the build branch (from main with 079 merged): Annual category tap opens CategoryYear with header, category-only TrendCard (this year + last year, moved to TrendChart.tsx with 079's fixes intact), month rows newest first, month tap opens DrillDown for one month, Back month -> list -> Annual
  Commit 33d95a3. `git merge-base --is-ancestor 2f1d646 HEAD` passed before the move; `diff` of 2f1d646's page.tsx:391-522 against TrendChart.tsx:12-143 differs only in `export default` on TrendCard (includeBusiness + originalDataIndex intact). `next build` and `tsc --noEmit` pass.
- DONE: AC-1 to AC-8 each checked off with evidence from new tests in `cd app && npm test`, full suite green, 079's existing trend/toggle tests still passing unchanged
  `npm test`: 302/302 pass (294 baseline + 8 new in `app/test/reports-annual-category.render.test.js`, today pinned to 2026-11-02). Per claim:
  - AC-1/AC-2: rows read exactly Nov NT$0, Oct NT$1,000·4, Sep NT$400·2, Aug NT$700·1, Jul..Jan NT$0; no expense notes on screen; sum = NT$2,100. Fails if Annual still opens `DrillDown month={null}` (mutation run: all 8 fail) or if the group filter is dropped from `getCategoryMonths` (mutation run: 6 of 8 fail).
  - AC-3: enlarged category chart, every bar tapped: Oct "2025 NT$600 · 2026 NT$1,000", Aug "2025 NT$0 · 2026 NT$700". Fails if the chart gets Annual's `monthly_trend` or loses the group filter.
  - AC-4: Oct opens 4 rows, total NT$1,000, no #大筆; Back shows 11 month rows; Back again shows `cost-groups`. Fails if Back from October jumps to Annual or the group is not passed to DrillDown.
  - AC-5: Living months identical with toggle on/off; Rent row opens only Oct NT$5,000·1 and its single item. Fails if business costs leak into Life months or the Rent group is dropped.
  - AC-6: payer ijac: Aug NT$0, button disabled, sum 1,400. Fails if payer "all" is fetched.
  - AC-7: 2025 lists Dec..Jan (12), only Oct NT$600 tappable. Fails if the list is cut at today's month for every year.
  - Edges: a Dec expense dated ahead is listed (sum 2,180); a change in October shows on the month list after Back (refetch on return).
  - AC-8: `reports-monthly-compare` and `income-earnings` tests pass with no edits; 079's trend/toggle tests in `reports-annual-compare` and `income-earnings` pass unchanged; `reports-annual-groups` AC-6 gained 2 lines to tap January first. `DrillDown.tsx` untouched.
  - AC-9, AC-10 are interactive (staging), left for verify and the captain.
- DONE: Diff size within the spec's +370 LOC ±40% across the named files, or the deviation explained
  `git diff --numstat` vs main: +553 / -148 = +405 net across 10 files (spec named 9; the 10th is `package.json`'s test list, which the spec also mentioned). Within tolerance (222-518). Test file is 206 vs ~180 estimated.

### Summary

Annual category rows now open a month-by-month view: header with the year total and count, a category-only trend chart (079's TrendCard moved unchanged to `TrendChart.tsx`), month rows newest first, and a tap into one month's expenses via the unchanged `DrillDown`. Month totals come from the same `getExpensesByCategory` filter as the tapped row, so they always add up to it and the business toggle needs no extra handling. One new i18n key (`reports.by_month`); counts reuse `reports.transactions`. The `app/node_modules` symlink used to run tests is untracked and not committed.

## Verify: how it works, and how to try it

### What changed on screen

- On Reports > Annual, tapping a category row (for example Eating Out under Living costs) now opens a "month by month" screen instead of a long list of every expense in the year.
- At the top: the category name, the year, the year total (same number as the row you tapped) and how many expenses that is.
- Below: a bar chart for just that category, this year's bar beside last year's grey bar, with the same enlarge button and tap-a-bar readout as the main Annual chart.
- Below the chart: a "By month" list, newest month first. A month with no spending shows NT$0 and cannot be tapped.
- Tapping a month opens that month's expenses (the same list screen used today). Tapping an expense opens the usual edit sheet.
- Back goes one step at a time: month, then the month list, then Annual.

### What happens behind the scenes

- Nothing on the server changed. The app already asks the server for "all expenses in this category for this year, for this group and payer". The new screen asks the same question once for this year and once for last year, then adds up each month's expenses on the phone.
- Because it is the exact same question the Annual row used, the 12 month totals always add up to the row you tapped, and the Life only / Include business costs toggle needs no special handling.
- When you come Back from a month, the screen asks again, so an edit you just made shows straight away.

### Try it on staging (https://expense-sheet-staging.web.app)

Staging has no Daily Necessities spending in October, so these steps use Eating Out, which has October spending.

1. Open the staging link on your phone and sign in.
2. Tap Reports, then Annual (year 2026). Under Living costs, Eating Out reads NT$666.
3. Tap Eating Out. Expected: total NT$666, 6 transactions; a bar chart; "By month" list: Nov NT$222 (2), Oct NT$222 (2), Sep NT$222 (2), Aug to Jan NT$0 (greyed out).
4. Tap the enlarge button on the chart and tap the October bar. Expected readout: "Oct · 2025 NT$0 · 2026 NT$222". Close it.
5. Tap Oct. Expected: two expenses, total NT$222. One is NT$122 dated 2026-10-01.
6. Optional edit check: tap the NT$122 expense, Edit, change the amount to 222, Save. The October total becomes NT$322. Tap Back: Oct now reads NT$322, the October bar reads NT$322, the total reads NT$766. Tap Back again: Eating Out on Annual reads NT$766. Then change that expense back to 122.
7. Also worth a look: Daily Necessities (NT$1,923) shows Sep NT$843 and Jan NT$1,080, every other month NT$0.

## Stage Report: verify

- DONE: Build branch deployed to staging (hosting only) and confirmed live by content match, with the staging URL for the captain
  Fresh build of `6c7927d` (out/.next removed first) with `.env.staging` loaded only in the shell (gitignored copy, not committed); 0 files mention the production project id; `firebase deploy --only hosting --project staging`; `git checkout app/public/manifest.json`. sha256 `out/index.html` = curl `/` = `bc2a3b90…6c0b0ae6`; `reports.html` = `347e7818…` both sides and references chunk `0gu37dnraqnxx.js`, which is byte-identical served vs local (`ff5940b2…`) and contains `reports.by_month` (new in this branch); served `/locales/en/common.json` has `"by_month": "By month"`. Unauthenticated `GET /api` returns 401. URL: https://expense-sheet-staging.web.app
- DONE: Verification report mapping AC-1..AC-10 to pass/fail with concrete evidence, including the AC-9 live staging drive (edit an expense inside a month, Back shows the updated month total and bar)
  `cd app && npm test`: 302/302 pass. Independent falsifiers on the compiled code, reverted after (tree clean, suite re-run 8/8):
  - AC-1, AC-2 PASS: test asserts Nov 0, Oct 1,000·4, Sep 400·2, Aug 700·1, Jul..Jan 0, sum 2,100. Dropping `group` from `getCategoryMonths` fails 6 of 8 tests. Live staging rows through the real page: every Living/Rent/Uber row's months add up to the row (e.g. Daily Necessities 1,923 = Jan 1,080 + Sep 843; Rent 470,000).
  - AC-3 PASS: test reads Oct "2025 NT$600 · 2026 NT$1,000", Aug "2025 NT$0 · 2026 NT$700". Live: Eating Out Oct bar "Oct · 2025 NT$0 · 2026 NT$222".
  - AC-4 PASS: Oct opens 4 rows NT$1,000; Back to month list; Back to Annual. Live: Eating Out Oct opens 2 expenses NT$222.
  - AC-5, AC-6, AC-7 PASS: tests for toggle (Living unchanged, Rent row only NT$5,000 Oct), payer (Aug NT$0 disabled, sum 1,400), past year (12 rows, only Oct tappable).
  - AC-8 PASS: Monthly and Earnings tests pass unedited; `DrillDown.tsx` not in the diff.
  - AC-9 PASS (live data; signed-in tap left to the captain): staging rows through the compiled page, edit made in the real edit sheet on Eating Out > Oct, NT$122 -> 222: PATCH sent with amount 222; Oct screen NT$322; Back: Oct row NT$322, Oct bar "2026 NT$322", total NT$766; Back: Annual row NT$766. Then the same amount was written to the staging sheet (Expenses!C96), re-read fresh: Oct row and bar NT$322, total 766. Restored to the original "122" (cell re-read matches; Oct total back to 222, 1,506 rows). The script ran twice (once more under the refetch falsifier); both runs restored. Removing the refetch-on-Back fails the edit test, and the live drive then shows a stale NT$222 after Back.
  - AC-10 PENDING: the captain's own check on a phone, steps above. A signed-in browser drive is not possible here (sign-in needs the captain's Google account; headless browsers crash in this sandbox, as in 079).
- DONE: Plain-language explanation of the frontend behavior and backend flow, plus exact try-it steps on staging for the captain (AC-10)
  Section "Verify: how it works, and how to try it" above; uses Eating Out because staging has no October Daily Necessities.
- DONE: Mandatory PII / secrets check
  No `.env` files, keys, emails, phone numbers or URLs in the branch diff; fixtures use `ijac`/`wei`/`user1`; `git status` clean.

### Summary

Recommend PASSED: AC-1..AC-9 have test and live-staging evidence with independent falsifiers, and staging serves exactly this build (hash match). The one staging edit was restored to its original value. AC-10 is the captain's phone check on staging; note that the try-it steps use Eating Out > October, since staging's Daily Necessities has no October spending. Production was not touched.
