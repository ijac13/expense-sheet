---
id: "017"
title: Firebase Functions — Data Persistence to Google Sheets
status: ideation
source: captain feedback
started:
completed:
verdict:
score: 1.0
worktree:
issue:
pr:
---

Captain repeatedly asks when data entered in the app will appear in the `expense-sheet-staging` Google Sheet. Currently all expense writes call `console.log` stubs — data is lost on page refresh and never reaches the spreadsheet.

This entity covers the Firebase Functions backend layer that bridges the Next.js frontend to Google Sheets.

## What's Stubbed Today

- `addExpense()` in `app/lib/expenses.ts` — writes to localStorage only, logs to console
- `addSubscription()` / `updateSubscription()` / `cancelSubscription()` in `app/lib/subscriptionService.ts` — stubs
- Auth is Google provider configured but not active — sign-in flow is bypassed

## Required Work

1. **Firebase Functions setup** — create `functions/` project, configure `expense-sheet-staging` Google Sheets credentials via service account (`.env` at repo root already has `GOOGLE_SERVICE_ACCOUNT_*` keys)

2. **Write endpoint** — `POST /expenses` function that appends a row to the Expenses tab in the target Google Sheet

3. **Read endpoint** — `GET /expenses` that reads rows back so the app loads real data (needed for history, reports)

4. **Wire frontend** — replace localStorage stubs in `expenses.ts` with `fetch()` calls to the Firebase Function endpoints

5. **Auth gate** — optionally require Firebase Auth token on function calls (can defer to phase 2)

## Out of Scope (Phase 2)

- Multi-sheet support (one sheet per user)
- Offline-first with sync queue
- Real-time listeners (Firestore instead of Sheets)
- Edit/delete via functions (tracked in entity 010)
