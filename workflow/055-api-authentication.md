---
id: 055
title: Add Real Authentication/Authorization to the API
status: verify
source: captain
started:
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-055-api-authentication
issue:
pr:
---

The API (`functions/src/index.ts`, the `api` Cloud Function) has no authentication or authorization check anywhere — confirmed by grep (zero `Authorization`/`verifyIdToken`/token-check references) and confirmed live: every endpoint (expenses, subscriptions, categories, insights) answers a plain unauthenticated request with real household financial data, on both staging and production. This isn't just read exposure — GET, PATCH, POST, and DELETE all work with no credential, which this session's own testing relied on directly (calling PATCH/POST/DELETE against production without ever presenting a token).

The client side has a matching gap. `app/app/lib/auth.ts` declares `AUTHORIZED_EMAILS_STUB` and `isAuthorizedEmail()`, with its own comment recording the original intent: *"In production, this check happens server-side via Firebase Function — [this client stub is] deferred to integration phase."* That server-side check was never built, and `isAuthorizedEmail` itself has zero callers anywhere in the app — it's dead code that unconditionally returns `true`, found while working entity 052 (moving hardcoded emails to env vars).

Both gaps are the same root cause: authorization was always intended to live server-side, and it doesn't exist there or anywhere else.

## User Stories

- As the captain, I want the API to only answer requests from you and Wei, so a stranger with the URL (public repo, guessable Firebase hosting pattern) cannot read or change your household's financial data.
- As the captain, I want a signed-in user who isn't you or Wei to be turned away, not silently let through, so Google Sign-In actually means something.

## Success

- Every API endpoint rejects a request with no valid credential.
- Every API endpoint rejects a request from a signed-in Google account that isn't one of the two authorized emails.
- The two of you continue to use the app exactly as today — this is enforcement, not a new sign-in flow.
- `isAuthorizedEmail`/`AUTHORIZED_EMAILS_STUB` either becomes the real check or is removed — no dead code pretending to be a security boundary.

### Out of Scope

- Any new sign-in UI or flow — Google Sign-In already exists on the frontend; this is about the backend actually checking it.
- Multi-user/role support beyond the existing two-user model.
- Rate limiting, abuse prevention, or anything beyond "is this one of the two authorized people."

## Plan

Verify the Firebase ID token (already available client-side from `getFirebaseAuth()`/`onAuthStateChanged`) on every API request, matching the two authorized emails already in env vars from entity 052 (`NEXT_PUBLIC_USER1_EMAIL`/`NEXT_PUBLIC_USER2_EMAIL` — note these are `NEXT_PUBLIC_`, client-inlined; the server-side check needs its own non-public env vars or the same values read server-side, a design decision for spec). Spec should also decide what happens to the now-provably-dead `isAuthorizedEmail` client stub — wire it to a real check for fast client-side UX (reject before even calling the API) backed by the server-side enforcement as the actual boundary, or delete it as redundant once the server enforces this properly.

## Spec

### Goal

Make the `api` Cloud Function verify a Firebase ID token on every request and answer only for the two authorized household emails, closing a production API that today serves and accepts household financial data from anyone holding the URL.

### Current State — traced 2026-08-26

Every AC below rests on these findings. Each was verified against the code, not assumed.

| Question | Finding |
|---|---|
| Does the frontend send a token today? | **No.** Zero `Authorization` occurrences in `app/app`, `functions/src`, `app/test`, or `functions/test`. All 16 `fetch` call sites send `Content-Type` only. **The frontend needs a real change, not just the backend.** |
| Is `firebase-admin` usable from functions? | Declared at `functions/package.json` (`^13.0.0`) and installed, but **never imported anywhere** in `functions/src` — there is no existing Admin SDK initialization to reuse. Build adds the first one. Modular entrypoints confirmed present: `firebase-admin/app` exports `initializeApp`/`getApps`; `firebase-admin/auth` exports `getAuth`. |
| Can `functions/` read `NEXT_PUBLIC_USER1_EMAIL`? | **No.** Those live in `app/.env.local` and `app/.env.staging` — Next.js build-time files. Firebase Functions loads only `functions/.env`, `.env.<projectId>`, `.env.<alias>`, resolved relative to `functions/` (`firebase-tools/lib/functions/env.js:149-156`). `functions/.env` today holds `SPREADSHEET_ID` alone. **Functions needs its own separately-defined env var.** |
| Does CORS need changing? | **Yes.** `setCors()` (`functions/src/index.ts:39-43`) sets `Access-Control-Allow-Headers: Content-Type`. `Authorization` is not CORS-safelisted, so any cross-origin caller (local `next dev` against a deployed function via `NEXT_PUBLIC_API_BASE`) fails preflight. In deployed staging/production every call is same-origin through the `firebase.json` `/api/**` rewrite, so preflight does not fire there — but the header must still be added or dev breaks. |
| Must OPTIONS bypass auth? | **Yes**, and the existing shape already allows it: `index.ts:269-272` returns 204 for `OPTIONS` before any other work. The auth check goes *after* that early return and *after* `setCors(res)` at line 267. |
| Is the entity 050 scheduler affected? | **No — confirmed, not assumed.** `subscriptionScheduler` (`index.ts:822-831`) is a separate `onSchedule` export that calls `getSheetsClient()` and `runSubscriptionScheduler()` directly. It never enters the `api` `onRequest` handler, so it never reaches the auth check. |
| Is `isAuthorizedEmail` really dead? | **Yes, and more broadly than ideation said.** `app/app/lib/auth.ts` has **zero importers** — the entire file is dead, not just the stub. Real client-side authorization already lives in `authContext.tsx` via `getUserByEmail`, which signs out an unrecognized email and renders the Access Denied screen. |
| Will the existing test suite survive? | **No, not unchanged.** `call()` in `functions/test/sheetsStub.js:171-190` builds `{method, path, body}` with **no `headers` key**. 81 `call()` invocations across 5 test files go through it. Reading `req.headers.authorization` would throw for every one. The stub must supply headers and a default authorized token. |

### Design Decisions

**D1 — Server-side email list: a new `AUTHORIZED_EMAILS` var in `functions/.env*`.**
`NEXT_PUBLIC_*` vars are unreachable from the functions runtime (see table), so reuse is not merely inadvisable — it is impossible. A single comma-separated `AUTHORIZED_EMAILS` is chosen over mirrored `USER1_EMAIL`/`USER2_EMAIL` because the server performs set membership and never distinguishes user1 from user2; one variable is also one edit for the captain, removing the "forgot the second var" failure mode. Using the same *values* as the client vars leaks nothing new — they are already inlined in the public bundle — but the *definition* must be its own server-side var.

**D2 — `app/app/lib/auth.ts` is deleted outright.**
Zero importers, and its three live exports (`signInWithGoogle`, `signOutUser`, `googleProvider`) are all superseded by `authContext.tsx`'s own. Deleting removes the file that "pretends to be a security boundary" without touching working behavior. No new client-side pre-check is added: `authContext` already rejects unauthorized emails before any page renders, so a second client check would be redundant, and the server is now the real boundary.

**D3 — Fail closed on missing configuration.**
Missing `AUTHORIZED_EMAILS` returns 500, never allow-through. This trades a possible self-inflicted outage for the guarantee that a config slip can never silently reopen the hole — mitigated by the preflight check in AC-11 and the deploy order in AC-22.

**D4 — 401 vs 403 are distinct.** 401 = "no usable credential" (absent, malformed, or unverifiable token). 403 = "credential is valid, this person is not authorized." The distinction makes AC failures diagnosable from the status code alone during a live production check.

### User Stories

- As the captain, I want the API to answer only requests from me and Wei, so a stranger with the URL cannot read or change our household's financial data.
- As the captain, I want a signed-in Google user who isn't one of us turned away rather than silently let through, so Google Sign-In actually means something.
- As the captain, I want the app to keep working exactly as it does today after this ships — same screens, same taps, no new sign-in step.
- As the captain, I want to know before the production deploy that this works against a real token, and to have a fast way out if it locks us both out.

### Acceptance Criteria

Endpoint coverage means all 14 method+path combinations the `api` function serves: `GET|POST|PATCH|DELETE /api`; `GET /api/users`; `GET /api/scheduler-status`; `GET|POST /api/categories`; `PATCH /api/categories/:id`; `GET|POST|PATCH /api/subscriptions`; `POST /api/insights`; `POST /api/migrate-users`.

Rejection

- [ ] AC-1 — With no `Authorization` header, each of the 14 combinations returns **401** with body `{"error":"unauthorized"}`, and the in-memory sheet fixture is byte-identical afterwards (proving no read and no write occurred).
- [ ] AC-2 — A present-but-malformed header returns **401** on `GET /api` for each of: `""`, `"abc"`, `"Bearer"`, `"Bearer "`, `"Basic eHl6"`.
- [ ] AC-3 — A well-formed `Bearer <token>` whose token `verifyIdToken()` rejects (expired, bad signature, or wrong project audience) returns **401**.
- [ ] AC-4 — A token that verifies but whose `email` claim is absent from `AUTHORIZED_EMAILS` returns **403** with body `{"error":"forbidden"}` on each of the 14 combinations, and the sheet fixture is byte-identical afterwards.
- [ ] AC-5 — A token that verifies with an authorized `email` but `email_verified !== true` returns **403**.

Acceptance and non-regression

- [ ] AC-6 — With a token verifying to either entry of `AUTHORIZED_EMAILS` and `email_verified: true`, each of the 14 combinations returns exactly the status code and response body it returns today for the same input. Proven by the existing 81 `call()` assertions across the 5 test files passing unmodified except for the stub supplying a default authorized token.
- [ ] AC-7 — Email comparison is case-insensitive and tolerant of surrounding whitespace on both the token claim and each configured entry.

Configuration

- [ ] AC-8 — `AUTHORIZED_EMAILS` unset, empty, or containing only whitespace and commas causes every non-OPTIONS request to return **500** `{"error":"AUTHORIZED_EMAILS not configured"}`. No input reaches the Sheets client in this state.
- [ ] AC-9 — The value is read from `process.env.AUTHORIZED_EMAILS`, set in `functions/.env` (production) and `functions/.env.staging` (staging), both gitignored. Placeholders are documented in the tracked `.env.example` and `functions/.env.staging.example`.
- [ ] AC-10 — `git grep` over the branch finds no real email address in any tracked file.
- [ ] AC-11 — A preflight command (`npm --prefix functions run check:auth-emails`) exits **0** when the `AUTHORIZED_EMAILS` set in `functions/.env` equals the `{NEXT_PUBLIC_USER1_EMAIL, NEXT_PUBLIC_USER2_EMAIL}` set in `app/.env.local` (case-insensitive), and exits **non-zero** otherwise. It prints a match/mismatch verdict and counts only — never an address.

CORS and preflight

- [ ] AC-12 — `OPTIONS` returns **204** with no `Authorization` header present, on every path, and `verifyIdToken` is never invoked on that path (asserted with a spy, not inferred from the status code).
- [ ] AC-13 — `Access-Control-Allow-Headers` includes both `Content-Type` and `Authorization`.
- [ ] AC-14 — 401, 403, and 500 responses carry the same CORS headers as a success response, so a browser reads the real status instead of an opaque network error. (Requires `res.set` in the test stub to record rather than no-op.)

Frontend

- [ ] AC-15 — All 16 `fetch` call sites across the 8 files route through a single helper that sets `Authorization: Bearer <idToken>` from `getFirebaseAuth().currentUser.getIdToken()`. Verified by a grep showing no bare `fetch(` remaining in `app/app` outside that helper.
- [ ] AC-16 — When `currentUser` is null the helper raises a distinguishable error and issues no request, rather than sending a tokenless one. (Every page renders behind `AuthGuard`, so this is a guard against future callers, not a live path.)
- [ ] AC-17 — `getSchedulerStatus()` keeps its swallow-errors contract: an auth failure yields the `stale: true` fallback object rather than throwing.

No collateral damage

- [ ] AC-18 — The entity 050 scheduler is untouched: `functions/test/scheduler.test.js` passes unmodified, and `runSubscriptionScheduler`'s path contains no token logic.
- [ ] AC-19 — `app/app/lib/auth.ts` is deleted, `grep -rn 'lib/auth"' app/app` returns nothing, and `npm --prefix app run build` succeeds.
- [ ] AC-20 — `npm --prefix functions test` and `npm --prefix app test` both pass.

Rollout safety

- [ ] AC-21 — Verify produces **live staging evidence using a real Firebase ID token** minted by a real Google sign-in on `https://expense-sheet-staging.web.app` — not a fixture, not a unit test. It records, against the live staging API: (a) authorized email → 200 with real data, (b) no token → 401, (c) tampered token → 401. Decoded claims are reported as `aud`, `iss`, and `email_verified` values plus the email *domain* only — never the raw token, never the full address.
- [ ] AC-22 — Production deploy follows the ordered runbook in **Rollout Plan** below, with the captain signed in and standing by, and the post-deploy live check is recorded in the entity body before `status: done`.

### Rollout Plan

This is the highest-impact deploy of the session: a misconfigured check locks both the captain and Wei out of the live app. The order below is load-bearing.

**Why hosting deploys first.** Deploying functions first would mean the enforcing backend is live while hosting still serves the old tokenless bundle — instant total outage. Deploying hosting first means the new token-sending bundle runs against the still-permissive backend, which is harmless, and proves the frontend works before enforcement turns on.

1. **Preflight (before any deploy).** Run `npm --prefix functions run check:auth-emails` (AC-11). A non-zero exit stops the deploy — this is the single check that prevents the lockout.
2. **Staging, both.** `firebase deploy --project staging` and complete AC-21 against real staging tokens. Staging is a separate Firebase project (`expense-sheet-staging`) with its own token audience, so a production token cannot mask a staging failure.
3. **Production hosting.** `firebase deploy --only hosting --project production`. Captain confirms the app still works normally. Enforcement is not on yet; nothing can break here.
4. **Production functions.** `firebase deploy --only functions --project production`, captain signed in and watching. Then immediately: captain reloads the app and confirms data loads; and `curl` with no token against a production endpoint returns 401.
5. **Record** the deploy, timestamp, and step-4 evidence in this entity body, then set `status: done`.

**Recovery path if step 4 goes wrong.** Firebase Functions has no one-click rollback, so recovery is a redeploy of the previous source: `git revert` the functions change (or check out the prior commit of `functions/src`) and run `firebase deploy --only functions --project production` — roughly 1–3 minutes to restore service. Hosting can additionally be rolled back from the Firebase Console's Hosting release history if step 3 ever needs undoing. The captain must be available for this window; do not run step 4 unattended.

**Operational consequence to expect.** Ad-hoc `curl` against the production API — which this session's own testing relied on — stops working without a token. Anyone debugging live must first copy an ID token from a signed-in browser session's devtools. Note this wherever the deploy runbook lives.

### Edge Cases

- **Token expires mid-session.** ID tokens last one hour; `getIdToken()` refreshes automatically within five minutes of expiry. The 60-second inactivity sign-out in `authContext.tsx` makes a stale token unlikely to be reached at all.
- **Cold start latency.** The first `verifyIdToken()` in a new function instance fetches Google's public signing keys over the network, then caches them. Expect a small one-time delay on a cold request; it must not surface as an error.
- **Clock skew.** A device clock far enough off makes a genuine token read as expired or not-yet-valid → 401. Diagnosable because the same token succeeds from another device.
- **Cross-environment token.** A production token presented to staging (or the reverse) fails audience validation → 401. This is correct and is what makes staging a real test.
- **Both users active at once.** Each request carries its own token and the check is stateless; concurrent use is unaffected.
- **Offline.** The fetch fails at the network layer before any auth logic runs — unchanged from today.
- **Token verifies but carries no `email` claim.** Treated as 403, not a crash.
- **`/api/scheduler-status` and `/api/migrate-users` now require auth too.** These were reachable by bare `curl`; any script or habit relying on that breaks by design.

### Out of Scope

- Any new sign-in UI or flow — Google Sign-In already exists; this is the backend actually checking it.
- Multi-user or role support beyond the existing two-user model.
- Rate limiting, abuse prevention, or anything beyond "is this one of the two authorized people."
- Rotating or restricting the Firebase Web API key, tightening Firestore/Sheets IAM, or any other hardening not on the token-check path.
- Adding a client-side pre-check before API calls — `authContext` already blocks unauthorized emails at render time (D2).

## Stage Report: spec

- DONE: Write the formal spec using the Spec Template (Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope) from the ideation body
  All five template sections present, plus Current State / Design Decisions / Rollout Plan; commit a8ac903.
- DONE: Trace the exact current frontend auth flow — does the app obtain a Firebase ID token anywhere, does any fetch send an Authorization header at all
  `grep -rn Authorization` over `app/app`, `functions/src`, `app/test`, `functions/test` returned **zero** matches; all 16 `fetch` call sites across 8 files send `Content-Type` only. Recorded as an explicit "the frontend needs a real change" row.
- DONE: Trace exactly how the backend would verify a token — is firebase-admin a dependency, what's the minimal verifyIdToken() shape against existing Admin init
  `firebase-admin ^13.0.0` is declared and installed, but `grep -rn "firebase-admin\|initializeApp\|admin\."` over `functions/src` returned **zero** — there is no existing init to reuse. Confirmed by loading the package that `firebase-admin/app` exports `initializeApp`/`getApps` and `firebase-admin/auth` exports `getAuth`.
- DONE: Decide and specify precisely where the two authorized emails live server-side; confirm whether functions/ can read NEXT_PUBLIC_-prefixed vars or needs its own
  **It cannot.** `firebase-tools/lib/functions/env.js:149-156` resolves only `.env`, `.env.<projectId>`, `.env.<alias>` relative to `functions/`; `functions/.env` holds `SPREADSHEET_ID` alone, while the emails live in `app/.env.local`. Decision D1: a new server-side `AUTHORIZED_EMAILS` (comma-separated) in `functions/.env` and `functions/.env.staging`.
- DONE: Confirm CORS implications — Allow-Headers update, and whether preflight OPTIONS must bypass the new auth check
  `setCors()` at index.ts:39-43 sends `Allow-Headers: Content-Type` only, so `Authorization` must be added (AC-13). OPTIONS already returns 204 at index.ts:269-272 before any other work, so the check goes after that early return — AC-12 asserts `verifyIdToken` is never invoked on that path via a spy.
- DONE: Acceptance criteria binary/independently testable, covering no-token reject, wrong-email reject, authorized accept with behavior unchanged, and entity 050 scheduler confirmed unaffected
  22 numbered ACs over 14 enumerated method+path combinations. Scheduler confirmed by reading index.ts:822-831 — `subscriptionScheduler` is a separate `onSchedule` export calling `getSheetsClient()`/`runSubscriptionScheduler()` directly, never entering the `api` handler.
- DONE: The spec MUST address rollout safety explicitly — how build/verify prove this against real tokens before production, and the exact recovery path
  Rollout Plan orders hosting before functions (a functions-first deploy would run the enforcing backend against the still-tokenless bundle = instant outage). AC-21 requires a real staging Google sign-in token, not fixtures. Recovery is `git revert` + `firebase deploy --only functions` (~1-3 min; Functions has no one-click rollback), captain standing by, unattended step 4 forbidden. AC-11 adds a preflight env-match check as the single guard against lockout.
- DONE: Confirm scope boundary per the ideation — no new sign-in UI/flow, no multi-user/role support, no rate limiting
  All three carried into Out of Scope verbatim, plus two boundaries the tracing surfaced: no unrelated hardening (API key rotation, IAM), and no client-side pre-check since `authContext` already blocks unauthorized emails at render time.

### Summary

Traced every claim against the code rather than carrying the ideation's assumptions forward, which changed three things. The frontend genuinely sends no token today, so this is a two-sided change; `functions/` provably cannot read the `NEXT_PUBLIC_` emails, settling the env-var question as "needs its own var"; and `app/app/lib/auth.ts` has zero importers, so the whole file goes, not just the stub.

The load-bearing find for build is that `call()` in `functions/test/sheetsStub.js:171-190` builds requests with no `headers` key. Exercised it directly against a stand-in handler: reading `req.headers.authorization` throws `TypeError: Cannot read properties of undefined`, so all 81 `call()` invocations across 5 files break unless the stub supplies headers and a default authorized token. Baseline confirmed green first — `npm --prefix functions test` passes 173/173 today, which is what AC-6 measures non-regression against.

Rollout safety is specified rather than left to build: hosting-before-functions ordering, a preflight env-match check, real-token staging evidence, and a redeploy recovery path with the captain standing by.

## Stage Report: build

- DONE: Implement AC-1 through AC-5 (rejection)
  `functions/src/auth.ts` + gate at `index.ts:275-283`; commit 106a5a5. AC-1/AC-4 loop all 14 combinations asserting status, body, a byte-identical grid snapshot AND an empty `requests` log — removing the gate, or moving it after `getSheetsClient()`, fails on the request log even if the status were still right.
- DONE: Implement AC-6/AC-7 (acceptance, non-regression)
  All 173 pre-existing assertions pass with only `sheetsStub.js` changed (default authorized token + recording `res.set`). AC-6 additionally drives both authorized emails over all 14 combinations asserting the response is not one of the three gate bodies; AC-7 feeds uppercased/padded claims against a mixed-case, padded, trailing-comma env value — dropping either `.toLowerCase()` or `.trim()` fails it.
- DONE: Implement AC-8 through AC-11 (configuration)
  AC-8 covers `undefined`/`""`/`"   "`/`","`/`" , , "`/`",,,"` across all 14 combinations, asserting 500, an untouched grid, no Sheets request, and **zero verifyIdToken calls**. `AUTHORIZED_EMAILS` documented with placeholders in `.env.example` and `functions/.env.staging.example`; `functions/scripts/check-auth-emails.js` + `check:auth-emails` script with 7 tests in `checkAuthEmails.test.js` driving it as a real subprocess against throwaway env files in a non-git tmpdir.
- DONE: Implement AC-12 through AC-14 (CORS/preflight)
  AC-12 asserts 204 on all 14 paths with `verifyCalls` empty — a spy, not the status code — plus a case with `AUTHORIZED_EMAILS` deleted. `res.set` now records, so AC-14 compares the full header map of 401/403/500 against a 200 and guards that comparison with a non-emptiness check (otherwise two empty maps would pass).
- DONE: Implement AC-15 through AC-17 (frontend)
  Commit 8c6754f: 16 call sites across 8 files now call `apiFetch`; `app/test/api-auth.test.js` exercises the **real** helper against a stubbed firebase module. A source-walking test fails on any bare `fetch(` in `app/app` outside `apiClient.ts`. AC-16 asserts `NotSignedInError` **and** an empty call log; AC-17 asserts `getSchedulerStatus()` returns `stale:true` with no user and the real payload when signed in.
- DONE: Implement AC-18 through AC-20 (no collateral damage)
  `git diff main...HEAD` touches neither `functions/test/scheduler.test.js` nor `functions/src/scheduler.ts`; grep finds no token logic in the scheduler path. `app/app/lib/auth.ts` deleted with zero importers (asserted by a test, not just a grep). `npm --prefix app run build` compiles 14 routes. Final: functions **193/193**, app **160/160**.
- SKIPPED: Do NOT attempt AC-21/AC-22 (rollout safety with real tokens and the actual production deploy)
  Reserved for verify and the captain per the Rollout Plan. No real Firebase token was used and nothing was run against a real spreadsheet — every test drives the in-memory sheet fixture with a stubbed verifier.
- DONE: Set up the firebase-admin initialization for the first time in functions/src
  `auth.ts:1-2` uses the modular `firebase-admin/app` (`initializeApp`/`getApps`) and `firebase-admin/auth` (`getAuth`) entrypoints, guarded by `getApps().length === 0`. Deliberately not cached in a module-level binding — `getAuth()` already returns the SDK's per-app instance, and a local cache would survive a test's re-stub.
- DONE: Self-check every AC against a fixture/stub, with falsifiability proven by mutation on AC-8, AC-12, AC-18
  Baseline re-confirmed fresh at 173/173 before any edit. Three mutations applied, each reverted after: (1) fail-closed → fail-open (`return {ok:true}` on an empty list) — AC-8 and AC-14 fail; (2) auth gate moved above the OPTIONS early return — both AC-12 tests fail; (3) `authorize()` called inside `runSubscriptionScheduler` — 8 scheduler tests fail. Working tree confirmed identical to HEAD afterwards.

### Summary

The gate lives at `index.ts:275`, after `setCors()` and after the OPTIONS early return, and checks configuration before credentials: an unusable `AUTHORIZED_EMAILS` 500s without ever reading the token, so a config slip cannot silently reopen the hole. 401 covers absent/malformed/unverifiable credentials, 403 covers a token that verifies but is not authorized or not `email_verified`.

Two findings worth the gate's attention. First, the spec's prediction about the test stub was right and slightly understated: `call()` needed headers *and* `res.set` had to stop being a no-op, otherwise AC-14 would have passed vacuously by comparing two empty header maps — the test now guards against exactly that. Second, the frontend change breaks the app render tests in a way the spec did not anticipate: they exercise the real services, which now demand a Firebase `currentUser` that does not exist headlessly. The harness stubs the compiled `apiClient` (the same `require.cache` technique the existing `mockAuth` uses), and `app/test/api-auth.test.js` covers the real helper separately so the stub does not hide it.

Nothing was run against a real spreadsheet or with a real token. AC-21/AC-22 are untouched, and the preflight currently reports MISMATCH because `AUTHORIZED_EMAILS` is not yet in the captain's `functions/.env` — which is the correct pre-deploy state and the first step of the runbook.

## Stage Report: verify

**Verdict: PASSED** for AC-1 through AC-20. AC-21 and AC-22 are unmet and reserved for the captain — see below. A staging deploy was deliberately NOT performed; the reason is a real blocker, not an omission.

- DONE: Re-run the full test suite fresh (npm install/ci, not symlinks) and confirm functions 193/193 and app 160/160
  `npm ci` in both packages (real dirs, no symlinks), then functions **193/193**, app **160/160**.
- DONE: Independently reproduce all 3 of the build's mutation claims
  Run in a disposable repo copy so the branch never held a weakened gate. (1) fail-open → exactly AC-8 + AC-14 fail (11/13). (2) gate above the OPTIONS early return → exactly both AC-12 tests fail (11/13). (3) `authorize()` in `runSubscriptionScheduler` → **21–23 of 25** scheduler tests fail, not 8; see Summary.
- DONE: Independently spot-check the two things the build found beyond the spec's prediction
  `res.set` was `set() {}` on main and now records. With `res.set` reverted to a no-op **and** the guard line deleted, AC-14 **passes vacuously** (only AC-13 catches it); restoring the guard alone fails AC-14. Real helper confirmed: deleting the `headers.set("Authorization", …)` line fails 3 AC-15 tests — impossible against a stub. A planted bare `fetch(` fails the walker, naming `lib/expenseService.ts:36`.
- DONE: Confirm AC-18 as a hard boundary, not just a diff check
  `grep -nE 'auth|token|authorize|verifyIdToken|Authorization|AUTHORIZED'` over `functions/src/scheduler.ts` → **zero matches**. sha256 of `scheduler.test.js` identical across main / branch HEAD / worktree (`78f22f1f…bb51`); `scheduler.ts` identical main vs HEAD (`958455a6…16d3`).
- DONE: Confirm the firebase-admin initialization is genuinely guarded against double-init
  Probed against the **real** firebase-admin SDK (no stub): 5 sequential `authorize()` calls → app count 0→1, stays 1, no throw. Reverse case: an app pre-initialized by another module first → 3 more calls, still 1 app, no duplicate-app throw. Node's runner also forks per test file, so cross-file collision cannot arise here.
- DONE: IMPORTANT — DO NOT DEPLOY TO PRODUCTION under any circumstance in this stage
  No production deploy and no write of any kind to the production project. Nothing outside the worktree was modified.
- SKIPPED: Attempt AC-21 as far as possible (deploy to STAGING, prove 401 paths, obtain a real token if possible)
  **The entity's own Rollout Plan step 1 stops this deploy**: preflight exits non-zero. `AUTHORIZED_EMAILS` is set in neither `functions/.env` nor `functions/.env.staging`, and the config gate runs *before* the token check — so a staging deploy as-is returns **500 to every request including tokenless ones**, leaving AC-21's 401s unreachable and staging fail-closed for the captain. Setting it means writing the two real addresses into the main checkout, outside this worktree and a captain credentials decision. No real Firebase ID token was obtainable: minting one needs Admin-SDK service-account credentials for `expense-sheet-staging` plus an existing Auth user, or the browser OAuth flow this environment cannot run. Live evidence obtained another way — see below.
- DONE: Confirm the preflight check:auth-emails script currently reports MISMATCH as expected
  Exit **1**, "MISMATCH: AUTHORIZED_EMAILS is unset or empty — the API would fail closed (500)." Counts only (0 server / 2 client), never an address. Its 7 tests pass, covering the exit-0 match path and the never-print-an-address rule.
- DONE: Mandatory PII/secrets check on the full diff
  Every email-shaped string this branch adds is on the reserved `@example.test` domain (7 distinct, all fixtures). Zero JWT-shaped strings, zero PEM/private-key material, zero API-key shapes. Only `.env.example` and `functions/.env.staging.example` are committed, both placeholder-only (`TODO_…`). The only token literal is `"id-token-abc"`. A branch-wide scan surfaces two real-looking addresses, but both pre-exist on main as entity 056's own PII-hook fixtures — constructed stand-ins that entity documents as such. They are not restated here, because this repo is public and 056's pre-commit hook correctly blocks that (it blocked this very report until the literals were removed).
- DONE: Report clearly which parts of AC-21/AC-22 remain for the captain
  Both remain open and are listed explicitly below. Neither was silently skipped.

### Live evidence

**Current staging, pre-merge (the hole is real):** `GET https://expense-sheet-staging.web.app/api/scheduler-status` with **no token** → **200**, 117 bytes of real scheduler data. That is today's deployed behaviour and exactly what this entity closes.

**New code over real HTTP** (Firebase functions emulator, `demo-verify` project, real compiled `lib/`, no shared environment touched):

| Request | Result |
|---|---|
| `GET /api/scheduler-status`, no header | **401** `{"error":"unauthorized"}` + all 3 CORS headers |
| `GET`, `Authorization: Bearer not-a-real-token` | **401** `{"error":"unauthorized"}` |
| Headers `""`, `abc`, `Bearer`, `Bearer `, `Basic eHl6` | **401** ×5 |
| `POST`/`PATCH`/`DELETE /api`, `POST`/`PATCH /api/subscriptions`, `POST /api/migrate-users`, no token | **401** ×6 |
| `OPTIONS` on all 7 paths, no token | **204** ×7 |
| Allowlist unset, no token | **500** `{"error":"AUTHORIZED_EMAILS not configured"}` + CORS headers |
| Allowlist unset, *with* a token | **500** — config gate fires before the token check |
| Allowlist unset, `OPTIONS` | **204** — preflight still passes |

`Access-Control-Allow-Headers: Content-Type, Authorization` on every response above, rejections included (AC-13/AC-14 live). The emulator read a local gitignored `functions/.env` holding only `@example.test` addresses; it was deleted afterwards and the worktree is clean.

### Reserved for the captain

1. **Set `AUTHORIZED_EMAILS`** (blocks everything else) in `functions/.env` and `functions/.env.staging`, to the same two addresses as `NEXT_PUBLIC_USER1_EMAIL`/`NEXT_PUBLIC_USER2_EMAIL`. Then `npm --prefix functions run check:auth-emails` must exit 0 — until it does, the runbook forbids deploying.
2. **AC-21** — staging deploy, then a real Google sign-in on `https://expense-sheet-staging.web.app` recording: authorized email → 200 with real data; no token → 401; tampered token → 401. Report `aud`/`iss`/`email_verified` and the email *domain* only.
3. **AC-22** — the production deploy, hosting **before** functions, captain signed in and standing by. Recovery is `git revert` + `firebase deploy --only functions` (~1–3 min).

### Summary

AC-1 through AC-20 hold, verified by exercising rather than by re-reading the build's report: a fresh `npm ci` reproduced 193/193 and 160/160, all three mutations were re-run in a disposable copy, and the auth gate was driven over real HTTP for its 401, 500, 204 and CORS behaviour. AC-18 is a hard boundary by sha256, not a diff impression, and the firebase-admin guard was probed against the real SDK in both the cold and pre-initialized directions.

Two corrections to the build's report, neither a defect. Its third mutation claim understates itself: `authorize()` inside `runSubscriptionScheduler` fails **21 of 25** scheduler tests with an early return and **23 of 25** when it throws — not 8. No variant failing only 8 was reachable, so treat the number as wrong and the protection as stronger than advertised. Separately, a small hole in AC-15's "single door" guarantee: the source walker's regex excludes any `.fetch(`, so a future `window.fetch(` or `globalThis.fetch(` would pass unnoticed. Every current call site routes through `apiFetch`, so this is not blocking — but the guard is not airtight.

The one thing verify could not do is AC-21, and the reason is structural rather than environmental. `AUTHORIZED_EMAILS` is unset server-side and the config gate precedes the token check, so a staging deploy today would 500 every request, prove nothing about the 401 paths, and leave staging fail-closed for the captain. The entity's own preflight already encodes this as a stop condition and currently exits non-zero, which is the correct pre-deploy state. The captain sets that variable first; staging and production then follow the runbook's order.

## Stage Report: verify (cycle 2)

**Verdict: AC-1..AC-20 PASSED (cycle 1). AC-21 is now LIVE-PROVEN except part (a). AC-22 NOT STARTED — correctly.**
AC-21(b) no-token → 401 and (c) tampered → 401 are proven against the deployed staging API. AC-21(a)
authorized-email → 200 is **not** proven: a token bound to an authorized identity is unobtainable by an
agent here. This is **not** a build defect and must **not** be routed to `feedback-to: build` — no code
change can fix it. It needs the captain to sign in once in a browser.

- DONE: Confirm the blocker is cleared — run the preflight yourself first
  `npm --prefix functions run check:auth-emails` → exit **0**, "MATCH: both sides list the same 2 address(es)."
  Also checked the staging pair the preflight does not cover: `functions/.env.staging` AUTHORIZED_EMAILS ==
  `app/.env.staging` NEXT_PUBLIC_USER{1,2}_EMAIL → MATCH, and the same 2 addresses as production. Counts only.
- DONE: Deploy this branch to STAGING (functions and hosting)
  `firebase deploy --only functions,hosting --project staging`. Functions `api` + `subscriptionScheduler`
  updated; CLI logged "Loaded environment variables from .env.staging". **The combined command then failed —
  see the FAILED item below — and hosting had to be redeployed separately.**
- FAILED: The combined `firebase deploy` left staging in the exact broken state the Rollout Plan warns about
  The command aborted with `Error: Functions successfully deployed but could not set up cleanup policy in
  location us-central1` **after** the functions went live but **before** `hosting: release complete`. Result:
  enforcing backend + previous tokenless bundle — the "instant total outage" ordering. Caught by hash check:
  served `index.html` was `last-modified: Tue, 25 Aug 2026` and referenced entirely different chunk names.
  Recovered with `firebase deploy --only hosting --project staging` → "release complete". Now: local vs served
  `index.html` sha256 **identical** (`46b9bdf490a66ec3…`), 5/5 sampled chunks MATCH, `Authorization` string
  present in 2 served chunks, `last-modified: Wed, 26 Aug 2026 08:24:25 GMT`.
- DONE: Confirm via HTTP that a tokenless request returns 401 and a malformed Bearer returns 401
  All **14** method+path combinations → **401** `{"error":"unauthorized"}` (the same `GET /api/scheduler-status`
  returned **200** with 117 bytes of real data minutes earlier — the hole closing is recorded on both sides).
  Malformed headers `""`, `abc`, `Bearer`, `Bearer `, `Basic eHl6`, `Bearer not-a-real-token`, `Bearer aaa.bbb.ccc`
  → 401 ×7. `OPTIONS` → **204** ×7 tokenless. 401s carry all 3 CORS headers incl.
  `Access-Control-Allow-Headers: Content-Type, Authorization`. No response was ever a 500, which is itself the
  live proof that the deployed staging function really did load AUTHORIZED_EMAILS.
- FAILED: AC-21(a) — obtain a real ID token for an *authorized* email without a browser OAuth flow
  Both documented routes are closed in this environment. (1) Admin SDK: the staging service account in
  `functions/.env.staging` returns `auth/insufficient-permission` on `getUserByEmail` for **both** authorized
  addresses — it is a Sheets service account with no Firebase Auth role, so it cannot discover the uid a custom
  token must name. (2) `firebase auth:export` (which would supply the uid using the CLI's own captain
  credentials) and any inspection of the local gcloud/firebase credential stores were **denied by the sandbox
  permission classifier**. I did not attempt to work around either denial. I also refused the one remaining
  "success": `createCustomToken` accepts `email`/`email_verified` as custom claims, so I could have minted a
  token that returns 200 — that fabricates the identity the AC exists to test, so it was not done.
- DONE: Prove the *verification* path really works, which 401-only evidence cannot
  401-everywhere is also what a totally broken gate looks like. So: minted a custom token with the staging SA
  private key (local signing — works), exchanged it via Identity Toolkit `signInWithCustomToken` for a **real,
  Google-signed** staging ID token, and drove the deployed API with it. `aud=expense-sheet-staging`,
  `iss=https://securetoken.google.com/expense-sheet-staging`, `email`/`email_verified` **absent** (throwaway
  identity), `sign_in_provider=custom`. Result **403 `{"error":"forbidden"}`** on `/api`, `/api/scheduler-status`,
  `/api/categories` — i.e. `verifyIdToken()` *succeeded* and the allowlist refused it. 401 there would have meant
  verification itself was broken. This is the accept-side half of AC-21 minus the allowlist membership.
- DONE: Forgery suite against the live deployment — 7/7 rejected
  Against the same real token: signature byte genuinely altered → 401; **authorized email spliced into the
  payload keeping the real signature → 401** (the one that matters: the gate is not forgeable); forged payload
  with empty signature → 401; `alg:none` + forged payload → 401; forged payload re-signed with an
  attacker-generated RSA key → 401; `aud`/`iss` swapped to the production project → 401; `exp` backdated one
  hour → 401.
- DONE: Correct a false alarm I raised mid-run, rather than leaving it in the record
  My first tamper flipped the **last** base64url char of the signature and got 403, not 401 — which reads as a
  defect. It is a flaw in the test: an RS256 signature is 256 bytes = 2048 bits, encoded as 342 base64url chars
  carrying 2052 bits, so the final char's low 4 bits are padding. Proven byte-for-byte in-run:
  `Buffer.compare(decode(sig), decode(sigLastCharFlipped)) === 0` → **true**. The token was never modified, so
  403 was the correct and expected answer. T1 above redoes it mid-signature and gets 401.
- DONE: Report the exact current state of AC-22 — production untouched
  **Not started, and I did not attempt it.** Production is verifiably unmodified: `GET
  https://expense-sheet-b2db8.web.app/api/scheduler-status` with no token still returns **200** with real data
  (old permissive code), and production hosting is still `last-modified: Tue, 25 Aug 2026 09:37:47 GMT`. No
  write of any kind was issued against the production project.
- DONE: Clean up any test data created on staging
  Two throwaway auth users (`ac21-verify-…`, `ac21-tamper-…`, random uids, no email, no personal data) were
  created by the custom-token exchange and both self-deleted via Identity Toolkit `accounts:delete` → HTTP 200,
  post-delete `accounts:lookup` → HTTP 400, record gone. No other staging state was written.
- DONE: Mandatory PII / secrets check
  No `.env` with real values tracked — only `.env.example`, `app/.env.staging.example`,
  `functions/.env.staging.example`, all placeholders. Branch diff: zero JWT-shaped strings, zero
  `BEGIN PRIVATE KEY`, zero `AIza…` keys. The single non-`@example.test` address in a changed file is a
  pre-existing `…@…iam.gserviceaccount.com` *placeholder comment* in `.env.example`, untouched by this branch,
  which adds only an empty `AUTHORIZED_EMAILS=` plus comments. I copied the two gitignored env files into the
  worktree to build/deploy and **deleted both afterwards**; `git status` is clean. No address, uid, or token
  material is printed anywhere in this report or in any command output retained.

### What the captain still has to do

1. **AC-21(a) — one browser sign-in.** Open `https://expense-sheet-staging.web.app` (orange "Staging" banner),
   sign in with an authorized Google account, and confirm the app loads real data. That single action is the
   only missing piece; everything around it is already proven live. If it loads, the accept path is closed.
2. **AC-22 — production deploy**, hosting **before** functions, per Rollout Plan steps 3–5. FO + captain, not
   an ensign.

### Operational warning for the AC-22 runbook

**Do not run a combined `firebase deploy` against production.** It deployed functions first and then died on
the Artifact Registry cleanup-policy error before releasing hosting — on production that is the outage the
Rollout Plan is written to prevent. The runbook's separate steps 3 and 4 already avoid it; keep them separate.
Also expect that same non-zero exit on the production functions step: it prints `Error:` *after* a successful
deploy, so treat "functions deployed but cleanup policy failed" as success and verify by HTTP, not by exit code.
Run `firebase functions:artifacts:setpolicy` separately if the captain wants the warning to stop.

### Summary

Staging is deployed and the gate is real: 14/14 tokenless combinations return 401 where the same endpoint served
200 beforehand, OPTIONS still preflights at 204, CORS headers survive rejection, and seven distinct forgeries —
including an authorized email spliced into a genuinely-signed token — are all refused. A real Google-signed
staging token with no allowlist membership returns 403 rather than 401, which proves `verifyIdToken()` actually
verifies instead of the gate merely rejecting everything.

Two findings worth the captain's attention. First, the combined `firebase deploy` aborted on an Artifact
Registry cleanup-policy error after functions went live but before hosting was released, briefly reproducing the
enforcing-backend/old-bundle outage the Rollout Plan exists to prevent; hash-comparing served bytes against the
build caught it, a separate hosting deploy fixed it, and the production runbook must keep the two steps apart.
Second, my own first tamper test produced a scary-looking 403 that was a base64 padding artifact, not a defect —
disproven byte-for-byte rather than left in the record as a doubt.

AC-21(a) remains genuinely unmet. The service account cannot look up an authorized user's uid, and the two
routes that would have supplied it were refused by the sandbox; I declined the one trick that would have
produced a green 200, because forging the `email` claim tests nothing but my ability to forge it. One captain
sign-in on staging closes it.
