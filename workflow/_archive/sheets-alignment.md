---
id: "022"
title: Google Sheets Alignment — Users and Subscriptions Tabs
status: done
source: captain feedback
started: 2026-04-25
completed:
verdict: PASSED
score: 0.8
worktree:
issue:
pr:
---

Two tabs in `expense-sheet-staging` are misaligned with the web app.

## Issues

1. **Users tab** — data in the Users tab does not match the User Management page in the app. The app uses a hardcoded `USERS` stub (`user1`/`user2`). The sheet's Users tab may have different data, different column names, or be empty. Fix: align the sheet schema with the app's user model, or wire the User Management page to read from the sheet.

2. **Subscriptions tab name** — the sheet tab is named something other than what the app calls it ("Recurring" in the tab bar). Rename the Google Sheet tab to match the app's terminology, or align both to a consistent name.

## Out of Scope

- Full user management (add/remove users from sheet) — that is part of entity 006 (Auth)
- Subscription writes to sheet — part of entity 004 (Subscription Tracking)

## Stage Report: build

- DONE: Add GET /api/users branch in functions/src/index.ts reading from Users sheet tab (columns A:C), returning {id, name, email}
  commit 8d089cf — functions build passes (tsc clean)
- DONE: Update app/app/settings/users/page.tsx to fetch from /api/users via useEffect with loading state
  commit 8d089cf — static USERS import removed, replaced with fetch + useState
- DONE: Rename t("tabs.subscriptions") from "Recurring" to "Subscriptions" in en/common.json
  commit 8d089cf — zh locale already said "訂閱" (Subscriptions), now EN matches
- DONE: Add Google Sheet tab name comment in app/app/lib/subscriptions.ts
  commit 8d089cf — comment states expected tab name "Subscriptions"
- DONE: Fix pre-existing type error in app/app/page.tsx (handleConfirm called with false)
  commit 8d089cf — required to make frontend build pass
- DONE: Build functions (tsc)
  clean compile, no errors
- DONE: Build frontend (next build)
  14/14 static pages generated, no type errors

### Summary

Added a `GET /api/users` endpoint to the Firebase Function that reads from the `Users` sheet tab and returns rows as `{id, name, email}` objects. Wired `settings/users/page.tsx` to fetch from this endpoint with loading state, replacing the hardcoded stub. Renamed the English tab label from "Recurring" to "Subscriptions" so the app label matches the expected sheet tab name, and added a clarifying comment in `subscriptions.ts`. Both builds pass clean.
