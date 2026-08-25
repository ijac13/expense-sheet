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
