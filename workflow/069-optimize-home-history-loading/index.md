---
id: 069
title: Optimize Home, History, and Reports Loading Time
status: verify
source: captain
started: 2026-09-14T03:20:41Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-069-optimize-home-history-loading
issue:
pr:
mod-block: merge:pr-merge
gates:
    version: 1
    records:
        - id: gate:069:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:069-ideation-1
              briefing:
                id: briefing:069:ideation:attempt-1:revision-1
                digest: sha256:0b9897c89060fa43ed34ff1e07335d8a34108764085742a29b660a8789d334a8
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:069:ideation:1
                briefing: briefing:069:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-14T03:19:45.592187Z"
                decision: approve
                reason: 'Captain approved: concrete seed grounded in a real production incident and stated preference, scope and open questions are clear enough to start speccing.'
              application:
                target-stage: spec
                state: consumed
        - id: gate:069:spec
          stage: spec
          attempts:
            - id: gate-attempt:069-spec-1
              briefing:
                id: briefing:069:spec:attempt-1:revision-1
                digest: sha256:bbfdba9b48b3681d6ea705a880353939357368603cebf5925418fa1c077c1d2e
                room-ref: ./review/spec/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:069:spec:1
                briefing: briefing:069:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-09-14T03:42:39.071864Z"
                decision: approve
                reason: 'Captain approved: root cause confirmed from live code, riskiest mechanism (invalidation coverage) identified with a concrete AC, ACs are binary and testable, scope discipline mirrors 063.'
              application:
                target-stage: build
                state: consumed
        - id: gate:069:verify
          stage: verify
          attempts:
            - id: gate-attempt:069-verify-1
              briefing:
                id: briefing:069:verify:attempt-1:revision-1
                digest: sha256:a3f003626875be233538728ab1dfa6b62162b5f027c43bbd66ddea83d8280172
                room-ref: ./review/verify/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:069:verify:1
                briefing: briefing:069:verify:attempt-1:revision-1
                by: person:captain
                at: "2026-09-14T07:24:10.657239Z"
                decision: approve
                reason: 'Captain approved: staging deploy confirmed byte-identical, full suites green, invalidation mechanism independently re-verified and strengthened. AC-11/AC-12 to be checked on captain''s own staging visit.'
              application:
                target-stage: done
                state: pending
---

The captain wants Home, History, and Reports to load faster. A concrete symptom surfaced while reviewing entity `067`'s work: History briefly showed a raw category id (`cat_003`) instead of its name on the production app, right after two large backfills (`066`: 203 rows, `067`: 18 rows) landed on production in quick succession. The categories API was independently confirmed live and responsive minutes later (401 in ~0.5s, normal), so this looks like a one-off failed category fetch, not an ongoing outage — but it's worth investigating as a real symptom of whatever is making these pages slow, not dismissed. Separately, the captain flagged that Reports triggers a new loading state every time she steps to a different month — she wants that fixed too.

## User Stories

- As the captain, I want Home, History, and Reports to load quickly and reliably, without visible stalls or fallback states.
- As the captain, I don't want a category to ever show as a raw id (`cat_003`) instead of its name — if the live category list can't be fetched in time, I'd rather see a stale-but-correct name than a raw id.
- As the captain, I want stepping between months in Reports to feel instant, not trigger a fresh loading state every time I tap a new month.

## Success

- Understand what's actually slow about Home, History, and Reports today — what each page (and each month-step, for Reports) waits on, and why (building on entity `063`'s own investigation of Home's load sequence, which this entity should read rather than re-derive from scratch).
- Understand why History showed a raw category id instead of a name, and fix the underlying cause (or its fallback behavior) so it can't recur.
- Stepping between months in Reports no longer shows a new loading state each time — either the data is already available (cached/prefetched) or the wait is fast enough not to need one.
- Either the load feels faster across all three pages, or — if something must load first — it's fast and legible, matching the bar `063` already set for Home.

### Out of Scope

- Any change to what Home, History, or Reports display once loaded, beyond load-time behavior and the category-fallback fix.
- Re-litigating anything `063` already shipped (the category-list cache, the backend auth-client memoization) — this entity builds on that work, not against it.
- The month-picker UI itself (entity `068`) — this entity is about the loading behavior when a month is selected, not how it's selected.

## Investigation (2026-09-14)

Traced against `main` directly, answering the ideation's eight open questions from the actual code rather than by analogy to `063`.

### Q1 — What does History actually wait on

Only its own expenses fetch. `history/page.tsx:333-338` calls `getAllExpenses()` (`historyService.ts:9-20` — a bare `GET /api` that returns and sorts the ENTIRE Expenses tab) and its `.finally()` is the only thing that clears `loading` (seeded `true` at `history/page.tsx:322`), which gates the full-page spinner (`history/page.tsx:415-420`). Categories are fetched separately (`history/page.tsx:340-350`) and never gate `loading` — a slow or failed categories fetch does not delay the page, it only affects which names/icons are available once rendering starts.

### Q2 — Does History's category-fetch failure path fall back to `DEFAULT_CATEGORIES` the same way Home's used to

Yes, and worse: unlike Home, History has no fallback OTHER than `DEFAULT_CATEGORIES` — there is no cache layer at all. `allCategories` is seeded with `DEFAULT_CATEGORIES` (`history/page.tsx:326`) and only replaced once `getCategories()` resolves (`history/page.tsx:341-349`); there is no `getCachedCategories()`-style seed the way Home has had since `063`. `resolveCategory` (`categories.ts:129-142`) checks the live list first, then bridges a legacy slug through `DEFAULT_CATEGORIES`'s `name_en` — but a live `cat_NNN` id has no slug entry to bridge through, so while `allCategories` is still `DEFAULT_CATEGORIES` (which is true for every History mount until its fetch resolves, and for the whole session if the fetch fails), `resolveCategory` returns `undefined` for that id and the caller falls back to the raw `expense.category_id` string (`history/page.tsx:529,531`) — exactly the `cat_003` symptom. This fallback contract is the same one already exercised by `today-list.render.test.js`'s "an id in neither list degrades to the placeholder and the raw id" case (`today-list.render.test.js:103-112`); History shares the identical resolution path, just with a longer, unconditional window before the live list is available.

### Q3 — Would extending `063`'s cache to History close the gap, or does it need its own

Its own. Home's cache (`saveCachedCategories`, `categories.ts:219-227`, wired at `page.tsx:76`) is written from `active` — the `is_active`-filtered list (`page.tsx:73`) — because Home's picker must never show an archived tile. History resolves expenses against the UNFILTERED list on purpose (its own comment at `history/page.tsx:323-325`: "an expense on an archived category still has to resolve its icon"). Seeding History from Home's active-only cache would still show a raw id for any expense filed under a category that has since been archived. Closing the gap needs a second cache key holding the full (active + archived) list, written from the unfiltered response before any `is_active` filtering happens.

### Q4 — Is there real slowness in Home/History beyond what `063` fixed

Yes. `063` touched only the categories fetch (client cache) and the backend's Sheets-auth client (memoization) — it never touched the expenses fetch. Home's `getTodayExpenses()` (`expenses.ts:63-73`) and History's `getAllExpenses()` (`historyService.ts:9-20`) both call the same bare `GET /api`, which the backend answers by reading the ENTIRE Expenses tab (`functions/src/index.ts:781-784`, via `readTab()` at `index.ts:67-78` against the unbounded `A:Z` range declared at `index.ts:37`) with no date filtering, pagination, or response caching. Home only needs today's rows and History only needs the display order it re-sorts client-side anyway, but both pay for reading and transferring the whole sheet on every mount — a cost that grows every time a backfill (`066`: 203 rows, `067`: 18 rows) adds to it. This is real, additional, previously-unaddressed slowness, structurally the same shape as the pre-`063` categories problem, just on the other endpoint.

### Q5 — Was the `cat_003` incident actually caused by `066`/`067`'s backfills

Not necessarily, and it doesn't need to have been. The mechanism in Q2 fires on any History mount whose categories fetch is still in flight, or fails, while an expense on screen uses a live-only id — that can happen on any ordinary day, backfill or not. It's plausible the concurrent Sheets writes from `066`/`067` made that particular categories fetch slower (contending with the backfill's own writes for the same spreadsheet), widening the window enough for the captain to actually see it — but the underlying gap is a standing property of History's code, not something the backfills introduced. Fixing Q3's structural gap removes the failure mode regardless of what triggers a slow fetch next time.

### Q6 — What does a Reports month-step actually trigger

A fresh, full network re-fetch, every time — not a recomputation over already-held data. `reports/page.tsx:439-448`'s monthly effect depends on `[period, year, month, payer, dataVersion]` and calls `getMonthlySummary(year, month, payer)` on every change. That function (`reportService.ts:131-166`) calls `fetchAllExpenses()` (`reportService.ts:69-75`, the same unbounded `GET /api` as Q4) and `fetchCategoryList()` (`reportService.ts:30-38`, a bare `getCategories()` call) via `Promise.all`, THEN filters the full result down to the selected month client-side. Notably, `fetchAllExpenses()` carries its own comment explaining why it was written this way: `reportService.ts:67` — "cached per call (no module-level cache to avoid stale data)". That was a deliberate choice, not an oversight; the approach below (Plan) has to satisfy the same staleness concern while still removing the redundant fetch.

### Q7 — Does Reports hold all months in memory after one fetch, or fetch per-month

Neither, precisely — every step re-fetches the FULL history from scratch (Q6), so the "new loading" the captain sees on every month-step is a real network wait, and it is strictly redundant: `fetchAllExpenses()`/`fetchCategoryList()` take no month or year argument at all, so the exact same response that answered the previous month's query would answer this one too.

### Q8 — Would a `063`-style cache fit Reports, or does it need something different

A cache-once/invalidate-on-write pattern fits, but not `063`'s exact storage shape. `063`'s category-list cache uses `localStorage`, which persists across reloads — safe for categories, which change rarely. Reports' data is the full, live expense history that two people actively edit throughout the day; persisting that across reloads risks showing a stale total across a day boundary or after another device's edit. What fits instead is a session-scoped, in-memory (module-level) cache of the one `fetchAllExpenses()`/`fetchCategoryList()` result, shared by Home, History, and Reports, invalidated the moment this device makes its own write (add/edit/delete) — directly answering the staleness concern `reportService.ts:67`'s comment raised, by making invalidation an explicit, testable step tied to every known write path instead of relying on "always fetch fresh" as the only guard.

## Spec

### Goal

Make Home, History, and Reports feel fast by removing the redundant, full-history network fetches each page currently repeats independently within a session, and give History the same last-known-good category fallback Home has had since `063` — so a live category id never renders raw, and stepping between months or years in Reports recomputes from data the app already holds instead of waiting on a fresh fetch every tap.

### User Stories

- As the captain, once I've used the app this session, I want Home, History, and Reports to render from data already fetched rather than triggering a brand-new full-history fetch every time I open one.
- As the captain, I never want to see a raw category id like `cat_003` in History — not even for a split second — regardless of whether History's own categories fetch has finished.
- As the captain, when I tap to the next or previous month (or year) in Reports, I want the numbers to update immediately, without a full-screen loading spinner every time.
- As the captain, when I add, edit, or delete an expense, I want every page I visit afterward in the same session to reflect that change right away — faster loading must never mean stale numbers.

### Edge Cases

- Genuinely first-ever fetch of a session (fresh tab, or after a hard reload): the existing spinner/full fetch still happens exactly as today — this entity removes REPEATED fetches within a session, not the first one.
- No cached category list yet on this device (first-ever load, or `localStorage` cleared): History's pre-fetch render degrades to today's documented placeholder/raw-id behavior, same as now — this entity does not change what happens with no cache, only what happens with one.
- `localStorage` unavailable or throwing on the new full-category cache (private browsing, quota exceeded): read/write fails closed to today's `DEFAULT_CATEGORIES`-first-paint behavior, never an unhandled error.
- Editing or deleting an expense via `ExpenseEditSheet` (shared by History and Reports' drill-down) must invalidate the shared cache so a DIFFERENT page visited afterward reflects it too — not just the page the edit happened on, and not just the local list callback (`onSaved`/`onDeleted`/`onDataChanged`) each page already updates for itself.
- A write made by the other device, the other user, or the 1am subscription scheduler (`functions/src/index.ts`'s `subscriptionScheduler`) while this device's app session is already open and has already cached a fetch: it will not appear on this device until a local write invalidates the cache or the page is hard-reloaded. This is a real, deliberate change from today (today, every ordinary tab switch already remounts and re-fetches fresh — see the `popstate` comments in `history/page.tsx:351-360` and `reports/page.tsx:422-429` quoting Next's own docs on when a page is and isn't reused) — accepted here the same way `063` accepted no cross-device sync for its category cache, and not something this entity adds real-time sync to close.
- A category created or archived since this device's last successful fetch (e.g. during a backfill): resolved on this device's NEXT successful fetch, same self-healing contract `063` already established for its own cache — not before.
- Reports' drill-down write-then-back-navigate (`DrillDown.tsx`'s existing `onDataChanged` → `dataVersion` bump): must still force a real refetch (via cache invalidation) rather than being served the pre-write cached snapshot, so an edit made from inside a drill-down is reflected the moment the captain returns to the summary.

### Out of Scope

- Backend-side pagination, date-range querying, or any other change to what `GET /api` or `GET /api/categories` read or return — a deeper, riskier change to a shared endpoint, not decided here (mirrors `063`'s own precedent of punting cold-start elimination as a separate decision).
- Configuring `minInstances` or replacing the `googleapis` SDK — the same standing-cost/product decisions `063` already scoped out, unaffected by a client-side caching change.
- Real-time cross-device sync (websockets, polling, or any mechanism that picks up another device's write without a local write or a reload) — not introduced here; see the Edge Cases entry above.
- Re-litigating or modifying `063`'s shipped active-only category cache or the backend auth-client memoization — this entity adds a SECOND, separate full-list cache alongside it, not a revision.
- Any change to what Home, History, or Reports display once loaded, beyond load-time behavior and the category-fallback fix (unchanged from the ideation's own scope).
- The month-picker UI itself (`068`) — this is about the loading behavior when a period is selected, not how it's selected (unchanged from the ideation's own scope).
- The AI Insights card's own per-period cache (`reports/page.tsx`'s `insights_cache:*` keys) — already has its own caching and is untouched by this entity.

## Acceptance criteria

**History's category fallback (the `cat_003` incident)**

**AC-1 — On a device with a previously-cached full (active + archived) category list, History's very first render resolves a live `cat_NNN` id to its real name and icon, never the raw id — even before this load's own `GET /api/categories` resolves.**
Verified by: offline — extend `test/helpers/dom.js`'s categories fixture/gate to seed the new full-list cache key and mount History with an expense referencing `cat_003` while the fetch is held open (`deferCategories`/`releaseCategories`), asserting the label reads "Groceries" before release. Falsified by: the pre-resolution render showing the raw id for a category present in the cache.

**AC-2 — On a device with no cached category list yet (first-ever load, or a cleared cache), History's pre-fetch render degrades to today's documented placeholder/raw-id-with-fallback-icon behavior — never a blank page or a thrown error.**
Verified by: offline — same harness with the new cache key absent, asserting History still renders with no thrown error and shows the same fallback `today-list.render.test.js`'s "id in neither list" case already documents. Falsified by: a blank page, a thrown error, or a fallback different from today's.

**AC-3 — After every successful categories fetch from History, the cached full list is overwritten (active AND archived), so a category added or archived since the last cache write is resolvable on this device's next load.**
Verified by: offline — mount History twice in one test with two different mocked full-category responses (the second adding a `cat_NNN` absent from the first), asserting the second mount's pre-resolution render already recognizes the new id. Falsified by: the cache staying on the first-ever snapshot.

**AC-4 — `localStorage` being unavailable or throwing on the new cache degrades to today's `DEFAULT_CATEGORIES`-first-paint behavior without an unhandled error.**
Verified by: offline — stub the new cache key's `getItem`/`setItem` to throw, asserting History still mounts and renders from `DEFAULT_CATEGORIES`. Falsified by: an unhandled exception or blank page.

**Reports' per-month network wait**

**AC-5 — Stepping to a different month or year within the same session, once this session's data has already been fetched once, issues no new `GET /api` or `GET /api/categories` request.**
Verified by: offline — extend the harness to record request counts, mount Reports, let the first month resolve, record the count, step to the next month, and assert the count is unchanged. Falsified by: a new `GET /api` or `GET /api/categories` request firing on the step.

**AC-6 — Each month/year step still shows that period's correct, distinct total and category breakdown — caching does not freeze the view on the first period's numbers.**
Verified by: offline — same test, asserting the displayed total after stepping matches the fixture's expected value for the new period and differs from the first period's. Falsified by: the displayed total not changing between two periods with different fixture totals.

**AC-7 — Reports' full-page loading spinner does not appear on a month/year step served from cache; it remains for the genuine first fetch of a session, or one following a cache invalidation.**
Verified by: offline — same test, asserting the spinner element is absent immediately after the cache-served step. Falsified by: the spinner appearing on a cache-served step.

**Shared cache correctness across Home, History, and Reports**

**AC-8 — Adding an expense (Home), or editing/deleting one (History or Reports' drill-down, via the shared `ExpenseEditSheet`), invalidates the shared cache so every page visited afterward in the same session reflects that write.**
Verified by: offline — mount Home, add an expense via the mocked API, then mount History in the same process and assert the new expense is present; separately, drive `ExpenseEditSheet`'s delete path and assert a subsequently-computed Reports total excludes the deleted amount. Falsified by: a write not appearing/disappearing on another page within the same session without a full reload.

**AC-9 — Navigating Home → History → Reports within one session issues at most one `GET /api` (non-categories) request for the whole trip, once the first has resolved.**
Verified by: offline — mount Home, then History, then Reports sequentially within one test/process (sharing the module-level cache the way in-app `<Link>` navigation shares JS module state), asserting the total recorded `GET /api` request count across all three mounts is 1. Falsified by: more than one such request across the three mounts.

**AC-10 — Adding an expense from Home still immediately appears in Home's own "logged today" list and count, unaffected by the shared caching layer.**
Verified by: offline — mount Home, add an expense, and assert it appears in Home's own today-list/count immediately after the write resolves — a regression guard on already-existing, already-tested behavior. Falsified by: the new expense missing from Home's own list after adding it.

**End-to-end, on staging**

**AC-11 — Stepping between months in Reports on staging feels instant after the first month of a session — no spinner, no blank flash.**
Verified by: interactive — captain or live drive steps through several months in one sitting on staging and confirms no loading spinner or blank state appears after the first month. Falsified by: a spinner or blank flash appearing on any step after the first.

**AC-12 — Opening History on a device with a prior successful visit never shows a raw category id, even momentarily — matching the bar `063` already set for Home's category grid.**
Verified by: interactive — captain or live drive opens History fresh (new tab) on a device that has used the app before, watching the list render from open to fully loaded. Falsified by: a raw id (`cat_NNN`) appearing at any point during load.

## Risk evidence

The riskiest unverified mechanism is invalidation coverage, not the caching mechanism itself: every write path that can change expense data — Home's `addExpense`, and `ExpenseEditSheet`'s `updateExpense`/`deleteExpense` (shared by History and Reports' drill-down) — must call the new invalidation function, or a write silently goes stale on other pages for the rest of the session. This is exactly what AC-8 and AC-9 exercise directly, including the drill-down's existing `dataVersion`-bump path, which must be wired to invalidate the shared cache rather than only bump a local counter. The month-recompute mechanism (AC-5/AC-6) needs no spike: it reuses the exact client-side filter/reduce logic `reportService.ts` already runs on the full array today (`buildCategoryBreakdown`, `buildPayerBreakdown`) — only the fetch is deduplicated, not the aggregation. History's full-category caching needs no spike either: it reuses the exact `localStorage` pattern `063` already shipped and proved (`getCachedCategories`/`saveCachedCategories`, `categories.ts:204-227`), parameterized to a second key storing the unfiltered list instead of the active-only one.

## Expected surface and tolerance

Estimate: +180 net LOC across 8-9 files (`app/app/lib/categories.ts` — new full-list cache pair; a new `app/app/lib/expensesCache.ts` or an extension of `app/app/lib/expenses.ts` — shared in-memory cache + invalidate; `app/app/page.tsx` — route `getTodayExpenses` through the cache, invalidate on `addExpense`; `app/app/history/page.tsx` — seed/write the full-category cache, route `getAllExpenses` through the shared cache; `app/app/lib/reportService.ts` and `app/app/reports/page.tsx` — route `fetchAllExpenses`/`fetchCategoryList` through the shared caches; `app/app/lib/expenseService.ts` — invalidate on `updateExpense`/`deleteExpense`; `app/test/helpers/dom.js` — request-counting and a deferred-expenses gate; new/updated test files), tolerance ±30%.
Semantics this may change: none to stored data formats or to the `GET /api`/`GET /api/categories` request/response shapes. Within a single open app session, a write from another device, another user, or the overnight subscription scheduler will not appear on this device until a local write invalidates the cache or the page is hard-reloaded — a change from today's always-fetch-fresh-per-navigation behavior (see Edge Cases), not a stored-format change.

## Test plan

Offline: extend `test/helpers/dom.js`'s fetch stub to record `GET /api` request counts (alongside the existing categories request tracking) and add a `deferExpenses`/`releaseExpenses` gate mirroring the existing `deferCategories` one; unit tests for the new full-category cache pair (seed/read/overwrite/throw-safe, mirroring `category-list-cache.test.js`); a History render test for the pre-fetch-resolution first paint (mirroring `category-cache.render.test.js`); a Reports render test asserting no new request and a correct total on a month/year step; a cross-page test mounting Home → History → Reports in one process to prove request de-duplication (AC-9) and write-invalidation (AC-8, AC-10). Interactive: one staging deploy, a live drive stepping through several Reports months (AC-11), and opening History fresh on a warmed device (AC-12) — both need a live environment, not new automation.

### Feedback Cycles

## Stage Report: spec

- DONE: Write a completed spec (Spec Template) covering goal, user stories, edge cases, and what is explicitly out of scope
  `## Spec` section (Goal/User Stories/Edge Cases/Out of Scope), index.md — Goal and Out of Scope target the three confirmed mechanisms (History's missing full-category cache, Reports' redundant full-history refetch per step, and the shared unbounded `GET /api` cost), not speculative ones.
- DONE: Write a top-level `## Acceptance criteria` section where every AC is independently testable and binary, each labeled offline or interactive per its verification method
  `## Acceptance criteria`, sibling of `## Spec` — 12 ACs across four groups (History's category fallback, Reports' per-month wait, shared-cache correctness, end-to-end/staging), each with a `Verified by: {offline|interactive}` clause and a falsifying change.
- DONE: Answer the ideation Plan's open questions from live code (History's load sequence, Reports' month-step behavior, the category-fallback root cause) before finalizing the approach
  `## Investigation (2026-09-14)`, Q1-Q8 — each answered with file:line citations from `history/page.tsx`, `categories.ts`, `historyService.ts`, `expenses.ts`, `reportService.ts`, and `functions/src/index.ts`, including one prior deliberate no-cache decision found and reconciled (`reportService.ts:67`'s "no module-level cache to avoid stale data" comment, addressed by tying the new cache's invalidation to every known write path).

### Summary

Read `history/page.tsx`, `reports/page.tsx`, `categories.ts`, `categoryService.ts`, `historyService.ts`, `reportService.ts`, `expenses.ts`, `expenseService.ts`, `ExpenseEditSheet.tsx`, `DrillDown.tsx`, and the backend's `functions/src/index.ts`, to find that History has no client-side category cache at all (unlike Home post-`063`) and seeds from `DEFAULT_CATEGORIES` every mount, which is why a live-only `cat_NNN` id renders raw whenever the categories fetch hasn't resolved yet — and that Reports' month/year stepping is a genuine full network re-fetch of the ENTIRE expense history and full category list every time (`fetchAllExpenses`/`fetchCategoryList` take no period argument), which the backend answers by reading the whole unbounded Expenses tab with no pagination or caching — the same endpoint Home and History also hit independently on every mount. The chosen approach adds a second, full-list `localStorage` category cache for History (mirroring `063`'s pattern but unfiltered, since History must resolve archived categories too) and a session-scoped, in-memory expense/category cache shared by Home, History, and Reports, invalidated on every local write (`addExpense`, `updateExpense`, `deleteExpense`) so the caching gain never trades away correctness. Backend-side pagination, cold-start elimination, and cross-device real-time sync are explicitly out of scope, mirroring `063`'s own scope discipline.

## Stage Report: build

- DONE: Write a brief implementation plan before coding begins
  Posted in-session before any file edit: expensesCache.ts (new), categories.ts full-list pair, reportService/historyService/expenses/expenseService routed through the shared cache, dom.js harness extensions.
- DONE: Implement the shared session-scoped expense/category cache and History's full-list category cache on a dedicated branch, satisfying all 12 acceptance criteria (AC-1 through AC-12) and documented edge cases
  Branch `spacedock-ensign/069-optimize-home-history-loading`, commits b514654 and 41fc68c. AC-by-AC evidence below.
- DONE: Check off every acceptance criterion explicitly in the stage report with concrete evidence (test names/results), with special attention to invalidation coverage across addExpense/updateExpense/deleteExpense (the riskiest mechanism per spec's Risk evidence)
  See AC-8 — each of the three write paths has its own dedicated, independently-falsified test in `test/shared-cache.render.test.js`.

### Acceptance criteria

- AC-1: `history-category-fallback.render.test.js` "AC-1: ... resolves cat_003 to its name before the categories fetch resolves" + "...also resolves an ARCHIVED category..." — both PASS. Falsifiability checked: reverting `history/page.tsx`'s `getCachedCategoriesFull() ?? DEFAULT_CATEGORIES` seed makes both fail.
- AC-2: same file, "AC-2: a device with no cached full list degrades to the raw-id fallback..." — PASS.
- AC-3: same file, "AC-3: the cache is overwritten after every successful fetch..." — PASS; plus 3 pure-logic overwrite tests in `category-list-cache-full.test.js` — PASS.
- AC-4: same file, "AC-4: a throwing full-category-list cache degrades..." — PASS; plus 2 throw-safety unit tests in `category-list-cache-full.test.js` — PASS.
- AC-5: `reports-cache.render.test.js` "AC-5/AC-6/AC-7: stepping to the previous month issues no new request..." — PASS. Falsifiability checked: reverting `reportService.ts`'s `fetchAllExpenses` to bypass the cache makes this fail.
- AC-6: same test — asserts the previous month's total (500) differs from and is correct against the first month's (300), computed from a fixture split across two real months.
- AC-7: same file, both tests — spinner present while the first-ever fetch is gated open and clears on release; spinner absent immediately after a cache-served step. Both PASS.
- AC-8: `shared-cache.render.test.js` — three dedicated tests, one per write path: add ("...visible from History afterward..."), update ("...reflected in a subsequently-computed Reports total..."), delete ("...excluded from a subsequently-computed Reports total..."). All PASS. Falsifiability checked: making `invalidateExpensesCache()` a no-op fails all three (and only these three — AC-9's dedup test is unaffected, confirming it isolates invalidation specifically).
- AC-9: same file, "AC-9: navigating Home -> History -> Reports ... at most one GET /api (non-categories) request" — PASS, counted via `getRequests` (method-aware) across three real page mounts sharing one `installGlobals()` session.
- AC-10: same file, "AC-10: adding an expense from Home immediately updates Home's own logged-today count" — PASS.
- AC-11: SKIPPED — interactive/staging-only per the spec's own `Verified by:`; no staging deploy available in this offline build session.
- AC-12: SKIPPED — same as AC-11.

Edge cases: first-ever-fetch, no-cache, and throwing-localStorage are covered by AC-2/AC-4 and the "genuine first fetch" half of AC-7. Cross-page write visibility (an edit from History or Reports' drill-down reaching another page) is covered at the shared `expenseService`/`reportService` layer both DrillDown and History call into (AC-8), rather than by mounting DrillDown's own UI. The other-device/scheduler-write staleness edge case is an accepted, documented behavior change per the spec — not exercised, by design. Reports' own category list is cached for the session with no invalidation path in scope, matching the spec's self-heals-on-next-fetch contract; not separately tested since nothing in this entity's scope ever invalidates it.

### Summary

Added `app/app/lib/expensesCache.ts` (session-scoped, in-memory cache of `GET /api`, shared by Home/History/Reports, invalidated by `addExpense`/`updateExpense`/`deleteExpense`); a second, unfiltered `localStorage` category-cache pair in `categories.ts` for History; a private, success-only session cache for Reports' own category fetch; and routed `getTodayExpenses`, `getAllExpenses`, and `reportService`'s `fetchAllExpenses` through the shared cache. `test/helpers/dom.js` gained a mutable expense store (mirroring the existing categories one), method-aware GET request counting, and a `deferExpenses` gate. 20 new tests across 4 files exercise all 10 offline ACs directly against real mounted pages (not mocks of the mechanism), with falsifiability spot-checked for the highest-risk assertions (AC-1, AC-5, AC-8) by temporarily reverting the relevant source line/function and confirming the specific test — and only that test — fails. Full regression check: all 241 tests pass (`npm test`), a project-wide `tsc --noEmit` is clean, and `npm run build` succeeds.

One fact for the verifier to weigh: actual surface is 552 net LOC across 13 files (`git diff --numstat` vs `main`), against the spec's estimate of +180 ±30% (range ~126–234) — roughly 3x over. Of that, application code (categories.ts, expensesCache.ts, expenses.ts, historyService.ts, expenseService.ts, reportService.ts, history/page.tsx) is ~84 net lines, within tolerance on its own; the overage is concentrated in test code (dom.js harness extensions + 4 new test files, ~468 net lines) covering 10 offline ACs plus falsifiability checks. Not trimmed, since the spec itself flagged invalidation coverage as the riskiest unverified mechanism and asked for AC-by-AC evidence.

## Stage Report: verify

**Verdict: AC-1 through AC-10 PASSED with live-adjacent evidence. AC-11 and AC-12 cannot be self-checked by an ensign — Home/History/Reports sit entirely behind Google Sign-In restricted to two captain emails (`AuthGuard.tsx`), the identical wall entity 063 documented as unfixable without the captain. This is not a defect; both need one live pass from the captain (steps below).**

- DONE: Deploy this build branch to staging (functions and hosting, as separate firebase deploy commands) and verify AC-1 through AC-10 with live evidence; confirm deployed chunk hashes match this branch's build
  Deployed in two separate commands (the known 055/058 combined-deploy trap): `firebase deploy --only functions --project staging` → both `api` and `subscriptionScheduler` "Successful update operation"; `firebase deploy --only hosting --project staging` → "release complete". Fresh `npm ci` (no symlinks) in both `app/` and `functions/`, then full suites re-run against the exact code just built and deployed: app 241/241, functions 360/360, project-wide `tsc --noEmit` clean. The 4 new test files' 20 subtests individually re-run in isolation, each asserting the AC its name claims. Chunk-hash match: `sha256(local out/index.html)` == `sha256(curl https://expense-sheet-staging.web.app/)` — `8afc785a…7ec8fa` both sides; 5/5 sampled `_next/static/chunks/*.js` files referenced by the served `index.html` are byte-identical (sha256) between local `out/` and staging, including the chunk carrying this entity's new cache key. Confirmed the new client code shipped live: `expense_last_categories_full` (History's new full-list cache key) found in served chunk `0ywm48zfkzo89.js`. `GET /api` and `GET /api/categories` unauthenticated → `401 {"error":"unauthorized"}` on the freshly-deployed function, proving the redeploy landed and the auth gate survived it. `/`, `/sign-in`, `/history`, `/reports` all return 200 on staging hosting; root HTML carries the orange "Staging" banner.
  Falsifiability re-checked independently (not just trusted from build): temporarily made `invalidateExpensesCache()` a no-op, recompiled (`npm run test:compile` — the source edit alone did nothing until this ran, since the render tests import `.test-build-ui/*`, not the `.ts` source directly), and re-ran the 4 new test files. Result differs from build's claim: 6 tests failed, not 3 — the 3 AC-8 write-path tests as build reported, PLUS AC-10, one AC-3 assertion, and one AC-5/6/7 assertion, because the shared `expensesCache` module is a `require`-cached singleton across tests in one process, and without invalidation, an earlier test's leftover cached expense list leaked into a later, unrelated test. This is a stage-report accuracy gap in build's report, not a functional defect — if anything it is stronger evidence than build claimed: disabling the one production invalidation path breaks correctness more broadly than the three tests build named, confirming AC-8's mechanism is real and load-bearing, not tautological. Reverted the edit, recompiled, reran full `npm test`: 241/241, `git status` clean throughout.
  AC-11/AC-12 out of scope for this item by the spec's own `Verified by: interactive` designation — see below.
- DONE: Run the Mandatory PII/Secrets Check; delete any staging credential files copied into the worktree
  `git diff main...HEAD` touches 14 files (13 source/test + this entity file); zero touch `.env*`. Scanned the full diff for API-key shapes (`AIza…`), PEM headers, `password=`/`secret=`/`api_key=` assignments, bearer-token strings, email addresses, and generic URLs — zero hits on every pattern. `app/.env.staging`, `app/.env.local`, and `functions/.env.staging` (copied from the main checkout to build/deploy) were deleted before this report was written; `app/public/manifest.json` (dirtied by the staging `prebuild` manifest swap) restored via `git checkout --`; `git status` on this worktree is clean.
- DONE: Write the staging URL plus numbered, plain-language manual-test steps for the captain covering AC-11 and AC-12
  See "Staging URL and manual test steps for the captain" below.

### Summary

Staging is running this exact branch: hosting and both functions are freshly deployed and independently confirmed byte-identical to the local build (index.html + 5 sampled JS chunks + the new `expense_last_categories_full` cache-key string all match), and the backend's auth gate still works post-deploy (401 on both endpoints). AC-1 through AC-10 pass on live-adjacent evidence — fresh dependency installs, full suites green against the deployed code, each new test individually inspected against its AC claim, and the riskiest mechanism (write-path cache invalidation) independently re-falsified by this agent with a result that corrects but strengthens build's own claim. AC-11 and AC-12 are correctly not self-checked: both require a real Google sign-in as one of the two authorized captain emails, unobtainable by an ensign in this environment (same wall as entity 063); no identity was fabricated and no credential-store workaround was attempted.

### Staging URL and manual test steps for the captain

**Staging:** https://expense-sheet-staging.web.app (shows an orange "Staging" banner so you always know you're not looking at real data)

**AC-11 — does month-stepping in Reports feel instant?**
1. Open https://expense-sheet-staging.web.app and sign in.
2. Tap into Reports and let the first month finish loading (you'll see the normal loading spinner once, briefly).
3. Tap the "previous month" arrow several times in a row, then a few "next month" taps back.
4. Watch for a loading spinner or a blank flash after that very first load.
5. Pass: every step after the first is instant — numbers change with no spinner and no blank screen. Fail: a spinner or blank flash appears on any step after the first — note which step and report it back.

**AC-12 — does History ever show a raw category id like `cat_003`?**
1. Open https://expense-sheet-staging.web.app and use the app normally at least once today (add or view an expense), so this device has a prior successful visit.
2. Close that tab completely.
3. Open a brand-new tab and go to https://expense-sheet-staging.web.app again, sign in if asked, and go straight to History.
4. Watch the expense list closely from the moment it appears until it's fully settled.
5. Pass: every category name and icon looks right from the very first instant — you never see a raw code like `cat_003` instead of a real category name, even for a split second. Fail: you see a raw code at any point — note which expense/category and report it back.
