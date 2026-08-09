---
id: 041
title: Generate Insights Uses Latest Month, Not Viewed Month
status: verify
source: captain (previously discussed, not yet tracked)
started: 2026-07-29T12:50:21Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-041-insights-wrong-month
issue:
pr:
---

Spending Insights (entity 014) was specced to analyze whichever period the user is currently looking at — "monthly or annual depends on user is looking at monthly report or annual report" — but it actually always generates analysis for the latest month, regardless of which month is open in Reports. Example: viewing May in Reports and tapping Generate Insights returns July's analysis.

## User Stories

- As a user, I want Generate Insights to analyze the month I'm currently viewing in Reports, so the advice matches the numbers on screen.
- As a user, I want annual insights to analyze the year I'm currently viewing, for the same reason.

## Success

- Tapping "Generate Insights" while viewing a specific month in Reports generates analysis for that month, not the latest/current calendar month.
- Tapping "Generate Insights" while viewing a specific year (annual view) generates analysis for that year.
- Navigating to a different month/year and generating again produces analysis for the newly selected period.
- Verify against the currently-deployed insights-cache work (entity 039): the cache key must be scoped per period, so cached insights for one month aren't shown while viewing another.

### Out of Scope

- Changing the analysis content, tone, or AI prompt itself (entity 014)
- Changing how results are cached or the "Regenerate" mechanic (entity 039) — only which period's data feeds it

## Plan

Likely the Firebase Function that gathers insights data defaults to `now()` instead of receiving the month/year currently selected in the Reports UI. Trace how the Reports screen calls the insights endpoint and confirm the selected period is passed through and used for both the "this period" data and the comparison periods (previous 3 months, same period last year).

## Spec

### Confirmed Root Cause

Traced in the current code before writing this spec:

- `app/app/reports/page.tsx:173` — `InsightsCard` posts to `/api/insights` with **no body**. The component takes **no props** and is rendered twice (line 571 in the monthly branch, line 716 in the annual branch), so it cannot know which period is on screen or even which view it sits in.
- `functions/src/index.ts:433-435` — the endpoint derives `thisMonth` and `lastYear` from `new Date()`. `monthOffset()` (line 460) walks back from `now`, and `periodLabel` (line 510) formats `now`. The request body is never read.
- `functions/src/index.ts:475` — `recentExp.length > 0 ? recentExp : allExpenses` silently falls back to **all history** when the target month has no rows. Once the period becomes user-selected, this fallback would return whole-history analysis labelled as the viewed month.
- `functions/src/index.ts:458` — `tier` is derived from the total span of stored data (`daysSinceFirst`), not from data available at the viewed period.
- `.worktrees/spacedock-ensign-insights-cache/app/app/reports/page.tsx:149` — entity 039 caches under the flat key `INSIGHTS_CACHE_KEY = "insights_cache"`, with no period in the key. Cached text from one period will render while another is on screen.

### Goal

Generate Insights analyses the period currently open in Reports — the selected month in monthly view, the selected year in annual view — instead of always analysing the latest calendar month.

### User Stories

- As a user reviewing May in Reports, I want tapping Generate Insights to analyse May, so the advice matches the numbers on screen.
- As a user in annual view, I want insights to analyse the year I'm viewing, compared against the year before it.
- As a user switching between months, I want each month to show its own insight (or an unused button), so I never mistake one month's advice for another's.

### Acceptance Criteria

Machine-checkable ACs are written against the request payload, the assembled prompt data, and the response envelope — not against the AI's prose, which is not deterministic.

Request and response contract

- [ ] **AC-1** Generating from the monthly view sends `POST /api/insights` with a JSON body `{ period: "monthly", year: <number>, month: <number 1-12> }` matching the month currently displayed.
- [ ] **AC-2** Generating from the annual view sends `POST /api/insights` with a JSON body `{ period: "annual", year: <number> }` matching the year currently displayed.
- [ ] **AC-3** A successful response echoes the analysed period: `{ insights: string, period: { type: "monthly" | "annual", year: number, month?: number } }`, and the echoed values equal the values sent in the request.
- [ ] **AC-4** A request with a missing, malformed, or out-of-range period (absent body, `month` outside 1–12, non-numeric `year`) returns HTTP 400 with `{ error_code: "bad_period" }` and makes no Anthropic API call.

Monthly analysis window

- [ ] **AC-5** For `{ monthly, year: Y, month: M }`, the "Spending so far" category totals in the prompt equal the sum of expenses whose `date` starts with `Y-MM`, and no expense outside that month contributes.
- [ ] **AC-6** The prompt's period label reads as the requested month (e.g. `May 2026` for `{2026, 5}`), not the current calendar month.
- [ ] **AC-7** The "Previous 3-month average" window is the three months immediately preceding the requested month, and "Same month last year" is the requested month minus 12 months — both computed from the requested period, not from `now`.

Annual analysis window

- [ ] **AC-8** For `{ annual, year: Y }`, the analysed category totals equal the sum of expenses whose `date` starts with `Y`, and no expense outside that year contributes.
- [ ] **AC-9** Annual comparison data is the prior calendar year (`Y-1`) in place of the monthly previous-3-month and same-month-last-year blocks; the prompt contains no month-over-month comparison block in annual mode.
- [ ] **AC-10** The prompt's period label reads as the requested year (e.g. `2025`).

Empty and insufficient periods

- [ ] **AC-11** The `recentExp.length > 0 ? recentExp : allExpenses` fallback at `functions/src/index.ts:475` is removed. A requested period with zero matching expenses returns `{ insufficient_data: true, days: 0, period: {...} }` and never returns analysis built from a different period's expenses.
- [ ] **AC-12** The data tier is computed from history available **up to and including** the requested period, not the full stored span: a requested month preceded by fewer than 3 months of data does not receive the `full` tier, even when later months exist in the sheet.
- [ ] **AC-13** Comparison blocks whose window predates all stored data are omitted from the prompt rather than sent as zero values.

Cache scoping (interaction with entity 039)

- [ ] **AC-14** The localStorage cache key includes the period — `insights_cache:monthly:YYYY-MM` for monthly and `insights_cache:annual:YYYY` for annual — so each period has its own entry.
- [ ] **AC-15** Switching to a period with no cached entry shows the idle "Generate Insights" state; text cached for a different period is never displayed.
- [ ] **AC-16** Switching to a period **with** a cached entry displays that period's text and that entry's own "Generated:" timestamp (039 AC-3 holds per period).
- [ ] **AC-17** Tapping "Regenerate" replaces only the currently-viewed period's entry; entries cached for other periods remain readable afterwards.
- [ ] **AC-18** A legacy flat `insights_cache` entry written before this change is not displayed for any period, and does not cause a crash or a blank card.
- [ ] **AC-19** If the user navigates to a different period while a generation is in flight, the arriving result is not displayed as the new period's insight; it is matched by the AC-3 echoed period and either stored to its own key or discarded.

### Edge Cases

- **Viewing a future month or year.** `nextMonth()` (`page.tsx:329`) has no upper bound, so the user can navigate past today. A future period has no expenses and must take the AC-11 empty-period path, not fall back to any other period's data.
- **Viewing the current, partial month.** The label must still read as that month; a partial month is a legitimate analysis target and must not be rerouted or padded.
- **Viewing a month entirely before any stored data.** Same empty-period path as AC-11 — no analysis of the nearest month with data.
- **Viewing the earliest month with data.** Comparison windows fall entirely outside stored data; AC-13 omission applies so the AI does not read absent history as "spending dropped to zero".
- **Rapid period switching during generation.** Covered by AC-19; two generations in flight at once must each resolve against their own period.
- **localStorage quota exhausted** after accumulating many per-period entries. A failed cache write must leave the freshly generated insight displayed on screen rather than surfacing an error or blanking the card.
- **Sheets read fails** for a valid period. Existing `data_error` behaviour is unchanged; the period echo is not required on error responses.

### Out of Scope

- The analysis content, tone, section structure, or AI prompt wording (entity 014). Only which period's numbers are fed into the existing prompt changes.
- The caching mechanism and the "Regenerate" mechanic themselves (entity 039). This feature scopes 039's cache key per period and nothing else — no expiry, no cross-device sync, no per-user cache.
- Applying the Reports payer filter (`payer` state, `page.tsx:280`) to insights. Insights currently analyse all payers regardless of the filter; that remains true and is a separate concern.
- Any change to the monthly/annual summary numbers themselves, which are computed client-side in `app/app/lib/reportService.ts` and are already period-correct.
- Backfilling or migrating existing cached insights into period-scoped keys — AC-18 discards the legacy entry rather than attributing it to a guessed period.

## Stage Report: spec

- DONE: Spec has Goal, User Stories, Acceptance Criteria (binary/testable), Edge Cases, Out of Scope per README Spec Template
  All five template sections present under `## Spec`. ACs are written against the request payload, assembled prompt data, and response envelope rather than the AI's prose, so each is binary; AI output is non-deterministic and cannot carry a testable assertion.
- DONE: Acceptance criteria cover both monthly and annual views generating for the viewed period, and interaction with the insights-cache (039) cache key so cached insights don't leak across periods
  Monthly: AC-1, AC-5/6/7. Annual: AC-2, AC-8/9/10. Cache: AC-14 scopes the key to `insights_cache:monthly:YYYY-MM` / `insights_cache:annual:YYYY`; AC-15 forbids showing another period's text; AC-19 closes the in-flight period-switch race using the AC-3 echoed period.
- DONE: Out of Scope explicitly excludes changes to the AI prompt/tone (014) and the caching/regenerate mechanism itself (039)
  Both named in the first two Out of Scope bullets, each tagged with its entity number. Three further exclusions added to close scope-bleed found during tracing (payer filter, reportService summaries, legacy cache backfill).

### Root Cause Verification

Every file:line in the spec was traced in the working tree and re-verified by reading each cited line back:

- `app/app/reports/page.tsx:173` — `fetch(.../api/insights, { method: "POST" })` sends no body; `InsightsCard` takes no props and is rendered at both line 571 (monthly) and 716 (annual), so it cannot know the on-screen period.
- `functions/src/index.ts:433-435` — `const now = new Date()` feeds `thisMonth` and `lastYear`; `monthOffset` (460) and `periodLabel` (510) also derive from `now`. The request body is never read.
- `functions/src/index.ts:475` — `recentExp.length > 0 ? recentExp : allExpenses` is a latent whole-history fallback that becomes a correctness bug the moment the period is user-selected. AC-11 removes it.
- `functions/src/index.ts:458` — `tier` derives from total stored span, so a viewed month lacking 3 months of prior data would still be labelled `full`. AC-12 covers it.
- `.worktrees/spacedock-ensign-insights-cache/app/app/reports/page.tsx:149` — 039's `INSIGHTS_CACHE_KEY = "insights_cache"` is flat with no period component; this is the concrete leak AC-14 fixes.

### Summary

Wrote the spec grounded in a live trace rather than the entity's conjecture — the Plan's guess was correct but incomplete. Beyond the `now()` defaulting, tracing surfaced three problems the original framing missed: the whole-history fallback at `index.ts:475` that would mislabel an empty period's analysis, tier computation from total span rather than data-up-to-the-viewed-period, and the in-flight period-switch race. 19 ACs across five groups (request/response contract, monthly window, annual window, empty/insufficient periods, cache scoping). Note for build: entity 039 is still in `verify` on PR #12 and unmerged, so AC-14 through AC-19 land on top of code that is not yet on `main` — sequencing needs the FO's call.

## Build Plan

Written before coding, per the build stage definition.

Backend — `functions/src/index.ts` + new `functions/src/insights.ts`

1. Extract the period maths and prompt assembly out of the inline `/api/insights` block into `functions/src/insights.ts`, exporting `parseInsightsPeriod(body)` and `buildInsightsPrompt({ expenses, subscriptions, period, nowMs })`. The extraction is what makes AC-4 through AC-13 checkable without Google Sheets or an Anthropic key — the endpoint itself needs both.
2. `parseInsightsPeriod` returns the validated period or `null`; the endpoint answers `null` with HTTP 400 `{ error_code: "bad_period" }` before the Sheets read and before any Anthropic call (AC-4).
3. All windows derive from the requested period, never `now`: month keys by integer arithmetic (`year * 12 + month - 1 - n`) so no `Date` year quirks; label from a `MONTH_NAMES` constant (AC-5..AC-10).
4. Drop the `recentExp.length > 0 ? recentExp : allExpenses` fallback. Zero expenses in the requested period returns `{ insufficient_data: true, days: 0, period }` (AC-11).
5. Tier counts only months with data strictly before the requested period, and the day span ends at the requested period's end (capped at today for a partial period), so later months cannot promote a tier (AC-12).
6. A comparison block whose window holds no data is omitted from the prompt entirely rather than printed as `(no data)` (AC-13). Annual mode replaces both monthly blocks with a single prior-year block (AC-9).
7. Success responds `{ insights, period: { type, year, month? } }` (AC-3).

Frontend — `app/app/reports/page.tsx`

8. `InsightsCard` takes a `period` prop; the two call sites pass the on-screen month / year (AC-1, AC-2).
9. Cache key becomes `insights_cache:monthly:YYYY-MM` / `insights_cache:annual:YYYY`; the legacy flat `insights_cache` key is never read, so it can never be displayed (AC-14, AC-18).
10. An effect keyed on the cache key re-reads the cache on every period change — cached text for that period, otherwise idle (AC-15, AC-16, AC-17).
11. A generation captures its own key, resolves against the AC-3 echoed period, and writes its own cache entry; it updates the display only when its key is still the on-screen one (AC-19).

Proof

- `functions/test/insights.test.js` (`node --test`, no new dependencies) exercises the compiled module against fixture expenses for AC-4..AC-13.
- `tsc` over `functions`, `next build` over `app` for the whole-repo compile.
- AC-15..AC-19 are UI behaviours with no browser harness available in this environment; they are implemented and typechecked here and belong to verify's live pass.

## Stage Report: build

- DONE: Request/response contract: /api/insights reads period from the request body instead of defaulting to now() (AC-1 through AC-4)
  Live: `POST /api/insights` for `{monthly,2025,5}` and `{annual,2025}` against staging each echo the exact requested period back in `period`. Three malformed bodies (`{}`, `month:13`, `year:"2026"` as string) each returned `400 {"error_code":"bad_period"}` in ~0.5s vs 6.5s for a real generation — confirms the reject path skips the Sheets read and the Anthropic call (AC-4).
- DONE: Monthly and annual analysis windows are computed from the requested period, not from now(), including comparison windows (AC-5 through AC-10)
  `node --test` against `functions/lib/insights.js` (the exact compiled module now deployed): 12/12 pass, AC-5..AC-10 each with a falsifying assertion (e.g. AC-5 asserts July's row does not leak into May's total). Live corroboration: the real May-2025 generation's AI output independently flagged "Transportation ... more than 10× your previous three-month average," consistent with a real Feb–Apr window being computed and fed into the prompt.
- DONE: Whole-history fallback removed; empty periods return insufficient_data instead of another period's data; tier reflects data up to the viewed period (AC-11 through AC-13)
  Live: a future period (`2099-03`) and a pre-history period (`2024-12`) each returned `{insufficient_data:true,days:0,period:{...echoed...}}` — never another period's numbers. Unit tests for AC-11/12/13 pass against the deployed code, including the spec's named edge case (Feb 2025, preceded by 1 month of data, stays `tier:"month"` despite 18 later months existing in the sheet).
- DONE: Insights cache key is scoped per period, building on entity 039's now-merged cache (AC-14 through AC-19)
  AC-14 live: the deployed hosting chunk (`_next/static/chunks/0kts4pk97xe-_.js`, sha256 `429ac029…`, byte-identical to this build's local `app/out` output) contains the `insights_cache:monthly:` / `insights_cache:annual:` key templates, not the old flat key. AC-15..AC-19 (cache re-read on switch, regen isolation, legacy-key discard, in-flight race) are reviewed in the commit `1910527` diff (`app/app/reports/page.tsx`, `currentKeyRef`/`inflightKeysRef` guards) and match spec, but are LIVE-BLOCKED here — no browser is launchable (below).

### Backend live evidence — staging (`https://expense-sheet-staging.web.app`)

Redeployed this run: `npm run build` (tsc) + `firebase deploy --only functions --project expense-sheet-staging` (`api(us-central1)`: "Successful update operation"), and `app` rebuilt against `.env.staging` + `firebase deploy --only hosting --project expense-sheet-staging`.

- `POST {period:"monthly",year:2025,month:5}` → `200`, real `insights` text, `period` echoes `{monthly,2025,5}` exactly.
- `POST {period:"annual",year:2025}` → `200`, `period` echoes `{annual,2025}` exactly.
- `POST {}` / `{...,month:13}` / `{...,year:"2026"}` → all `400 {"error_code":"bad_period"}`.
- `POST {monthly,2099,3}` and `{monthly,2024,12}` → both `200 {"insufficient_data":true,"days":0,"period":{...}}`.

### Environment limitation — no browser launchable (AC-15..AC-19)

Re-confirmed independently of entity 044's verify report, same signature: `npx playwright install chromium` → `EPERM: operation not permitted, lstat '/Users/ijac/Library/Caches'`; cached browser builds are version-skewed regardless (chromium wants build 1234, cache has 1228). No real or headless browser is launchable in this sandbox. Code is implemented and reviewed; behaviour is unobserved in a running page. Flagged for the verify stage's captain-assisted manual pass.

### Summary

Inherited a complete implementation at commit `1910527` (prior ensign crashed post-commit, not from a logic failure) and verified rather than re-built it: 12/12 unit tests pass against the exact compiled module now redeployed, live HTTP round trips against staging confirm the request/response contract and the empty-period/no-fallback behaviour end-to-end, and the deployed hosting bundle is byte-identical (sha256) to this build's output and carries the period-scoped cache key format. No AC failed and no gap was found requiring a fix. AC-15..AC-19 remain implemented-but-unobserved due to a sandbox environment limitation (no launchable browser), the same blocker independently hit by entity 044's verify stage.
