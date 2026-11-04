---
title: Keep the backend awake so Home, Report and History open without a 4-second wait
status: verify
source: captain (report "prod is slower now", 2026-11-04)
id: 081
gates:
    version: 1
    records:
        - id: gate:081:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:081-ideation-1
              briefing:
                id: briefing:081:ideation:attempt-1:revision-1
                digest: sha256:57f3097ad9f94583da80b1d80988e35b5b48c80ba152148eb5948cd8c4bb876d
                room-ref: '@review/ideation/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:081:ideation:1
                briefing: briefing:081:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-11-04T06:15:14.554613Z"
                decision: approve
                reason: 'Captain approved in the review pane with no notes: accepts keeping one backend instance always running.'
              application:
                target-stage: spec
                state: consumed
        - id: gate:081:spec
          stage: spec
          attempts:
            - id: gate-attempt:081-spec-1
              briefing:
                id: briefing:081:spec:attempt-1:revision-1
                digest: sha256:a76af3ea05b6eaf5f0dbdc132eced194a64d7dbadd69171aac8afb522a2f9106
                room-ref: '@review/spec/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:081:spec:1
                briefing: briefing:081:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-11-04T06:46:19.064799Z"
                decision: revise
                reason: 'Captain asked in the pane (on Q1 cost): ''can you propose other way that is no cost?'' Rejects the paid always-on direction for now; wants a zero-cost approach proposed.'
            - id: gate-attempt:081-spec-2
              briefing:
                id: briefing:081:spec:attempt-2:revision-1
                digest: sha256:8b51dfdeb37a7637ef6d922b329d9735136038330b127938e03a2a02b320a9f6
                room-ref: '@review/spec/briefing-2'
              resolution:
                type: Resolution
                id: resolution:spacedock:081:spec:2
                briefing: briefing:081:spec:attempt-2:revision-1
                by: person:captain
                at: "2026-11-04T07:44:52.556357Z"
                decision: approve
                reason: 'Captain chose option 1 in chat (''option 1'': approve and build), superseding the pane''s revise whose note read ''1 and 2 are good. Don''t do #3, #4''. Build A (Home Save from cached live categories) + B (slim @googleapis/sheets). Options 3 (keep-warm ping) and 4 (paid minInstances) are excluded.'
              application:
                target-stage: build
                state: consumed
started: 2026-11-04T06:15:22Z
worktree: .worktrees/spacedock-ensign-081-backend-always-awake
---

## Question for the captain

**Which way should we fix the slow first open?** Options are listed with the recommended one first.

1. **Recommended, free: let Home save right away and make the backend start faster.**
   - Home's Save works as soon as the app opens, using the category list your phone saved last time.
   - The backend also loads a much smaller Google Sheets add-on, so it wakes up faster. Report and History will still be a little slow if you open them first after a break, but less than today (estimate: about 2-3 seconds instead of about 4; measured on staging before you decide to ship).
2. **Free, smaller: only let Home save right away.** Website change only. Report and History stay as slow as today when opened first after a break.
3. **Almost free, unreliable: a timer pings the backend every few minutes to keep it awake.** Probably stays inside Google's free allowance, but that isn't guaranteed: it could cost a few cents a month, and Google can still put the backend to sleep between pings.
4. **Paid, for comparison: keep one backend copy always running.** About USD $8 a month (about TWD 260) per project, against your USD $32 production kill switch. Every page is fast after a break.

- Answer:

## User Stories

- As the captain, I want Home's Save button to turn on quickly when I open the app, so that I can log an expense right away.
- As the captain, I want Report and History to show quickly, even after the app sat unused for a while.

## Success

- The production backend keeps one copy always running, so the first visit after a break no longer waits for the backend to wake up.
- A first request after a long idle period answers in about the same time as a normal one (roughly 0.5 seconds from Taiwan, not 4 seconds).
- The monthly cost of the always-running copy is stated before it ships.

### Out of Scope

- Moving the backend to Taiwan (asia-east1); that is a separate, bigger change.
- Making the backend start faster (loading heavy code only when needed); possible follow-up.
- Any change to what the website shows.

## Plan

Diagnosis (2026-11-04, first officer, read-only):

- Four back-to-back requests to production `/api/categories`: first 4.2s, then about 0.45s each. The 4.2s is the backend waking up (a "cold start").
- Home enables Save only after `/api/categories` returns (`app/app/page.tsx`, `categoriesReady`); Report and History also wait on the same backend (`api` function).
- 079 and 080 deployed the website only; the backend was not redeployed, so they are not the cause.
- The backend is `functions/src/index.ts` `export const api = onRequest({ secrets: [anthropicKey] }, ...)`, region us-central1, no minimum instances set.

Direction (option 1, captain-chosen): set a minimum of one running instance on the `api` function, then deploy the backend. Spec states the exact setting, the expected monthly cost, how to confirm it on staging, and the production backend deploy, which is the captain's command to run.

## Spec

### Goal

Remove the ~4-second wait on the first app open after a break at no cost: Home's Save works immediately from this device's last-known category list, and the backend wakes faster by loading a small Sheets library instead of the whole Google API bundle.

### Options compared (read-only research, 2026-11-04)

| Option | Cost | Home Save after a break | Report / History opened first after a break | Deploy |
| --- | --- | --- | --- | --- |
| A. Home saves from cached list | USD 0 | Instant (returning device) | Unchanged (~4 s) | Website |
| B. Slim Sheets library | USD 0 | Faster (est. 2-3 s) | Faster (est. 2-3 s) | Backend |
| **A + B (recommended)** | USD 0 | Instant | Faster (est. 2-3 s) | Both |
| C. Keep-warm ping every 5 min | ~USD 0, not guaranteed | Usually instant | Usually ~0.5 s | Backend |
| D. `minInstances: 1` (paid) | ~USD 8/month per project | Instant | ~0.5 s | Backend |

- **A, website-side cache.** Home already paints from `getCachedCategories()` (entity 063) but keeps Save off until `GET /api/categories` returns (`app/app/page.tsx:47`, `:318`). The gate exists to block writing a placeholder slug (058). A cached list is a list of live `cat_NNN` ids from an earlier successful fetch, and the backend checks every write against the live sheet (`functions/test/categoryValidation.api.test.js` 058 AC-9..AC-13: an unknown id is rejected with 400 and nothing is written; an archived id is accepted). So Save can turn on from a cache whose ids are all live-shaped without risking a bad write. This reverses 063's AC-1 ("Save stays disabled until the live fetch resolves, even when painted from a cache", `app/test/category-cache.render.test.js:67`), which needs the captain's sign-off; 058's actual guarantee (no slug ever posted) stays. Report and History show expense data, not just categories; caching all expenses across sessions on the device is a bigger change (stale totals, data on a shared device), so A leaves them alone. Once Home has opened, the backend is awake and Report and History are fast in that session already.
- **B, faster cold start.** Measured locally with Node 24: `require("googleapis")` takes 450-915 ms (194 MB package), `require("@googleapis/sheets")` 53-56 ms (v14.0.0, installed in the scratchpad only), `@anthropic-ai/sdk` 34 ms, `firebase-functions/v2/https` 145 ms. The whole `functions/lib/index.js` load is ~540 ms locally, with `googleapis` the bulk. Cloud Run's 1 vCPU and cold disk are slower than a laptop, so the real saving is estimated at 1-2 s of the ~4 s; verify measures it on staging. Lazy-loading the Anthropic SDK saves ~34 ms, not worth it. The backend only uses `google.auth.getClient` and `google.sheets` (`functions/src/index.ts:57-69`, `functions/src/scheduler.ts:27`), both available from `@googleapis/sheets`.
- **C, keep-warm ping.** A scheduled function calling the `api` URL every 5 minutes. Cloud Scheduler gives 3 free jobs per billing account; `subscriptionScheduler` already uses one on production and one on staging, so a production ping would be the 3rd (free only if both projects share one billing account, which I could not check read-only; a 4th job is USD 0.10/month). That's 8,640 runs a month: within the 2 million free requests, and each run's compute (the ping function's own cold start plus `api`'s answer, roughly 1-3 vCPU-seconds) totals about 9,000-26,000 vCPU-s, within the 180,000 free vCPU-s if the rest of the app stays small. The extra function image adds Artifact Registry storage that may go over the 0.5 GB free amount (cents). Google doesn't promise to keep an idle instance alive for any set time, so even a 5-minute ping can miss. **Not truly zero cost and not guaranteed.**
- **D, paid comparison.** `minInstances: 1` on `api` only: about USD 8.2/month per project at 256 MiB / 1 vCPU (Firebase "Manage functions" doc quotes ~USD 8 for this exact config). The full cost working is in the first spec version (commit da3ce7c).

### Chosen approach (A + B)

- **A:** in `app/app/page.tsx`, when `getCachedCategories()` returns a list whose ids are all `cat_NNN`, start with Save enabled: reconcile `categoryId` against the cached expense categories with `pickCategoryId`, the same call the live path uses. The live fetch still runs in the background, overwrites the list and cache, and re-reconciles: a selected id that is still in the live list stays selected. With no cache, or a cache that holds any non-`cat_NNN` id, keep today's behaviour (Save off with "loading" until live).
- **B:** in `functions/`, replace `googleapis` with `@googleapis/sheets` in `src/index.ts` and `src/scheduler.ts` (`import { sheets, auth } from "@googleapis/sheets"`; `new auth.GoogleAuth({ scopes }).getClient()`). Update the test stubs that patch `require.cache` for `"googleapis"` (`test/sheetsStub.js:224`, `test/sheetsClient.api.test.js:17`). One-off scripts under `functions/scripts/` still use `googleapis`; move it to `devDependencies` so scripts keep working and the deployed backend doesn't load it.

### User Stories

- As the captain, I want Home's Save button to work as soon as I open the app, so that I can log an expense right away.
- As the captain, I want Report and History to open faster after the app sat unused, at no extra cost.
- As the captain, I want any mistake to show as a visible error, never a silently wrong category, even when Home saved from a remembered list.

### Edge Cases

- **First open on a new device (no cache):** Save stays off with "loading" until the live list arrives, exactly as today.
- **A category deleted since the cache was saved, and the captain saves with it:** the backend rejects it with 400, nothing is written, and Home shows its existing error. The live list replaces the cache within seconds anyway.
- **A category archived since the cache:** the backend accepts it (058 AC-11); the expense is filed under the category the captain tapped. The live refresh then drops it from the picker.
- **Old cache holding a slug:** treated as no cache; Save waits for live (058's guarantee stays).
- **Saving while the backend is still cold:** the save request waits for the remaining wake-up. The categories fetch starts the wake-up when the page opens, so by the time an amount is typed most of the wait has passed; with B it's shorter.
- **Offline:** Save is enabled from the cache, the POST fails, and Home shows the existing save error; nothing is written. Same outcome as tapping Save offline today after a live load.
- **Two people at once:** unchanged; each phone uses its own cache, and the backend validates each write.
- **Report or History opened first after a break:** still waits for the backend to wake up, shorter with B. Not instant without option C or D.

### Out of Scope

- Keep-warm pings (C) and `minInstances` (D), unless the captain picks them.
- Caching expenses, reports or history data on the device across sessions.
- Moving the backend to Taiwan (asia-east1).
- Changing memory, CPU or concurrency.
- Changing one-off scripts in `functions/scripts/` beyond keeping them runnable.

## Acceptance criteria

**AC-1 — With a cached list of live ids, Save is enabled before the live fetch resolves, and a live id is selected.**
Verified by: offline — a Home-mount test (rewrite of `category-cache.render.test.js` AC-1) with a `cat_NNN` cache and a deferred categories fetch asserts the Save button is not disabled and one tile is selected before the fetch resolves. Falsified by: keeping Save tied to the live fetch only.

**AC-2 — With no cache, or a cache containing any non-`cat_NNN` id, Save stays disabled with the loading message until the live fetch resolves.**
Verified by: offline — Home-mount tests for both cases assert `disabled` and the `categories_loading` status line before the fetch resolves. Falsified by: enabling Save from `DEFAULT_CATEGORIES` or from a slug cache.

**AC-3 — Saving from the cache before the live fetch resolves posts a `cat_NNN` id that was in the cache, and never a slug.**
Verified by: offline — Home-mount test types an amount and taps Save with the fetch still pending; asserts the POST body's `category_id` matches `/^cat_\d+$/` and is in the cached list. 058's existing tests in `legacy-category-writes.render.test.js` still pass. Falsified by: a reconciliation that leaves `getDefaultCategory()`'s slug selected.

**AC-4 — When the live list arrives, a still-present selected category stays selected; a vanished one is replaced by a live id.**
Verified by: offline — Home-mount test: the captain picks cached id X, then live resolves (a) with X, (b) without X; asserts the selection stays X in (a) and is a live id in (b). Falsified by: resetting the selection on every live refresh.

**AC-5 — The deployed backend no longer loads `googleapis`.**
Verified by: offline — a `functions/test/` test requires the built `lib/index.js` and asserts no `require.cache` key contains `/node_modules/googleapis/`, and `functions/package.json` lists `googleapis` only under `devDependencies`. Today `lib/index.js` loads it. Falsified by: any `src/` file importing `"googleapis"`.

**AC-6 — The existing backend test suite still passes with the slim library.**
Verified by: offline — `npm --prefix functions test` passes, with the stubs re-pointed to `@googleapis/sheets`. Falsified by: an API difference between the two packages that the routes depend on.

**AC-7 — The first request to staging after idle is faster than the baseline.**
Verified by: offline (live measurement) — after at least 30 minutes with no traffic, `curl -s -o /dev/null -w "%{http_code} %{time_total}\n" https://expense-sheet-staging.web.app/api/categories` returns 401 (no login needed; the 401 still wakes the backend) in under 3.0 s, taking the median of 3 separate idle trials. Baseline today: 4.68 s first, 0.45 s warm. Falsified by: the slim library not cutting startup time (the result stays around 4 s).

**AC-8 — On staging, Home's Save works immediately after a break on a device that has opened the app before.**
Verified by: interactive — a live drive (verify agent) and then the captain open staging Home after 30+ minutes away; Save is usable within about a second, and an expense saves into the right category. Falsified by: the familiar ~4 s greyed-out Save.

**AC-9 — On production after the captain's deploys, the same holds.**
Verified by: interactive (captain) plus the AC-7 curl against `https://expense-sheet-b2db8.web.app/api/categories` (baseline: 4.2 s; this spec measured 1.2 s and 3.7 s). Falsified by: either still showing the old wait.

## Risk evidence

Riskiest mechanisms: (1) that saving from a cache can't write a bad category, and (2) that dropping `googleapis` actually shortens startup. Exercised read-only, nothing deployed:

- (1) The backend checks every write's `category_id` against the live sheet per request (`functions/test/categoryValidation.api.test.js`, 058 AC-9..AC-13): absent ids get 400 with no row written; archived ids are accepted. The cache is written only from a successful live fetch (`app/app/page.tsx:84`). The only thing standing in the way is 063's deliberate AC-1 test, which this spec rewrites with the captain's approval.
- (2) Local load times (Node 24, 3 runs): `googleapis` 450-915 ms vs `@googleapis/sheets` 53-56 ms. Whole `lib/index.js` ~540 ms. The Cloud Run saving is an estimate until verify measures AC-7.
- Current config on both projects (`firebase functions:list`): `api` 256 MiB, 1 vCPU, concurrency 80, us-central1, no minInstances. Both deploy the same `functions/` source; only gitignored `.env` values differ.
- Read-only timing (401): staging 4.68 s cold then 0.45 s; production 1.2 s, 3.7 s, 0.47 s.
- C's free-tier fit depends on whether production and staging share a billing account; `gcloud` is blocked in this sandbox, so this is unconfirmed.

## Expected surface and tolerance

Estimate: +90 net LOC across 8 files (excluding `functions/package-lock.json`, which is regenerated), tolerance ±50%.

- `app/app/page.tsx`: cached-ready initial state and reconciliation (+15 to +25).
- `app/app/lib/categories.ts`: a helper saying whether a cached list is all live ids (+8).
- `app/test/category-cache.render.test.js`: AC-1 rewritten; AC-2..AC-4 added (+50).
- `functions/src/index.ts`, `functions/src/scheduler.ts`: import swap (~±6).
- `functions/test/sheetsStub.js`, `functions/test/sheetsClient.api.test.js`: stub target swap (~±6).
- `functions/test/no-googleapis.test.js` (new): AC-5 (~15).
- `functions/package.json`: add `@googleapis/sheets`, move `googleapis` to devDependencies.

Semantics this may change: when Save is enabled on Home (earlier, from the cache), which reverses 063 AC-1. No API shape, stored data, auth or schedule change. Billing: none.

## Test plan

- Build: `npm --prefix app test` and `npm --prefix functions test` (new tests plus existing suites, including 058's write-guard tests).
- Verify: deploy both to staging (`firebase deploy --only functions,hosting --project staging`, with the website rebuilt fresh using `.env.staging`), then run 3 idle trials for AC-7 (30+ minutes apart) and the AC-8 live drive.
- Production, after merge, from the main checkout (the captain runs the backend deploy; backend before website):

      firebase deploy --only functions --project production
      firebase deploy --only hosting --project production

  Then AC-9.
- Cost: agent time plus about 90 minutes of idle waiting for the AC-7 trials. USD 0 in cloud charges.

### Feedback Cycles

- Cycle 1: spec revise (captain, 2026-11-04) on Q1 cost: "can you propose other way that is no cost?" Revise the spec to propose zero-cost approaches; keep the paid always-on option only as a comparison.

## Implementation plan (build)

- **A, `app/app/lib/categories.ts`:** add `isLiveCategoryList(list)`: true only for a non-empty list whose every id matches `/^cat_\d+$/`.
- **A, `app/app/page.tsx`:** read the cache once at mount. When it is a live list and reconciling `getDefaultCategory()` against its expense categories with `pickCategoryId` yields an id, start with that `categoryId`, its `business`, and `categoriesReady = true`. Otherwise keep today's start (slug seed, Save off, loading line). The live fetch is unchanged: it overwrites list and cache and re-reconciles with `pickCategoryId(current, ...)`, which keeps a still-present selection. Home mounts only after AuthGuard resolves on the client, so the cache read cannot cause a hydration mismatch.
- **A, tests (`app/test/category-cache.render.test.js`):** rewrite 063 AC-1 into 081 AC-1; add AC-2 (no cache, slug cache), AC-3 (POST from cache before live), AC-4 (live keeps X / replaces vanished X). Check each fails against the unchanged page.
- **B, `functions/src/index.ts`, `functions/src/scheduler.ts`:** `import { sheets, auth, sheets_v4 } from "@googleapis/sheets"`; client via `new auth.GoogleAuth({ scopes }).getClient()`; types `sheets_v4.Sheets`.
- **B, stubs:** `test/sheetsStub.js` and `test/sheetsClient.api.test.js` stub `@googleapis/sheets` (`{ auth: { GoogleAuth }, sheets }`). Script tests keep stubbing `googleapis` (scripts unchanged).
- **B, `functions/package.json`:** add `@googleapis/sheets` to dependencies, move `googleapis` to devDependencies.
- **B, AC-5 test (`functions/test/no-googleapis.test.js`):** load `lib/index.js` in a child process and assert no `/node_modules/googleapis/` module was loaded; assert package.json placement. Check it fails before the swap.

## Stage Report: spec

- DONE: Write the spec (Spec Template) in the entity body: goal, user stories, edge cases, out of scope, and a top-level ## Acceptance criteria section with each AC marked offline or interactive
  `## Spec` plus top-level `## Acceptance criteria` with AC-1..AC-5 offline, AC-6 interactive.
- DONE: State the exact setting (minimum instances on the api function in functions/src/index.ts) and confirm against Firebase Functions v2 docs how it is set, per function or globally
  `minInstances: 1` in the `api` onRequest options at `functions/src/index.ts:299`; per function (Firebase "Manage functions" doc, SDK 7.4.0 `options.d.ts:85`); global rejected because it would also wake `subscriptionScheduler`.
- DONE: State the expected monthly cost of one always-running instance at the api function's current memory/CPU, with the source of the price
  About USD 8.2/month per project (256 MiB, 1 vCPU, Tier 1 idle rates); Firebase doc quotes ~USD 8 for this exact config; Cloud Run pricing page numbers did not render live, flagged in the spec.
- DONE: Exercise the riskiest mechanism read-only: confirm the current api function config (memory, region, concurrency) and how staging vs production deploys differ; do not deploy anything
  `firebase functions:list` on both projects: identical 256 MiB / cpu 1 / concurrency 80 / us-central1 / no minInstances; only gitignored .env values differ; `api.__endpoint.minInstances` is null today. Nothing deployed.
- DONE: Name expected files and lines changed, with tolerance
  +25 LOC across `functions/src/index.ts` and a new `functions/test/minInstances.test.js`, ±50%.
- DONE: Propose proof for each AC, including a staging check (first request after idle time) and the production backend deploy as a command the captain runs
  AC-4 30-minute-idle curl on staging (baseline 4.68 s); captain runs `firebase deploy --only functions:api --project production`.
- DONE: Add a short plain-language question at the top for the captain if any decision is theirs (for example cost ceiling)
  Q1 cost ceiling (USD 8/month vs USD 32 kill switch); Q2 staging awake too (recommended) or production only.

### Summary

Spec sets `minInstances: 1` on the `api` function only, at about USD 8/month per project. Read-only checks confirmed staging and production run identical configs and that the setting can be checked offline from the built code. Two captain decisions sit at the top: the cost ceiling, and whether staging stays awake too (recommended, so the speed-up is proven on staging first). The Firebase CLI's cost confirmation prompt on deploy is called out for verify.

## Stage Report: spec (cycle 1)

- DONE: Write the spec (Spec Template) in the entity body: goal, user stories, edge cases, out of scope, and a top-level ## Acceptance criteria section with each AC marked offline or interactive
  Rewritten around A + B (zero cost): AC-1..AC-7 offline, AC-8..AC-9 interactive; `### Feedback Cycles` left in place.
- DONE: State the exact setting (minimum instances on the api function in functions/src/index.ts) and confirm against Firebase Functions v2 docs how it is set, per function or globally
  Kept as option D only: `minInstances: 1` per function in the `api` onRequest options (Firebase "Manage functions" doc). The recommended fix changes Home's Save gate and swaps `googleapis` for `@googleapis/sheets`.
- DONE: State the expected monthly cost of one always-running instance at the api function's current memory/CPU, with the source of the price
  D: ~USD 8.2/month per project (Firebase doc). A and B: USD 0. C: near zero but not guaranteed (3 free Scheduler jobs per billing account, 2 already used; image storage may cost cents).
- DONE: Exercise the riskiest mechanism read-only: confirm the current api function config (memory, region, concurrency) and how staging vs production deploys differ; do not deploy anything
  Backend rejects unknown category ids per request (058 AC-9..13), so saving from a cache is safe; local load timing: `googleapis` 450-915 ms vs `@googleapis/sheets` 53-56 ms (scratchpad install only). Nothing deployed.
- DONE: Name expected files and lines changed, with tolerance
  +90 LOC across 8 files (app page, categories lib, app test, functions src x2, stubs x2, new test, package.json), ±50%.
- DONE: Propose proof for each AC, including a staging check (first request after idle time) and the production backend deploy as a command the captain runs
  AC-7: median of 3 idle curls on staging under 3.0 s (baseline 4.68 s); the captain runs `firebase deploy --only functions --project production`, then hosting.
- DONE: Add a short plain-language question at the top for the captain if any decision is theirs (for example cost ceiling)
  One question: pick 1 (A + B, recommended), 2 (A only), 3 (ping, near-free), or 4 (paid minInstances, ~USD 8/month).

### Summary

Revised for the captain's "no cost" request. Recommended: Home turns Save on from the device's cached live category list (the backend already rejects bad ids), plus a slimmer Sheets library that cuts backend wake-up time. Both are free. Option A reverses 063's "Save waits for live" test, which the captain's answer approves. The keep-warm ping is called out as not truly free or reliable, and paid `minInstances` stays as the comparison.

## Stage Report: build

- DONE: Write a brief implementation plan in the entity before coding
  `## Implementation plan (build)`, commit 489ce00 (before any code commit).
- DONE: Implement A: Home enables Save from a cached all-cat_NNN category list, reconciles categoryId with pickCategoryId, live fetch refreshes in background and keeps a still-present selection (app/app/page.tsx, app/app/lib/categories.ts)
  Commit f84e691: `isLiveCategoryList` in categories.ts; Home's one-time initial state reads the cache, reconciles with `pickCategoryId`, sets `categoriesReady` only when the picked id is non-empty. Live fetch path unchanged. Home mounts only after AuthGuard resolves client-side, so no hydration mismatch.
- DONE: Implement B: replace googleapis with @googleapis/sheets in functions/src/index.ts and functions/src/scheduler.ts, re-point test stubs, move googleapis to devDependencies
  Commit 6d2d97c. Kept `auth.getClient({ scopes })` instead of the spec's `new auth.GoogleAuth(...)`: `auth` is the same `AuthPlus` object as `google.auth`, so the call is byte-for-byte today's. Local whole-backend load: ~135 ms (spec measured ~540 ms before).
- DONE: Add/rewrite tests for AC-1..AC-6 and confirm each new test fails when the feature is broken
  AC-1 (Save enabled, cached tile selected, no loading line pre-fetch): fails on unchanged page and when the cache path skips `pickCategoryId`.
  AC-2 (no cache / slug cache keep Save off with `categories_loading`): fail when the slug check is dropped (M1) or Save is ready without a cache (M4).
  AC-3 (POST pre-fetch carries a cached `cat_NNN`, no slug): fails on unchanged page and when reconciliation is skipped (M2).
  AC-4a (cached cat_502 still live stays selected): fails when the live refresh resets selection (M3). AC-4b (vanished cat_502 replaced, POST sends a live id): fails when the refresh keeps the old id.
  AC-5 (`functions/test/no-googleapis.test.js`: child process loads `lib/index.js`, no `node_modules/googleapis/` file in `require.cache`; package.json placement): both tests failed before the swap, pass after.
  AC-6 (existing backend suite on the slim library): stub re-pointed back to `googleapis` makes 23/24 categories API tests fail, so the stubs are load-bearing.
- DONE: Run cd app && npm test and npm --prefix functions test; both pass
  app 307/307; functions 379/379 (after final commit).
- DONE: Do not deploy to staging or production; verify owns AC-7..AC-9
  Nothing deployed; no firebase command run.
- DONE: Do not implement options 3 (keep-warm ping) or 4 (paid minInstances)
  No scheduler or `minInstances` change in the diff.
- DONE: Report each AC with evidence and actual LOC vs the +90 +/-50% estimate in the stage report
  AC-1..AC-6 above; AC-7..AC-9 left to verify. Net +119 LOC (+160/-41) across 10 files excluding package-lock.json and the entity: 132% of estimate, inside the 45-135 band. Extra files vs spec: a one-line comment in `functions/test/scheduler.test.js`.

### Summary

Home now turns Save on immediately from the device's cached category list when every cached id is a live `cat_NNN` id; no cache or a slug cache keeps today's wait. The backend loads `@googleapis/sheets` instead of the full `googleapis` bundle (local load ~540 ms to ~135 ms; the Cloud Run saving is verify's AC-7). `googleapis` stays as a devDependency for the one-off scripts, whose tests still stub it.
