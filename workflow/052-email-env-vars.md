---
id: 052
title: Move Hardcoded Personal Emails to Environment Variables
status: build
source: captain
started: 2026-08-18T03:07:29Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-052-email-env-vars
issue:
pr:
---

`app/app/lib/users.ts` and `app/app/lib/auth.ts` have two real personal email addresses hardcoded directly in committed source — `ijac.wei@gmail.com` (the captain) and `wei7780@gmail.com` (the second household user, "wei"). This repo's GitHub remote is public, so both are currently exposed to anyone. Every other secret in this repo (Firebase keys, service-account credentials, spreadsheet IDs) already goes through environment variables, gitignored `.env*` files, and `.env*.example` placeholders — these two emails are the one place that pattern wasn't followed.

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
