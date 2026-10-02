---
id: 071
title: Split Report > Annual into fixed, big extras, and living costs
status: verify
source: captain
started: 2026-10-02T09:36:45Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-071-cost-cutting-review
issue:
pr: pr-merge:42
mod-block: merge:pr-merge
gates:
    version: 1
    records:
        - id: gate:071:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:071-ideation-1
              briefing:
                id: briefing:071:ideation:attempt-1:revision-1
                digest: sha256:444b94ff5cb1ae9a7703a07d6706506d1e136bf16f0d4684affff2a184edeb44
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:071:ideation:1
                briefing: briefing:071:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-10-02T09:36:25.443127Z"
                decision: approve
                reason: 'Captain approved in chat ("approve, move to spec") after reviewing 071 via /r and answering all ideation questions: Annual summary block above unchanged category list; Fixed via per-category Settings switch; Big extras via #大筆 note keyword (fixed category wins); Living costs per category; new group-share donut; Annual only.'
              application:
                target-stage: spec
                state: consumed
        - id: gate:071:spec
          stage: spec
          attempts:
            - id: gate-attempt:071-spec-1
              briefing:
                id: briefing:071:spec:attempt-1:revision-1
                digest: sha256:25bf2d0930f2d291231b3b819f7ccc86f18e51b972e853379cf0b6ac0f5d5435
                room-ref: ./review/spec/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:071:spec:1
                briefing: briefing:071:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-10-02T09:47:49.014374Z"
                decision: approve
                reason: 'Captain approved the spec in chat ("approve, yes on ＃大筆") after the gate review: AC-1..AC-13 as written; spec question resolved yes — full-width ＃大筆 also counts as a big extra (AC-3 last case stands).'
              application:
                target-stage: build
                state: consumed
        - id: gate:071:verify
          stage: verify
          attempts:
            - id: gate-attempt:071-verify-1
              briefing:
                id: briefing:071:verify:attempt-1:revision-1
                digest: sha256:5d246556d58b35ab85a3f43922c846856477c9bf412b9c6c14c713fb920c0c99
                room-ref: ./review/verify/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:071:verify:1
                briefing: briefing:071:verify:attempt-1:revision-1
                by: person:captain
                at: "2026-10-02T10:11:56.27975Z"
                decision: approve
                reason: Captain approved verify in the Subspace gate review (binding resolution, briefing:071:verify:attempt-1:revision-1) after the staging phone check, and said "good . deploy to prod" in chat.
              application:
                target-stage: done
                state: pending
---

## Spec question (captain, at gate) — answered

- **Full-width hash:** `＃大筆` also counts as a big extra. Captain answered **yes** at the spec gate (2026-10-02); AC-3's last case stands.

## Decisions (captain, 2026-10-02 review)

- **Placement:** keep today's "By category" list as is; add a new summary block above it.
- **Fixed detail:** show the fixed total plus each fixed category underneath (tap opens drill-down, as today).
- **Who sets "fixed":** an on/off "fixed" switch per category in Settings. Starts on for insurance, babies, mortgage, tuition.
- **Big extras (大筆額外):** marked by the keyword `#大筆` in the expense's existing note field (no new tick or column). Replaces the earlier per-expense tick idea.
- **Past expenses:** captain adds the keyword by hand in the app's expense edit screen; no bulk backfill.
- **Fixed vs. keyword:** the category wins. An expense in a fixed category stays Fixed even if its note has the keyword.
- **Scope:** Annual tab only this round.
- **Charts:** keep today's donut/bar chart; add a second donut showing the share of each group.

## Goal

In Report > Annual, split the year into the same three groups the captain's own planning sheet uses, so living costs — the part that can be cut back — stand out.

| Captain's sheet column | In the app |
|---|---|
| Insurance 保費, Babies, Mortgage 房貸, Tuition 學費 → Total 固定 | **Fixed:** categories switched on as fixed in Settings, each listed, plus their total |
| 大筆額外 | **Big extras:** non-fixed expenses whose note has `#大筆`, plus their total |
| 生活費預估 | **Living costs:** everything else, each category listed, plus their total |
| Total Spending | The year total already shown |

The three group totals add up to the year total. The monthly trend chart stays at the top of Annual (shipped in 070).

## User Stories

- As a user opening Report > Annual, I want fixed, big extras, and living costs shown as three totals so that I see how much of the year is locked in, one-off, or everyday.
- As a user reviewing where to save, I want each living-cost category listed with its amount so that I can pick which ones to cut.
- As a user adding a large one-off expense, I want to add the keyword to its note so that it doesn't inflate my everyday living costs.
- As a user, I want to choose which categories count as fixed in Settings so that the split changes when my life does.
- As a user, I want a donut showing each group's share of the year so that the balance is visible at a glance.

## Success

- Annual shows Fixed, Big extras, and Living costs totals that add up to the year total.
- Each fixed and each living-cost category is listed with its spend.
- A non-fixed expense whose note has the keyword counts under Big extras, not Living costs; an expense in a fixed category stays Fixed regardless.
- Switching a category's "fixed" setting in Settings moves it between groups on the next report load.
- A new donut shows the three groups' shares; the existing donut/bar chart is unchanged.

## Known risks (for spec)

- Category ids can differ between staging and production (e.g. staging-only `cat_003`); `app/app/lib/reportService.ts:25` already resolves by name. The fixed setting must be stored on the category itself so it works in both environments.
- No "fixed" field exists on categories today; it needs a new optional column on the Categories tab (`functions/src/sheetSchema.ts` already supports optional columns created on demand). Big extras need no new storage — they read the existing `notes` column.
- Keyword matching is silent on typos: a misspelled keyword leaves the expense in Living costs.

### Out of Scope

- Monthly tab split (may follow later).
- Marking single recurring subscriptions as fixed — from the original 071, deferred.
- A "realistic cut" savings estimate — from the original 071, deferred.
- Multi-year projection of when fixed costs end — dropped with 072 (captain already has a forecast).
- Changing the monthly trend chart (done in 070) or the existing donut/bar chart.

## Spec

Goal, user stories and out-of-scope list: see the ideation sections above (single source). This section adds the approach, edge cases and file plan.

### Approach

- **Fixed switch storage:** a new optional `fixed` column on the Categories tab, read and written by header name (like `gov_category` and `note`). Cell `true` / `false` = set by the captain; blank or column absent = never set.
- **Defaults without a data migration:** a never-set category counts as fixed when its English name is Insurance, Babies, Mortgage or Tuition (the names of the `insurance`, `babies`, `mortgage`, `tuition` entries in `DEFAULT_CATEGORIES`). Once the captain flips the switch, the stored value wins. Nothing is written to either sheet at deploy.
- **Column created on first use:** the first save of a fixed switch adds the `fixed` header itself, past the widest occupied row (same rule as the subscription date columns), so production's unnamed `note` data under H1 is never overwritten. No manual sheet edit, on staging or production.
- **Grouping (client side, in `reportService.ts`), per expense of the year after the payer filter:**
  1. Resolve its category with the existing `resolveCategory` (handles legacy slugs like `insurance` and staging-only ids). Category fixed → **Fixed**.
  2. Else note contains `#大筆` (or `＃大筆`) → **Big extras**.
  3. Else → **Living costs** (includes expenses whose category can't be resolved).
- **Annual data already carries notes:** `getSharedExpenses` returns each expense's `notes`, so no new API call.
- **New summary block on Annual,** placed after the existing donut/bar chart and before today's "By category" list:
  - The three group totals with their share of the year, and a new 3-segment group donut.
  - Fixed: each fixed category with its amount; tap opens today's drill-down.
  - Big extras: each tagged expense listed on its own line (date, category, note, amount).
  - Living costs: each category with its living-only amount (big extras removed); tap opens the drill-down filtered to the same expenses, so the list adds up to the row.
- **Settings:** the existing category edit form gets a "Fixed cost" on/off switch, saved with the same update call; the category list shows a small "Fixed" badge.
- **Fresh data after a switch:** Reports caches the category list for the session. Saving a category clears that cache, so the next Annual load reflects the new switch without a page reload.
- **Unchanged:** existing donut/bar chart and toggle, "By category" list, by-payer, insights, Monthly tab.

### Edge cases

- **Expense in a fixed category with `#大筆`:** stays Fixed (captain decision).
- **Keyword typo (`#大比`, `大筆` without hash):** stays in Living costs, silently. Accepted risk from ideation.
- **Keyword anywhere in the note** (`日本機票 #大筆 x4`): counts.
- **Legacy slug ids** (most past expenses store `insurance`, not `cat_023`): resolved to the live category, so its switch applies.
- **Category renamed** (e.g. Babies → Kids) while never set: loses the default and counts as living until the captain flips the switch. Settings shows the resolved value, so this is visible.
- **Archived fixed category:** still counted as fixed for its past expenses.
- **Categories fetch fails (offline):** falls back to the built-in list; the four default names still count as fixed; explicit switches are unknown until back online.
- **Payer filter:** groups follow it, like every other Annual number.
- **A group is empty:** its total shows NT$0 and it has no rows; the group donut skips the empty segment.
- **Year with no expenses:** today's empty state, no summary block.
- **Two people saving switches at once:** each save rewrites only its own row; if both are the first save ever, both write the same `fixed` header cell, so no duplicate column.
- **Save sent with a `fixed` value to today's backend:** silently ignored with a 200 (spike, below). The backend change must ship with the Settings change.

### Files and expected lines changed (tolerance ±35% overall)

| File | Change | Lines |
|---|---|---|
| `functions/src/sheetSchema.ts` | `fixed` added to Categories optional columns | ~3 |
| `functions/src/index.ts` | `fixed` in category read/POST/PATCH; column-on-demand helper shared with subscriptions | ~30 ±10 |
| `functions/test/categories.api.test.js` | round-trip on staging and production header shapes | ~70 ±25 |
| `app/app/lib/categories.ts` | `fixed` on `Category`; default names; `isFixedCategory()` | ~20 ±8 |
| `app/app/lib/categoryService.ts` | `fixed` in update type; clear report category cache on save | ~6 ±4 |
| `app/app/lib/reportTypes.ts` | group summary types on `AnnualSummary` | ~20 ±8 |
| `app/app/lib/reportService.ts` | grouping, keyword match, drill-down group filter, cache clear | ~75 ±25 |
| `app/app/reports/page.tsx` | summary block, group donut (optional colors prop on `DonutChart`) | ~110 ±40 |
| `app/app/reports/DrillDown.tsx` | pass the group filter through | ~6 ±4 |
| `app/app/settings/categories/page.tsx` | Fixed switch in edit form, badge in list | ~25 ±10 |
| `app/public/locales/{en,zh}/common.json` | ~8 new keys each | ~16 |
| `app/test/` new `cost-groups.test.js`, `reports-annual-groups.render.test.js`, `category-fixed.render.test.js`; `reports-annual-order.render.test.js` updated; `app/package.json` test list | tests | ~280 ±100 |

Total ≈ 660 ±230 lines. No new dependencies, no data migration.

## Acceptance criteria

**AC-1 — The three group totals add up exactly to the Annual year total.**
Verified by: offline — `cost-groups.test.js` builds an Annual summary from a fixture mixing fixed categories, a `#大筆` note in a fixed and a non-fixed category, a legacy slug id, an unknown category id, and two payers; asserts fixed + big extras + living = year total, for "all" and for each payer. Falsified by: dropping unresolvable categories from Living, or counting a keyword expense in both Fixed and Big extras.

**AC-2 — A category's fixed status is its stored switch when set, else the default by name.**
Verified by: offline — `cost-groups.test.js`: `fixed: true` on Groceries → Fixed; `fixed: false` on Insurance → not Fixed; blank on Insurance/Babies/Mortgage/Tuition → Fixed; blank on Eating Out → not; legacy slug `insurance` expense follows live `cat_023`'s switch. Falsified by: matching the switch by stored id only (legacy slugs miss it).

**AC-3 — Keyword rule: a non-fixed expense whose note contains `#大筆` or `＃大筆` is a big extra; fixed category wins.**
Verified by: offline — `cost-groups.test.js` cases: `"機票 #大筆"` in Travel → Big extras; `"#大筆"` in Insurance → Fixed; `"大筆"` (no hash) → Living; `"＃大筆"` → Big extras. Falsified by: a whole-note equality match, or checking the keyword before the category.

**AC-4 — The fixed switch round-trips through the API on both sheet shapes without disturbing other columns.**
Verified by: offline — `categories.api.test.js` against the in-memory sheet: on a staging-shaped header (A–F only) a PATCH `{fixed: true}` adds the `fixed` header at G and writes `true`; on a production-shaped header (A–G named, `note` data under blank H1) it lands at I and H's note is byte-identical; GET returns `fixed: true | false | null`; a later rename PATCH keeps the `fixed` cell. Falsified by: today's code (200, nothing written — see spike).

**AC-5 — Annual shows the summary block between the existing chart and the unchanged "By category" list.**
Verified by: offline — `reports-annual-groups.render.test.js` mounts the real Reports page: three group totals, a 3-segment group donut, fixed category rows, big-extra expense lines, living rows; block sits after the chart and before "By category"; the "By category" rows (count, order, amounts) equal those rendered from the same data without the feature's fixture flags. `reports-annual-order.render.test.js` still passes with the new block in its expected order. Falsified by: replacing or re-ordering the existing list.

**AC-6 — A living-cost row's drill-down lists exactly the expenses behind its amount.**
Verified by: offline — render test: tapping Travel under Living costs with one `#大筆` Travel expense shows a list whose amounts sum to the row and omits the tagged one; tapping Travel in today's "By category" list still shows all Travel expenses. Falsified by: reusing the unfiltered drill-down for the living row.

**AC-7 — Saving a category switch is reflected on the next Annual load in the same session.**
Verified by: offline — `cost-groups.test.js`: load Annual, call `updateCategory(id, {fixed: true})`, load Annual again → categories refetched and the category moved to Fixed. Falsified by: keeping the per-session cache uncleared.

**AC-8 — The Settings edit form shows and saves the Fixed switch.**
Verified by: offline — `category-fixed.render.test.js`: Insurance (blank) opens with the switch on, Groceries off; toggling and saving sends `fixed` in the PATCH body. Falsified by: the form omitting `fixed` from the save.

**AC-9 — Both test suites and builds pass.**
Verified by: offline — `npm test` in `app/` and `functions/` exit 0; `npm run build` in `app/` exits 0.

**AC-10 — On live staging, Report > Annual shows Fixed, Big extras and Living costs totals that add up to the year total shown.**
Verified by: interactive — verify agent or captain opens staging Annual for 2026, reads the three totals and the year total, and the sum matches to the dollar (after tagging at least one non-fixed staging expense with `#大筆`). Falsified by: any mismatch.

**AC-11 — On live staging, flipping a category's switch in Settings moves it between groups, and the sheet gains only a `fixed` column.**
Verified by: interactive — switch Groceries on, return to Annual → Groceries under Fixed; switch off → back under Living. Staging Categories tab then has a `fixed` header and every other column's values unchanged.

**AC-12 — The Monthly tab is unchanged on live staging.**
Verified by: interactive — Monthly for the current month shows the same sections in the same order with the same totals before and after the deploy, and no group block.

**AC-13 — The existing Annual donut/bar toggle is unchanged on live staging.**
Verified by: interactive — toggling Donut/Bar on staging Annual shows the per-category chart as before; the new group donut stays visible and does not change with the toggle.

## Risk evidence

Riskiest mechanism: storing the per-category "fixed" switch so it round-trips Settings → Categories tab → Annual on both sheets. Offline spike (scratch script driving the real built API and `sheetSchema` against the repo's in-memory sheet stub, `functions/test/sheetsStub.js`):

- **Today's API silently drops `fixed`:** PATCH `{fixed: "true"}` returns 200 and writes nothing, on both header shapes; GET has no `fixed` key. The backend change is required, and AC-4 guards against a silent no-op.
- **Staging shape** (headers A–F, no `gov_category`/`note`): column-on-demand places `fixed` at G; the written row reads back `"true"`.
- **Production shape** (A–G named, `note` data under blank H1): widest row is 8, so `fixed` lands at I; H's note survives the write.
- **Untouched rows** read `undefined` → treated as never set → default by name. No data migration needed.
- **Notes reach the Annual report:** GET `/api/expenses` on the stub returns `notes` (`"Japan trip #大筆"`), and `getSharedExpenses` feeds `getAnnualSummary`, so keyword matching needs no new fetch.
- **Not exercised:** reading the live staging and production Categories headers. The read-only script was blocked by the session's permission classifier. The column-on-demand rule does not depend on the exact live header (it places past the widest row), and AC-11 checks the staging sheet live; the production header gets checked by the captain after the first switch on production.

### Feedback Cycles

- 2026-10-02 review: captain answered the five ideation questions and added the big-extras group (per-expense tick, chosen over category-level or amount threshold). Follow-up same day: captain switched the tick to a keyword in the note; past expenses marked by hand in the app; fixed category wins over the keyword; keyword is `#大筆`.

## Stage Report: spec

- DONE: Write the spec for the three-group Annual split (Fixed via a per-category Settings switch defaulting on for insurance/babies/mortgage/tuition; Big extras = non-fixed expenses whose note contains #大筆, fixed category wins; Living = the rest per category; group totals sum to the year total; new group-share donut; existing category list and donut/bar unchanged), naming exact files and expected lines changed with tolerance
  `## Spec` (Approach, Edge cases, Files table: 12 files, ≈660 ±230 lines, no migration); one open question (full-width `＃大筆`) at the top of the file.
- DONE: Spike the riskiest mechanism before the gate: how the per-category "fixed" setting is stored and round-trips through Settings -> Categories tab -> Annual report on both staging and production sheets (ids differ, Categories header has optional columns), and whether the Annual report data already carries each expense's notes for #大筆 matching; record what the spike showed
  `## Risk evidence`: offline spike on the real built API + sheet stub. Today's PATCH silently drops `fixed` (200, nothing written); column-on-demand lands at G (staging shape) / I (production shape, H note preserved); expenses API returns notes. Live-sheet header read was blocked by the permission classifier, so it is recorded as not exercised and covered by interactive AC-11.
- DONE: Every acceptance criterion is binary and labeled offline or interactive, including one interactive AC on live staging Annual showing the three totals summing to the year total and one confirming the Monthly tab is unchanged
  AC-1..AC-9 offline (named tests + falsifiers), AC-10..AC-13 interactive; AC-10 = staging totals sum, AC-12 = Monthly unchanged.

### Summary

Spec stores "fixed" as an optional `fixed` Categories column created on first save (past the widest row, so production's unnamed note column is safe), with blank cells defaulting to fixed for Insurance/Babies/Mortgage/Tuition by name, so no data migration. Grouping runs client side on data already loaded (notes included); living rows exclude big extras and their drill-down is filtered to match, and saving a category clears Reports' session category cache. Key spike finding: today's backend silently accepts and drops a `fixed` field, so backend and Settings must ship together.

## Stage Report: build

- DONE: Write the offline tests first (cost-groups, reports-annual-groups render, category-fixed render, categories API round-trip on staging and production header shapes) and show each fails on main before implementing; then implement until AC-1..AC-9 pass, with full `npm test` in app/ and functions/ plus `npm run build` in app/ exiting 0
  Tests committed alone in f4fdd61: on unchanged code app 16 fail / functions 5 fail (only the two "nothing appears" guards passed). Implementation 6e75fb0: functions 365/365, app 259/259, `npm run build` exit 0.
- DONE: Prove the fixed column round-trip does not disturb other columns (AC-4: production-shaped header keeps the unnamed H note byte-identical, fixed lands past the widest row) and that full-width ＃大筆 counts as a big extra (captain resolved the spec question yes)
  `categories.api.test.js` 071 AC-4: staging shape → `fixed` header at G, A–F identical; production shape → header at I, H1 stays blank, every H note byte-identical; rename keeps the cell; second switch reuses the column. Placing by row-1 width instead fails 2 of them. `cost-groups` AC-3: `＃大筆` → Big extras; dropping the full-width keyword fails 3 tests.
- DONE: Report surface vs. the spec estimate (12 files, ~660 ±230 lines) and confirm the existing By-category list, donut/bar toggle and Monthly tab are untouched
  Surface: 19 files, +817 −67 = 884 changed lines (134% of 660; inside the 890 upper bound). The spec's single "tests" row covers 7 test files. Three changes the spec did not list: the `sheetColumns` golden JSON gains `"fixed":null` (same approach as 053/059), `test/helpers/dom.js` resets the category cache, and `toReportExpense` is pulled out of `getExpensesByCategory` to share it. `reports/page.tsx` diff has no hunk in the Monthly section or the By-category rows. DonutChart only gains optional `colors`/`testId` props whose defaults keep today's output. Render test shows By-category rows identical with and without the feature data.

### Acceptance criteria evidence (one line per claim, with the change that breaks it)

- AC-1 `cost-groups`: fixed + big extras + living = year total for all/user1/user2, and each group's rows add up to its total. Fails if unresolvable categories are dropped from Living or a keyword expense counts twice.
- AC-2 `cost-groups`: stored true/false wins; blank Insurance/Babies/Mortgage/Tuition → fixed; legacy slug `insurance` follows `cat_023`. Matching the switch by stored id only fails 1 test.
- AC-3 `cost-groups`: `機票 #大筆` → Big extras; `#大筆` in Insurance → Fixed; `大筆` without a hash → Living; `＃大筆` → Big extras. Checking the keyword before the category fails 2 tests.
- AC-4 see the second checklist item.
- AC-5 `reports-annual-groups`: three totals, 4-circle group donut (3 when a group is empty), fixed/big-extra/living rows, block between the chart and By category, group donut stays when Bar is on, no block when the year is empty. `reports-annual-order` lists `reports.cost_groups` in its expected order.
- AC-6 `reports-annual-groups` + `cost-groups`: the Travel living row drills to NT$1,200 without the tagged trip; By category Travel still drills to NT$31,200. Removing the group filter from DrillDown fails it.
- AC-7 `cost-groups`: `updateCategory` → next Annual load refetches categories and moves Groceries to Fixed. Removing the cache clear fails it.
- AC-8 `category-fixed`: Insurance (blank) opens on, Groceries off, stored-false Mortgage off; toggling and saving sends `fixed`; untouched switch sends no `fixed`; badge follows. Dropping `fixed` from the save fails it.
- AC-9: suites and build above. AC-10..AC-13 are interactive (staging) and belong to verify.

### Summary

The backend reads and writes `fixed` as true/false/null. The first save creates the column past the widest row, using the shared `ensureColumns` (renamed from the subscriptions-only helper). The app groups each Annual expense with `resolveCategory` → `isFixedCategory` → keyword. Annual gets a summary block with a group donut, and living rows drill into a group-filtered list. Settings gets a Fixed switch and badge. Decisions to note: (1) the session category cache moved from `reportService` to `categoryService` so every category write clears it without an import cycle. (2) The form writes `fixed` only when the switch differs from the category's resolved value, so untouched defaults stay blank. As the spec's edge case says, renaming a never-set Babies drops its default. (3) Two existing tests were updated for the new field: the 047 AC-9 deepEqual gains `fixed: null`, and the sheetColumns golden JSON.

## Stage Report: verify

verdict: BLOCKED — offline ACs re-verified and falsified independently. The staging deploy was denied by the session's permission classifier, so AC-10..AC-13 have no live evidence yet. No AC failed.

- DONE: Re-run `npm test` in app/ and functions/ and `npm run build` fresh, and independently falsify the key offline ACs (AC-1 totals sum, AC-3 keyword incl. ＃大筆 with fixed winning, AC-4 production-shaped H note byte-identical) rather than restating build's claims
  Fresh: functions 365/365, app 259/259, `rm -rf out .next lib` then app + functions builds exit 0 (app built with staging env). This agent's own mutations, run in a throwaway `git archive` copy so the branch bytes stayed unchanged:
  - AC-4: column placed at row-1 width instead of the widest row → `071 AC-4 production-shaped … H note byte-identical` and `later rename keeps the fixed cell` go red, plus 2 older blank-H guards.
  - AC-3: `＃大筆` dropped → AC-1, AC-3 and AC-6 go red. Keyword checked before category → AC-1 and AC-3 go red. Note equality instead of contains → AC-1, AC-3, AC-5 and AC-6 go red.
  - AC-1: unresolvable category kept out of Living → AC-1 goes red.
  - Every mutation was reverted and the baseline is green again. In the copy, functions test 68 (gitignore/tree-clean) fails on baseline too, because the copy has no git repo. That is environment-only.
- FAILED: Deploy the branch to staging (fresh build with staging env, hosting and functions as separate deploys), confirm deployed chunk hashes match the build, and verify AC-10..AC-13 against live staging as far as the agent can (API/served code), including that the staging Categories tab gains only a `fixed` column after one switch
  - First attempt: `firebase deploy --only functions --project staging` ended with "Upload Error: Failed to make request to storage.googleapis.com", before any function was updated.
  - Retry: denied by the auto-mode classifier as "[Production Deploy]" (the target was `--project staging`). Per the denial, this agent did not retry or route around it.
  - Hosting held back on purpose. A new Settings switch on the old backend gets a 200 but nothing is written (spec spike), so the frontend must not ship alone.
  - Live evidence that staging is unchanged: `/reports.html` sha256 is `0d729169…`, which is 070's build, not this build's `d8ff61cf…`. `GET /api/categories` returns 401 (auth gate up).
  - Built and ready in the worktree: `app/out` (index `b62472f0…`, reports `d8ff61cf…`; chunk `0v1x4cb_yvd37.js` carries `reports.cost_groups`) and `functions/lib`.
  - Pre-deploy snapshot of the staging Reports page and its 13 chunks, for the AC-12 Monthly before/after comparison: `scratchpad/pre/`.
- DONE: Write plain-language phone steps for the captain covering AC-10 (three totals sum to year total after tagging one expense #大筆), AC-11 (flip Groceries on/off), AC-12 (Monthly unchanged) and AC-13 (donut/bar toggle unchanged)
  Steps are below. They only apply after the staging deploy lands.
- DONE: Mandatory PII / secrets check
  No `.env*` file in the diff. A scan of added lines for keys, PEM, password/secret/token, emails, URLs and phone numbers found 0 hits. The env files copied for the build were deleted, the `manifest.json` that the staging prebuild rewrote was restored, and `git status` is clean.

### Summary

Offline, the branch holds up: suites and builds are green, and each key AC goes red under this agent's own targeted break. Staging was not deployed. The first upload failed at Google Storage, and the retry was blocked by the permission classifier, which labeled a staging deploy as production. To unblock, the captain allows `firebase deploy --only functions --project staging` and `--only hosting --project staging` from this worktree (or runs them). Then verify re-runs the live half: hash match, AC-11 sheet header check, and the steps below.

### Phone steps for the captain (after the staging deploy)

1. Open https://expense-sheet-staging.web.app (orange "Staging" banner) and sign in.
2. AC-12 first: tap **Reports** → **Monthly**. It should look like before: total, Donut/Bar, chart, category list, by payer, comparison, insights. No Fixed/Big extras/Living block.
3. AC-10: open any non-fixed expense (e.g. Travel or Eating Out) in History, add ` #大筆` to its note, save. Go to **Reports** → **Annual** (2026). Pass: Fixed + Big extras + Living costs add up to the year total to the dollar, and the tagged expense is listed under Big extras.
4. AC-13: on Annual, tap **Bar** then **Donut**. The category chart switches. The new group donut (3 colours) stays the same both times.
5. AC-11: **Settings** → **Categories** → **Groceries** → switch **Fixed cost** on → save. Back on Annual, Groceries is under Fixed. Switch it off again → Groceries is back under Living costs.

## Stage Report: verify (live, after captain's staging deploy)

verdict: PASSED pending the captain's phone check. Offline ACs were re-verified and falsified (above). Staging serves exactly this build. The on-screen ACs (AC-10, AC-11) and the backend's live `fixed` write are left to the captain, because the agent cannot sign in. That is the same Google sign-in wall as 063, 069 and 070.

- DONE: Re-run `npm test` in app/ and functions/ and `npm run build` fresh, and independently falsify the key offline ACs (AC-1 totals sum, AC-3 keyword incl. ＃大筆 with fixed winning, AC-4 production-shaped H note byte-identical) rather than restating build's claims
  Unchanged from the report above. The deployed `app/out` is that same fresh build.
- DONE: Deploy the branch to staging (fresh build with staging env, hosting and functions as separate deploys), confirm deployed chunk hashes match the build, and verify AC-10..AC-13 against live staging as far as the agent can (API/served code), including that the staging Categories tab gains only a `fixed` column after one switch
  - Deploy was run by the captain, as two separate commands. Functions: `api` and `subscriptionScheduler` both reported "Successful update operation". Hosting: 140 files.
  - Hash match, local vs live sha256: `index.html` `b62472f0…`, `reports.html` `d8ff61cf…` and `settings/categories.html` `e306dbb3…` match on both sides, and all 14 JS chunks those pages load are byte-identical (0 mismatches). Live `Last-Modified` is Fri, 02 Oct 2026 10:08:51 GMT. Before the deploy, staging served `0d729169…` (070's build).
  - API: live `GET` and `PATCH /api/categories/cat_001` return `401 {"error":"unauthorized"}`. The new function is up and the sign-in check still works. `firebase functions:list --project staging` shows `api` and `subscriptionScheduler` on nodejs20. Whether the live API returns and saves `fixed` could not be checked without a signed-in token, so the captain's AC-11 step covers it.
  - AC-12, from live served code: in the Reports chunk, the Monthly labels (`title → total_spending → donut/bar → by_category → by_payer → comparison`) match the 070 chunk captured before the deploy, label for label. The new block's component (`xz`) is not referenced anywhere in the Monthly section.
  - AC-13 and AC-5, from live served code: in the Annual section of live chunk `0v1x4cb_yvd37.js`, the order is `annual_total → monthly_trend → donut/bar`, then `xz` (the cost-group block, shown when expense_count > 0), then the unchanged `by_category` list. `xz` sits outside the donut/bar switch, so the group donut does not change when you switch Donut/Bar.
  - The Settings chunk `050x56cwm4k5w.js` carries the new `fixed_label` switch.
  - Not observed by the agent: the on-screen totals (AC-10), the Groceries flip and the staging sheet header (AC-11). The agent has no sign-in, and reading the sheet needs the gitignored creds, which the classifier had blocked in spec. These are left to the captain's steps below; for AC-11's sheet part, the captain looks at the staging Categories tab after step 5.
- DONE: Write plain-language phone steps for the captain covering AC-10 (three totals sum to year total after tagging one expense #大筆), AC-11 (flip Groceries on/off), AC-12 (Monthly unchanged) and AC-13 (donut/bar toggle unchanged)
  See "Phone steps for the captain" in the report above; staging is now live for them. Extra for AC-11: after step 5, open the staging Google Sheet → Categories tab. A new `fixed` header should appear right after the last used column, and every other column should be unchanged.
- DONE: Mandatory PII / secrets check
  Unchanged from the report above. The env files are confirmed gone from the worktree, and `git status` is clean.

### Summary

Staging runs exactly this branch: every page and chunk checked is byte-identical to the local build. In the live code, Monthly is unchanged and the new block sits between the donut/bar chart and By category, independent of the toggle. Offline ACs hold under targeted breaks. What remains is for the captain on the phone: the totals adding up (AC-10), the Groceries flip, including that the live API saves `fixed` (AC-11), and the sheet gaining only a `fixed` column.
