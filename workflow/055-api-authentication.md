---
id: 055
title: Add Real Authentication/Authorization to the API
status: spec
source: captain
started:
completed:
verdict:
score:
worktree:
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
