---
id: 052
title: Move Hardcoded Personal Emails to Environment Variables
status: verify
source: captain
started: 2026-08-18T03:07:29Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-052-email-env-vars
issue:
pr:
---

`app/app/lib/users.ts` and `app/app/lib/auth.ts` have two real personal email addresses hardcoded directly in committed source — the captain's (`user1`/`ijac`) and the second household user's (`user2`/`wei`). This repo's GitHub remote is public, so both are currently exposed to anyone. (The literal addresses are deliberately not written out here — this file is tracked too.) Every other secret in this repo (Firebase keys, service-account credentials, spreadsheet IDs) already goes through environment variables, gitignored `.env*` files, and `.env*.example` placeholders — these two emails are the one place that pattern wasn't followed.

Captain gave direct instruction: swap both hardcoded emails for environment variables. Skipping formal ideation/spec ceremony since the fix is fully specified already; this stub carries the spec-equivalent detail build needs.

## Success

- `USERS` in `app/app/lib/users.ts` and `AUTHORIZED_EMAILS_STUB` in `app/app/lib/auth.ts` read both emails from environment variables, not literals.
- `.env.example` (and any other `.env*.example` template that needs it) documents the two new variable names with placeholder values, matching the existing pattern for every other secret in this repo.
- The real values are set in local `.env`/`.env.local` (already gitignored) and in whatever Firebase config actually needs them for staging and production to keep working — `git grep` for either literal email string across the tracked repo returns nothing after this change.
- `id`/`name` (`user1`/`ijac`, `user2`/`wei`) are unaffected — only the email fields move.

### Out of Scope

- Scrubbing the two emails from git history — they'd still be recoverable from old commits; a history rewrite is a separate, much bigger decision the captain hasn't asked for.
- The spreadsheet IDs or any other pre-existing exposure — captain explicitly said those are fine (the sheets themselves are private).
- Changing how users are identified anywhere else in the app (`user1`/`user2` ids, `paid_by` values, etc.) — email is only ever used for sign-in authorization.

## Plan

Trace every read site for `USERS` and `AUTHORIZED_EMAILS_STUB` before changing anything, since a Next.js env var needs the right `NEXT_PUBLIC_` prefix (or none) depending on whether it's read client-side or server-side — get this wrong and the build either leaks the var into client JS anyway or fails to read it at runtime. Confirm which one each of these two call sites actually needs.

## Stage Report: build

- DONE: Trace every call site of USERS (users.ts) and AUTHORIZED_EMAILS_STUB (auth.ts) first, and determine correctly whether each needs a NEXT_PUBLIC_-prefixed var (client-side) or an unprefixed one (server-side only) — getting this wrong either leaks the var into client JS or breaks at runtime
  `next.config.ts` sets `output: "export"` — the whole app is a static client bundle, so both sites need `NEXT_PUBLIC_`. 13 `USERS` importers traced; only `authContext.tsx:44` (`"use client"`) reads the `email` field, all others use `id`/`name`. `settings/users/page.tsx` renders emails from `/api/users` (Sheets tab), not from `USERS`.
- DONE: Replace both hardcoded email literals with environment variable reads; document the new variable names with placeholders in .env.example (and app/.env.staging.example / functions/.env.staging.example if either site is reachable from those contexts); set real values in the actual local .env/.env.local files (gitignored, not committed) so local dev keeps working
  Added `NEXT_PUBLIC_USER1_EMAIL` / `NEXT_PUBLIC_USER2_EMAIL`; placeholders in `.env.example` + `app/.env.staging.example`; real values appended to gitignored `app/.env.local` and `app/.env.staging` in both this worktree and the main checkout.
- SKIPPED: (sub-item) functions/.env.staging.example
  Functions never read these emails — they resolve users from the Sheets `Users` tab (`USERS_TAB!A:C`), so no server-side var exists to document.
- DONE: Confirm no tracked file contains either literal email string after the change (grep the whole tracked repo, not just the two files touched), and that existing sign-in/user-lookup behavior is unchanged — same user resolves to the same id/name as before
  `git grep` over all tracked files returns no matches. Behavior proven by test, not by inspection (see below).

### Verification

- `tsc --strict` on `users.ts` compiles. This is itself the type proof: `DEFAULT_USER: UserId = "user1"` only compiles if `as const` still yields literal id types — had the env change widened `id` to `string`, this line would fail.
- 3 new behavior tests: `getUserByEmail` maps each email to the same `{id, name}` as the old table; unknown/empty/null emails return `null`; with the vars unset it fails closed rather than authorizing `""`. Each fails if the env plumbing returns a wrong or empty value for a known user.
- Build-inlining proof (the real check on the `NEXT_PUBLIC_` decision): `npm run build` with the vars set puts both emails in `out/_next/static/chunks/`; the same build with the two vars stripped puts zero. An unprefixed var would have produced zero in both cases and silently broken sign-in.
- Existing suite: 40/40 pass, no regressions.

### Summary

Both literals now come from `NEXT_PUBLIC_USER1_EMAIL` / `NEXT_PUBLIC_USER2_EMAIL`, defaulting to `""` so a missing var fails closed at sign-in. I also had to redact the two addresses from this entity file's own prose — it is tracked, so it would have kept them in the public repo and failed the stage's own grep criterion.

Three things the captain should weigh, none of which this stage can fix:

1. **This removes the emails from the public repo, not from the deployed app.** `NEXT_PUBLIC_` vars are inlined into the static bundle at build time, so both addresses remain readable in the shipped JS by anyone who visits the site. The stated threat (public GitHub remote) is closed; browser-visible exposure is unchanged and is inherent to doing authorization client-side. Only moving the check server-side would close that.
2. **A missing var builds green and breaks sign-in silently** — the negative build above exited 0 with empty emails. Deploying without setting the vars locks everyone out. I left it failing-closed rather than adding an unrequested build-time guard.
3. `AUTHORIZED_EMAILS_STUB` is dead code — declared, never read; `isAuthorizedEmail` returns `true` unconditionally. I pointed it at the env var as the spec directs rather than deleting it, but deleting it is the honest cleanup if the captain wants it.

Git history still contains both addresses, per the spec's Out of Scope.

## Stage Report: verify

Verdict: PASSED — with one finding the captain should rule on (see Summary).

- DONE: Deploy to staging (or confirm via local production-mode build) and prove live that the app actually signs in correctly with the env vars set — not just that the build compiles
  Staging deploy was denied by the sandbox permission classifier (`firebase deploy --only hosting --project staging`), so I took the checklist's sanctioned fallback: a real production build from `app/.env.staging`, served over HTTP at `127.0.0.1:8801`. Live responses: `/`, `/sign-in.html`, `/settings/users.html`, `/history.html` → HTTP 200 `text/html`; `/manifest.json` → 200 `application/json`; the email-bearing chunk `04-l-9gpp3pun.js` → 200, and it is a direct `<script>` tag on the served sign-in page, so a browser really loads it.
  Gate proven by execution, not inspection: extracted webpack module `89299` from the chunk **fetched over HTTP** and ran the shipped `getUserByEmail` under a runtime with no `globalThis.process`, so the bundle's own process polyfill takes the browser path. Real USER1 → `{id:user1,name:ijac}`, real USER2 → `{id:user2,name:wei}`; `stranger@example.com`, `""`, `null`, `undefined` → all rejected. Fails if the env plumbing yields a wrong or empty value for a known user.
  Not covered: the Google OAuth round-trip. No browser exists in this sandbox and I cannot authenticate as either household member — captain manual test in Summary.
- DONE: Re-confirm the build-inlining claim independently: the deployed/built bundle actually contains the emails when vars are set, and that a missing var truly fails closed (locks out) rather than silently allowing an empty-email sign-in
  Vars set: sweeping every chunk the sign-in page loads, each address appears exactly once, in `04-l-9gpp3pun.js` alone. Vars stripped: the same sweep returns zero, and zero anywhere in `out/`. Cross-check confirmed the two builds are distinct artifacts, not one directory served twice.
  Fail-closed proven on the artifact: the vars-stripped build compiles to a *runtime* lookup (`process.env.NEXT_PUBLIC_USER1_EMAIL ?? ""`), not an inlined `""` — a structural difference the build report did not surface. Under the browser-faithful runtime both fields resolve to `""` and every input is rejected, including `""`, with no throw. So a missing var locks everyone out cleanly rather than admitting a blank-email session *or* white-screening on load.
  Build's warning confirmed: the vars-stripped `npm run build` exited 0 with no error or warning.
- DONE: Mandatory PII/secrets check: confirm no tracked file, including this entity's own history if checkable, leaks either literal email going forward
  `git grep` at branch HEAD: 0 files for either address. The one new commit (`8dafca7`) adds 0 occurrences and removes 5 across 4 lines (`users.ts` 2, `auth.ts` 1, this entity's prose 1).
  Only `.env*.example` templates are tracked — no real `.env` — and their two new keys hold empty / `TODO_` placeholders. Secrets sweep over every added line: 0 hits for Google API keys, private keys, `sk-`/`ghp_` tokens, passwords, client secrets, service accounts, phone numbers. The only emails in added lines are `user-one@example.com`, `user-two@example.com`, `stranger@example.com` — test placeholders.
  Finding (see Summary): commit `394dedc`, already on `origin/main`, added both real addresses to `workflow/052-email-env-vars.md`.

### Verification notes

- 44/44 tests pass. Worktree clean: I reverted `app/public/manifest.json`, which the staging `prebuild` step rewrites — a pre-existing footgun where building for staging dirties a tracked file that drives the production PWA manifest.
- Confirmed the blast radius is one call site: of 12 `lib/users` importers only `lib/authContext.tsx:44` reads `.email`; the rest use `id`/`name`. `settings/users/page.tsx` renders emails fetched from `/api/users` (Sheets), unaffected.
- `isAuthorizedEmail` has no callers and `AUTHORIZED_EMAILS_STUB` is never read, so the `auth.ts` edit is inert at runtime — corroborated by USER1 appearing exactly once in the bundle rather than twice, i.e. the dead constant was tree-shaken.

### Summary

Both addresses are gone from tracked source, the shipped bundle resolves each to the same `{id, name}` the hardcoded table produced, and a missing var locks everyone out cleanly instead of authorizing a blank email — all proven by executing the real built chunks fetched over HTTP, not by reading code.

One finding the captain should rule on, which this stage cannot fix: **filing this entity leaked the thing the entity exists to protect.** Commit `394dedc` ("file+dispatch: 052") wrote both real addresses into `workflow/052-email-env-vars.md`, and that commit is already on `origin/main` at the public `github.com/ijac13/expense-sheet`. Build later redacted the prose so HEAD is clean, and history scrubbing is formally Out of Scope — but that call was made about *old* `users.ts` commits, not about a fresh commit this workflow itself pushed. Same decision, new facts.

Two limits on this verification: staging was never exercised (deploy denied by the permission classifier), and with no browser available the Google sign-in round-trip is unproven. Captain manual test, once deployed with both vars set:

1. Open the app and tap sign in; complete Google sign-in as user1 → you should land in the app, not the "unauthorized" state.
2. Sign out, repeat as user2 → same result.
3. Before any production deploy, confirm `NEXT_PUBLIC_USER1_EMAIL` and `NEXT_PUBLIC_USER2_EMAIL` are set in that build environment — without them the build still succeeds and silently locks both of you out.
