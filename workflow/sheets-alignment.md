---
id: "022"
title: Google Sheets Alignment — Users and Subscriptions Tabs
status: ideation
source: captain feedback
started:
completed:
verdict:
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
