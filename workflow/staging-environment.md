---
id: "028"
title: Staging Environment Setup
status: build
source: captain
started: 2026-05-01T09:19:14Z
completed:
verdict:
score: 1.0
worktree: .worktrees/spacedock-ensign-staging-environment
issue:
pr:
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
