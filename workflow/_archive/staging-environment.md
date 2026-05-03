---
id: "028"
title: Staging Environment Setup
status: done
source: captain
started: 2026-05-01T09:19:14Z
completed: 2026-05-03T09:04:17Z
verdict: PASSED
score: 1.0
worktree: 
issue:
pr: #2
mod-block: 
archived: 2026-05-03T09:04:23Z
---

Set up a proper staging environment so future changes can be tested before hitting production.

## Context

Production is `expense-sheet-b2db8` (Firebase project) wired to the production Google Sheet. The captain has already created a new Google Sheet with the correct tab structure (Expenses, Users, Subscriptions, Categories) for staging. What's missing: a Firebase staging project and the config to deploy to both environments.

## Spec

### Goal

Wire the codebase to support two deployment targets — `staging` and `production` — so `firebase deploy --project staging` and `firebase deploy --project production` both work correctly against their respective Google Sheets.

### What the worker needs to do

1. Update `.firebaserc` with named targets: `production` (existing `expense-sheet-b2db8`) and `staging` (placeholder — captain creates the Firebase project and provides the ID)
2. Create `functions/.env.staging` with the staging Spreadsheet ID (captain provides this)
3. Create `app/.env.staging` (or equivalent) with the staging Firebase config keys (captain provides after creating the Firebase project)
4. Update `app/.env.local` → rename or note it as the production env
5. Document deployment commands clearly: how to deploy to staging vs production
6. Leave a `STAGING_SETUP.md` checklist for the captain's remaining manual steps (create Firebase project in console, enable Google Auth, add both emails, run first deploy)

### Out of scope

- Creating the Firebase project itself (manual, captain does in console)
- Migrating data (entity 008)
- Setting up GCP billing guardrails (entity 027)

### Acceptance criteria

- **AC-1** `.firebaserc` has both `staging` and `production` named targets
- **AC-2** Env files exist for staging (with clear TODOs for captain to fill in project ID and Spreadsheet ID)
- **AC-3** `STAGING_SETUP.md` documents exactly what the captain needs to do manually and what commands to run
- **AC-4** Existing production config unchanged and still deployable

## Stage Report: build

- DONE: .firebaserc updated with both staging and production named targets
  `production: expense-sheet-b2db8`, `staging: TODO_STAGING_PROJECT_ID` — commit 868bfd5
- DONE: Staging env files created with clear TODOs for captain to fill in (project ID, spreadsheet ID, Firebase config keys)
  `functions/.env.staging.example` and `app/.env.staging.example` committed as templates; real `.env.staging` files are gitignored — commit 868bfd5
- DONE: STAGING_SETUP.md written — exact manual steps for captain plus deploy commands
  Covers: create Firebase project, create service account, fill env files, set ANTHROPIC_API_KEY secret, deploy to staging vs production — commit 868bfd5

### Summary

Recovered prior ensign's WIP and resolved a gitignore conflict: the template env files were being ignored before they could be committed. Fixed by renaming to `.env.staging.example` (real `.env.staging` stays ignored), adding a `!.env*.example` exception in `app/.gitignore`. All three checklist items are complete. The captain's remaining work is in `STAGING_SETUP.md`: create the Firebase staging project, set up a service account, fill in the example files, and run the first deploy.

## Stage Report: verify

- DONE: All four AC items confirmed present and correct in the worktree
  AC-1: `.firebaserc` has `production: expense-sheet-b2db8` and `staging: TODO_STAGING_PROJECT_ID`; AC-2: `functions/.env.staging.example` and `app/.env.staging.example` committed with TODO placeholders, real files gitignored; AC-3: `STAGING_SETUP.md` has 4-step manual checklist + deploy commands + post-deploy verification; AC-4: no changes to production keys or existing env files — build commit 868bfd5
- DONE: Production deploy path still works (no regressions to existing config)
  `.firebaserc` `default` key still points to `expense-sheet-b2db8`; change was additive only; existing `app/.env.local` untouched

### Summary

All four acceptance criteria pass against the codebase artifacts. The build was fully additive — no production config was modified. The only captain action required before staging is live: create the Firebase project, create a service account, fill in the two `.example` files, and run the first deploy per `STAGING_SETUP.md`.

## Stage Report: verify (cycle 2)

- DONE: Rewrote STAGING_SETUP.md with granular step-by-step instructions for all four steps
  Steps expanded: Firebase console nav paths, IAM service account creation, JSON key download, Sheets sharing, env copy commands, format examples, private key newline warning, secret command scope — see STAGING_SETUP.md

### Summary

Expanded STAGING_SETUP.md per captain's request: each step now includes exact console navigation paths, button labels, format examples for all env values, a private key newline warning, and a note that the ANTHROPIC_API_KEY secret only needs to be set once. Deploy commands and verification checklist were kept as-is. No structural changes — only existing steps were made more granular.
