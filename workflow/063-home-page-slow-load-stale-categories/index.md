---
id: 063
title: Home Page Slow Load and Stale Categories Before Adding an Expense
status: build
source: captain
started: 2026-09-07T12:45:42Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-063-home-page-slow-load-stale-categories
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:063:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:063-ideation-1
              briefing:
                id: briefing:063:ideation:attempt-1:revision-1
                digest: sha256:375845444224572a7e5b9d0b951eab6970fbb1a84244a57d048d6ec0c2a57a06
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:063:ideation:1
                briefing: briefing:063:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-07T12:44:06.892043Z"
                decision: approve
                reason: Seed clearly captures the observed slow-load/auto-refresh/stale-categories problem with concrete user stories and open questions; ready for spec to investigate root cause.
              application:
                target-stage: spec
                state: consumed
        - id: gate:063:spec
          stage: spec
          attempts:
            - id: gate-attempt:063-spec-1
              briefing:
                id: briefing:063:spec:attempt-1:revision-1
                digest: sha256:91feba8e97b726c06a6e975536c867740d44cec31dfe7a918e3d1623f69937cb
                room-ref: ./review/spec/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:063:spec:1
                briefing: briefing:063:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-09-07T13:51:27.0862Z"
                decision: approve
                reason: Approved the free fixes (client-side category caching, memoized backend auth client); keeping minInstances/always-warm out of scope for now to see how the free improvements perform first.
              application:
                target-stage: build
                state: consumed
---

When I open the production expense-sheet web app, the home page keeps loading something and the "save" button is grayed out. Then it refreshes the page on its own, and sometimes the categories shown on the home page change after that refresh. Only after that can I actually add an expense record.

Why do I need to wait? What is it loading, and what is it refreshing for?

## User Stories

- As a user, I want the home page ready to accept an expense the moment it opens, so I do not wait through a load-then-auto-refresh cycle every time I want to log a spend.
- As a user, I want the "save" button to only be grayed out when there is a real reason (e.g. no category selected), not while something invisible is still loading.
- As a user, I want the categories on the home page to be correct on first paint, not change out from under me after an unexplained refresh.

## Success

- Understand why the "save" button is grayed out on open and what condition clears it.
- Understand what triggers the automatic page refresh, and why categories can differ before vs. after it.
- Either the wait goes away, or — if something must load first — it is fast and legible (a visible loading state) rather than a silent stall ending in a self-refresh.

### Out of Scope

- Redesigning the home page beyond fixing this load/refresh behavior.
- Any change to how categories are defined or migrated — this is about what's DISPLAYED, not the category data itself.

## Plan

To be filled in at spec time. Open questions:

- What is the home page actually waiting on before enabling "save" — auth, a categories fetch, a scheduler check, something else?
- What causes the auto-refresh — a client-side reload, a service-worker update, a stale-cache recovery, something else?
- Why would categories shown differ before vs. after the refresh — is the first paint reading a stale/cached category list that the refresh corrects?
- Is this reproducible on demand, or intermittent? Does it depend on network conditions, time since last visit, or browser cache state?

---

## Investigation (2026-09-07)

Traced against `main` directly — no reload/refresh mechanism exists in the code, so the four questions resolve to "there is no literal page reload; here is the re-render sequence the captain is reading as one."

### Q1 — What is Save actually waiting on

`app/app/page.tsx:262-263`: the Save button is `disabled={submitting || !categoriesReady}`. `categoriesReady` starts `false` and flips to `true` only inside `loadCategories()`'s success path (`page.tsx:67-81`), which is a single `GET /api/categories` call. Not auth (AuthGuard already blocks Home from mounting at all until Firebase auth resolves — `app/app/components/AuthGuard.tsx:7-13` — so by the time Home exists, auth is already done) and not the scheduler (`scheduler-status` is never fetched from Home). This gating is deliberate, added in entity 058 (`8eb5a9a`) specifically so Save cannot submit while `categoryId` is still a `DEFAULT_CATEGORIES` placeholder slug — confirmed correct behavior, not a bug.

### Q2 — What causes the "auto-refresh"

Nothing does, literally — `grep -rn "reload\|window.location\|router.refresh" app/app` (excluding node_modules) returns no hits outside an unrelated comment, and the production build (`output: "export"`, no service worker registered anywhere in `app/public` or `app/app`) ships none of Next.js's HMR/reload machinery — that code (`node_modules/next/dist/client/dev/**`, `page-bootstrap.js`) is dev-only. The App Router's one production `window.location.reload()` (`node_modules/next/dist/client/components/app-router.js`) only fires on a `popstate` whose history entry wasn't pushed by the App Router itself (a back/forward edge case), not on a normal load.

What the captain is calling "it refreshes on its own" is two back-to-back full-content swaps that are already part of the component tree, both legible-loading-state work from entity 058/AuthGuard, not new behavior:
1. `AuthGuard` renders a full-screen spinner while `loading` is true, then swaps wholesale to the real page in one paint the instant Firebase auth resolves (`authContext.tsx:61`).
2. Home itself renders `DEFAULT_CATEGORIES` tiles + a "categories loading" caption + a disabled Save button, then swaps wholesale to the live tiles + enabled Save the instant `getCategories()` resolves (`page.tsx:78`).

Both are whole-screen, layout-shifting swaps rather than an in-place shimmer confined to one element, so to a non-technical eye they read the same as a browser reload — especially when the wait is long enough to register as a distinct "before" and "after" (see Q4).

### Q3 — Why categories differ before vs. after

Confirmed exactly as the ideation suspected, but the "stale" source is not a browser cache — it's a hardcoded constant. `page.tsx:36` seeds `categories` state with `DEFAULT_CATEGORIES`, a 24-entry list frozen into the JS bundle at build time (`app/app/lib/categories.ts:87-112`), purely so the grid is never blank on first paint. Once `getCategories()` resolves, that state is replaced wholesale with the live, Sheet-backed active list (`page.tsx:71-73`). `CategoryPicker` keys each tile by `cat.id` (`CategoryPicker.tsx:29`), and the two lists use disjoint id schemes — `DEFAULT_CATEGORIES` uses slugs (`eating-out`), the live list uses `cat_NNN` — so literally none of the initial tiles survive the swap; the whole grid unmounts and remounts with a different set, count, order, and icon set. This happens on *every* load, unconditionally; whether the captain notices ("sometimes") depends on how long the pre-swap grid stays on screen before it flips (see Q4) and on how far the household's actual categories (managed in Settings → Categories, which the git history — entities 042–054 — shows has seen renames, archives, and reorders) have drifted from the 24 built-in defaults.

### Q4 — Reproducible on demand, or intermittent

Reproducible by mechanism, variable by timing:
- **Always refetches, never cached client-side.** Every mount of `/` re-runs both mount effects (`getTodayExpenses()` and `loadCategories()`) with no localStorage/memoized layer in front of either — confirmed by reading `categoryService.ts` (a bare `fetch` wrapper) and `categories.ts` (only `LAST_CATEGORY_KEY`, a single id, is ever cached — no category *list* is). This refires on first load, on a hard refresh, and on navigating back to `/` after Next 16's built-in Router Cache entry for the static `/` segment has expired (default ~5 minutes, unconfigured in `next.config.ts`).
- **Speed varies with Cloud Functions instance state, not network conditions.** `GET /api/categories` is served by the single `api` Cloud Function (`functions/src/index.ts:267`) with no `minInstances` configured anywhere in the repo (confirmed by grep), so the instance is free to scale to zero between uses. A cold start pays Node process boot plus `require()` of `googleapis` (^171) + `firebase-admin` (^13) + `@anthropic-ai/sdk` — `googleapis` in particular is a well-documented multi-second cold-start cost for Cloud Functions/Cloud Run because of its size. On top of that, `getSheetsClient()` (`index.ts:46-51`) calls `google.auth.getClient()` fresh on *every* request, cold or warm — never memoized at module scope — adding a redundant token-mint round trip even to an already-warm instance. A household app used a handful of times a day will cold-start often; that variance, not the browser or the network, is why the wait is "sometimes" long and "sometimes" fine.

---

## Spec

### Goal

Make the home page's first paint show the same categories the live Sheet would return whenever this device has loaded successfully before, and remove the backend's redundant per-request auth work, so opening the app to log an expense stops being a wait followed by a jarring full-grid category swap — without weakening entity 058's guarantee that Save never submits a placeholder category id.

### User Stories

- As a user, I want the categories I see the instant the home page opens to already be my real, current categories — not a generic built-in set that then visibly swaps out — so nothing changes out from under me while I'm picking one.
- As a user, I want Save to enable as soon as a real category is selected, without an avoidable multi-second wait caused by backend overhead that has nothing to do with my data.
- As a user, on a device where the app has never loaded before, I still want a non-blank category grid immediately and a Save button that is correctly (and legibly) disabled — not silently stalled — until a real category list arrives.

### Edge Cases

- Genuinely first-ever load on a device (no local cache of any category list yet): grid must still render non-blank from `DEFAULT_CATEGORIES`, and Save must stay disabled with the existing "loading" / "unavailable + retry" messaging (058) until the live fetch resolves.
- Categories were renamed, archived, or reordered in Settings since this device's last successful fetch: first paint may show the since-changed cached snapshot for a moment — that swap is legitimate (the data really changed) and is not what this entity is fixing; the picker must still update once the fresh fetch resolves, same as today.
- The categories fetch fails outright (offline, API error, cold-start timeout): existing `categoriesFailed` degraded state and manual retry (058) is preserved unchanged — not something this entity relaxes or removes.
- `localStorage` is unavailable or throws (private browsing with storage blocked, quota exceeded): reading or writing the new category-list cache must fail closed to today's `DEFAULT_CATEGORIES`-first-paint behavior, never throw and break the page.
- Two devices/users with different cached snapshots (e.g. one device cached before a category was archived): each device self-heals independently on its own next successful fetch; no cross-device sync is introduced or required.
- Cold vs. warm Cloud Functions instance: the wait duration still varies, but it must be shorter on a warm instance than today (redundant auth-client creation removed), and the loading state must stay legible regardless of duration.

### Out of Scope

- Configuring `minInstances` (or any always-warm Cloud Functions setting) to eliminate cold starts outright — a standing-cost/product decision for the captain, not a mechanical fix, and not decided here.
- Replacing the `googleapis` SDK with a lighter direct REST call to cut cold-start weight further — a larger, separate change with its own risk profile.
- Any change to how categories are defined, migrated, or managed in Settings → Categories — this is about what Home displays and when, not the category data itself (unchanged from the ideation's own scope).
- Any redesign of the home page layout beyond the load/refresh sequence (unchanged from the ideation's own scope).
- The offline/no-network first-open experience beyond what already exists — still `DEFAULT_CATEGORIES` + disabled Save + visible retry, per entity 058.

## Acceptance criteria

**Save enables at the right time**

**AC-1 — Save stays disabled while `categoriesReady` is false or while a `DEFAULT_CATEGORIES` slug is selected, and enables only once a live `cat_NNN` id is selected; this holds regardless of whether the grid was first painted from the cache (AC-2) or from `DEFAULT_CATEGORIES` (AC-3).**
Verified by: offline — an integration test mounting Home with a mocked `getCategories()` response, asserting the Save button's `disabled` attribute is `true` until the mock resolves and the selected id is a live one. Falsified by: any code path (cached-first-paint or fallback-first-paint) that lets `handleConfirm` fire, or the Save button appear enabled, while `categoryId` still matches a `DEFAULT_CATEGORIES` entry.

**AC-2 — On a device with a previously-cached live category list, the very first render of the category grid shows that cached list (not `DEFAULT_CATEGORIES`), before the network request resolves.**
Verified by: offline — a test that seeds the new cache with a live list distinct from `DEFAULT_CATEGORIES`, mounts Home with `getCategories()` left unresolved, and asserts the initial render's tiles match the cached list. Falsified by: the initial render showing `DEFAULT_CATEGORIES` tiles despite a valid cache being present.

**AC-3 — On a device with no cache yet (first-ever load, or cache cleared), the grid still renders non-blank from `DEFAULT_CATEGORIES` on first paint, exactly as today.**
Verified by: offline — a test with the new cache key absent/cleared, asserting the initial render is `DEFAULT_CATEGORIES`. Falsified by: a blank grid, a thrown error, or Save incorrectly enabling before the live fetch resolves.

**AC-4 — After every successful `getCategories()` fetch, the device's cache is overwritten with that response, so a category rename/archive/reorder is reflected on this device's next load — not stuck on a first-ever snapshot forever.**
Verified by: offline — a test that mounts Home twice with two different mocked live responses (simulating a Settings change in between) and asserts the second mount's first paint matches the second response, not the first. Falsified by: the cache never updating after its initial write.

**AC-5 — When the cached list already equals the live response (the common no-change case), no full unmount/remount of the category grid is observable — the tile set painted at mount time is unchanged after the fetch resolves.**
Verified by: offline — a test asserting the DOM nodes (or their keys) for each tile are the same before and after `getCategories()` resolves when the mocked response equals the seeded cache. Falsified by: every tile remounting (new DOM nodes) even though the underlying category data did not change.

**AC-6 — `localStorage` being unavailable or throwing on read/write of the new cache degrades to today's `DEFAULT_CATEGORIES`-first-paint behavior without throwing an unhandled error.**
Verified by: offline — a test that stubs the cache read/write to throw and asserts Home still mounts and renders `DEFAULT_CATEGORIES`. Falsified by: an unhandled exception or blank page when storage access throws.

**Backend wait time**

**AC-7 — A warm `api` Cloud Functions instance reuses one authenticated Sheets client across requests instead of minting a new one per request.**
Verified by: offline — a unit test around the sheets-client accessor asserting a second call within the same process does not invoke `google.auth.getClient()` again. Falsified by: `google.auth.getClient()` being called once per request in the test.

**AC-8 — On a warm instance, `GET /api/categories`'s server-side handling time (auth-client acquisition + the one Sheets read) is measurably lower than before this change, and unchanged on a cold instance (this entity does not claim to fix cold starts).**
Verified by: interactive — a live timing comparison against staging before/after deploy, warm-instance requests back to back. Falsified by: no measurable improvement on a warm instance, or a regression on a cold one.

**Perceived wait and swap, end to end**

**AC-9 — Opening the app on a device with a prior successful visit no longer shows a visible full-grid category swap during normal (warm-instance) use — the captain sees one stable set of tiles from open to Save.**
Verified by: interactive — captain or live drive opens the deployed app normally (not after a long idle period) and confirms the category grid does not visibly change between first paint and Save becoming available. Falsified by: the tile set visibly changing during a normal-latency open.

## Risk evidence

The riskiest unverified mechanism is cold-start timing itself: caching the Sheets/auth client at module scope (AC-7) provably removes one redundant token-mint round trip on a warm instance, but it cannot be proven offline to move the needle on a genuinely cold instance, where Node process boot and `require("googleapis")` dominate — that's why AC-8's cold-instance claim is deliberately "unchanged, not worse" rather than "faster," and why AC-9 is scoped to normal (warm) use rather than every possible open. No spike is needed for the client-side caching mechanism (AC-2 through AC-6): it reuses the exact `localStorage`-backed pattern entity 058 already shipped and proved for `LAST_CATEGORY_KEY` (`app/test/last-category.test.js`), just for a list instead of a single id.

## Expected surface and tolerance

Estimate: +100 net LOC across 4-5 files (`app/app/page.tsx`, `app/app/lib/categories.ts`, `functions/src/index.ts`, plus new/updated tests in `app/test/` and `functions/test/`), tolerance ±30%.
Semantics this may change: a new `localStorage` key holding the last-fetched live category list (additive; existing `expense_last_category_id` key is untouched). No API request/response shape changes. No change to scheduled behavior or auth.

## Test plan

Offline: unit/integration tests for the new category-list cache (seed/read/overwrite/throw-safe) mirroring `app/test/last-category.test.js`'s pattern, a Home-mount test asserting first-paint source (cache vs. `DEFAULT_CATEGORIES`) and Save's disabled state, and a `functions/test/` unit test asserting the Sheets/auth client is memoized across calls. Interactive: one staging deploy, timed warm-instance request comparison (AC-8), and a live drive of a normal app open confirming no visible category swap (AC-9) — both need a live environment, not new automation.

## Stage Report: spec

- DONE: Investigate the actual frontend code to answer the ideation's four open questions
  `## Investigation (2026-09-07)` section, index.md:70-98 — each question answered with file:line citations (page.tsx, AuthGuard.tsx, categories.ts, CategoryPicker.tsx, functions/src/index.ts) rather than speculation; confirmed via grep that no reload/navigation call exists in the app.
- DONE: Write `## Spec` (Goal, User Stories, Edge Cases, Out of Scope) per the Spec Template, reflecting the actual root cause
  index.md:100-128 — Goal and Out of Scope target the two confirmed mechanisms (hardcoded first-paint fallback, redundant per-request Sheets-auth mint), not the ideation's original open questions.
- DONE: Write a top-level `## Acceptance criteria` section (sibling of `## Spec`) with offline/interactive + falsified-by clauses covering both save-timing and first-paint category correctness
  index.md:129-163 — AC-1/AC-3/AC-6 cover Save-enables-correctly regression guards; AC-2/AC-4/AC-5 cover first-paint category correctness; AC-7/AC-8 cover backend wait time; AC-9 is the end-to-end interactive check.

### Summary

Read `app/app/page.tsx`, `AuthGuard.tsx`, `authContext.tsx`, `categories.ts`, `categoryService.ts`, `CategoryPicker.tsx`, and `functions/src/index.ts`/`auth.ts`, plus git history on `page.tsx` (entity 058, `8eb5a9a`), to find that there is no literal page reload anywhere in the code — the "auto-refresh" is two already-existing full-screen re-render swaps (AuthGuard's spinner, then Home's `categoriesReady` gate), and the category mismatch is `DEFAULT_CATEGORIES` (a hardcoded 24-item fallback) being unconditionally replaced by the live Sheet-backed list on every load. The chosen fix caches the last successfully-fetched live category list client-side (same `localStorage` pattern as entity 058's `LAST_CATEGORY_KEY`) so a returning device's first paint already matches the live list, and memoizes the backend's Sheets/auth client so a warm Cloud Functions instance stops re-minting an OAuth token per request; cold-start elimination itself (`minInstances`, replacing `googleapis`) is explicitly out of scope as a cost/product decision for the captain.

## Implementation Plan

**Client-side category-list cache** (`app/app/lib/categories.ts`, `app/app/page.tsx`):

- Add `LAST_CATEGORIES_KEY = "expense_last_categories"` (plural, sibling of the existing singular `LAST_CATEGORY_KEY`) plus two new functions, both wrapped in `try/catch` so a throwing/unavailable `localStorage` fails closed instead of crashing the page (AC-6):
  - `getCachedCategories(): Category[] | null` — reads and `JSON.parse`s the key; returns `null` on anything not a non-empty array, on a parse error, or on a thrown access (SSR guard included, matching the existing helpers).
  - `saveCachedCategories(categories: Category[]): void` — `JSON.stringify`s and writes the key; swallows a thrown write.
- `page.tsx`: seed the `categories` state from `getCachedCategories() ?? DEFAULT_CATEGORIES` instead of always `DEFAULT_CATEGORIES` (AC-2/AC-3). Inside `loadCategories()`'s existing success branch (after the `active.length === 0` guard, so a degraded fetch never overwrites a good cache), call `saveCachedCategories(active)` right after `setCategories(active)` (AC-4).
- No change to `categoriesReady`, `handleConfirm`, or the Save `disabled` expression — AC-1's guarantee (Save gated on a live id, never a `DEFAULT_CATEGORIES` slug) already falls out of the existing `categoriesReady` gate regardless of what the grid's first paint sources from, so this is a regression test, not a code change.
- AC-5 (no remount when cache equals the live response) is expected to already hold given `CategoryPicker` keys tiles by `cat.id` (`CategoryPicker.tsx:29`) — React reconciles same-key children in place across a state update rather than remounting, independent of array-reference identity. Verified by a test asserting DOM node identity, not assumed.

**Backend auth-client memoization** (`functions/src/index.ts`):

- Replace the per-call `getSheetsClient()` body with a module-scope memoized promise: first call kicks off `google.auth.getClient(...).then(auth => google.sheets(...))` and caches the promise; every subsequent call on the same warm instance returns the cached promise without a new `getClient()` call (AC-7). Both existing call sites (`api`'s request handler, `subscriptionScheduler`) are unchanged — they already just `await getSheetsClient()`.
- On rejection, clear the cached promise before rethrowing, so one transient auth failure doesn't permanently wedge a warm instance — not a spec'd AC, but necessary so the memoization itself can't turn a transient error into a standing outage.

**Tests:**

- `app/test/category-list-cache.test.js` — pure-function offline unit tests for `getCachedCategories`/`saveCachedCategories` (seed/read/overwrite/throw-safe), mirroring `last-category.test.js`.
- `app/test/category-cache.render.test.js` — Home-mount render tests for AC-1 through AC-6, using the existing `test/helpers/dom.js` harness's `deferCategories`/`releaseCategories` gate to observe the pre-fetch-resolution first paint.
- `functions/test/sheetsClient.api.test.js` — unit test for AC-7 asserting a second request against the same loaded `api` handler does not call `google.auth.getClient()` again.
- AC-8 and AC-9 stay interactive per the spec (staging timing comparison and a live drive); not self-checked in this stage.

## Stage Report: build

- DONE: Write a brief implementation plan before coding begins, covering the client-side category-list cache design and the backend auth-client memoization.
  `## Implementation Plan` section above, written and committed (bd57570) before any source file was touched.
- DONE: Implement per spec — client-side category-list cache, unchanged Save-gating, memoized backend auth client, meeting all 9 acceptance criteria.
  `app/app/lib/categories.ts` (+`LAST_CATEGORIES_KEY`/`getCachedCategories`/`saveCachedCategories`), `app/app/page.tsx` (seeds `categories` state from cache, writes cache on every successful fetch, `categoriesReady`/`disabled` logic untouched), `functions/src/index.ts` (`getSheetsClient` memoized to a module-scope promise, cleared on rejection) — commit 0f3d2a6.
- DONE: Document every acceptance criterion's status with evidence, including offline test results for AC-1-7; AC-8/AC-9 left interactive.
  AC-1 MET — `category-cache.render.test.js`: "Save stays disabled until the live fetch resolves, even when the grid painted from a cache." Falsified by any path letting `handleConfirm`/Save fire before `categoriesReady`; the gating expression itself (`page.tsx`) was not touched, only regression-tested.
  AC-2 MET — same file: "a device with a cached live list paints that list first, before the fetch resolves"; `category-list-cache.test.js`: "a saved list comes back verbatim." Falsified by DEFAULT_CATEGORIES rendering despite a valid cache.
  AC-3 MET — "a device with no cache still paints DEFAULT_CATEGORIES first, exactly as today"; unit test "nothing cached yields null." Falsified by a blank grid or thrown error with no cache present.
  AC-4 MET — "the cache is overwritten after every successful fetch, not just the first" (two mounts, second live response distinct from first, cache inspected after each); unit test "saving again overwrites the previous list." Falsified by the cache staying on the first-ever snapshot.
  AC-5 MET — "when the fetch resolves to the same list already cached, no tile remounts" — asserts the same DOM node (`===`) for two tiles before and after the fetch resolves, relying on `CategoryPicker`'s existing `key={cat.id}`. Falsified by new DOM nodes appearing for unchanged categories.
  AC-6 MET — render test stubs only the new `LAST_CATEGORIES_KEY` to throw on `getItem`/`setItem` (leaving entity 058's `LAST_CATEGORY_KEY` working, so the failure is isolated to the new mechanism); asserts first paint still shows `DEFAULT_CATEGORIES` and Save still enables once the fetch resolves. Two matching throw-safe unit tests in `category-list-cache.test.js`. Falsified by an unhandled exception or blank page.
  AC-7 MET — `functions/test/sheetsClient.api.test.js`, two tests asserting `google.auth.getClient()` is called exactly once across two (and across three, cross-endpoint) requests against one loaded `api` handler. Falsifiability verified directly: temporarily reverting the memoization (`git stash` on `index.ts`, rebuild) made both tests fail with 2 calls instead of 1, then passed again after restoring — not a tautological test.
  AC-8 NOT SELF-CHECKED — interactive per spec (staging warm-instance timing comparison); deferred to the interactive/verify stage.
  AC-9 NOT SELF-CHECKED — interactive per spec (live drive of a normal app open); deferred to the interactive/verify stage.

### Summary

Added a `getCachedCategories`/`saveCachedCategories` pair in `categories.ts` mirroring entity 058's `LAST_CATEGORY_KEY` pattern, wired `page.tsx` to seed first paint from that cache and refresh it on every successful fetch, and memoized `functions/src/index.ts`'s `getSheetsClient()` to a module-scope promise (clearing on rejection so a transient auth failure can't wedge a warm instance). No change was needed to Save's `disabled` gate — it already depended only on `categoriesReady`, which still only flips after a live fetch resolves, so AC-1 is a regression test rather than a code change. Full suites pass: `app` 211/211 (`npm test`), `functions` 303/303 (`npm test`); AC-7's tests were additionally confirmed non-tautological by reverting the fix and watching them fail. AC-8/AC-9 need a staging deploy and are left for the interactive verify stage.
