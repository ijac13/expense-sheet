---
id: "017"
title: Firebase Functions — Data Persistence to Google Sheets
status: verify
source: captain feedback
started: 2026-04-22
completed:
verdict:
score: 1.0
worktree:
issue:
pr:
---

Captain repeatedly asks when data entered in the app will appear in the `expense-sheet-staging` Google Sheet. Currently all expense writes call `console.log` stubs — data is lost on page refresh and never reaches the spreadsheet.

## Spec

### Goal

Wire the expense entry form to a Firebase Cloud Function that reads and writes the `expense-sheet-staging` Google Sheet, so submitted expenses persist across sessions and appear in the spreadsheet immediately.

### User Stories

- As a user, I want my submitted expenses to persist after page refresh so I can trust the app is recording my spending.
- As a user, I want the History and Reports pages to show real data from Google Sheets, not hardcoded mock rows.
- As ijac, I want to open `expense-sheet-staging` in Google Sheets and see every row my partner and I submit from the app.

### Acceptance Criteria

- [ ] Submitting an expense on the Home page writes a new row to the `Expenses` tab in `expense-sheet-staging`
- [ ] History page reads all expense rows from Google Sheets (replaces `historyService.ts` mock)
- [ ] Reports page reads from Google Sheets (replaces `reportService.ts` mock)
- [ ] Home page "X logged today" count reflects real data, including rows submitted in past sessions
- [ ] Data persists after page refresh — submitted rows remain visible in History
- [ ] No regression on expense entry UI flow (amount, category, date, payer, notes)
- [ ] `helloWorld` function still works (existing health check not broken)

### Architecture

**Auth:** Use Application Default Credentials (ADC). Firebase Functions automatically have an identity as the project's default service account (`expense-sheet-b2db8@appspot.gserviceaccount.com`). No key files needed in code — captain must share the Google Sheet with this email address.

**Endpoints (HTTP Cloud Functions):**
- `GET /api/expenses` — reads all rows from `Expenses` tab, returns JSON array
- `POST /api/expenses` — appends one row, returns the created expense with server-assigned ID

**Sheet columns (Expenses tab):** `id | date | amount | category_id | paid_by | created_by | notes | created_at`

**Config:** `SPREADSHEET_ID` env var in `functions/.env` (Firebase Gen 2 convention).

**Hosting rewrite** (`firebase.json`): add `/api/**` → `{function: "api"}` rule before the catch-all `**` rule.

### Manual Setup (Captain Does Once)

1. Open `expense-sheet-staging` → Share → add `expense-sheet-b2db8@appspot.gserviceaccount.com` as **Editor**
2. Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
3. Create `functions/.env` with: `SPREADSHEET_ID=<paste id here>`
4. Ensure `Expenses` tab exists with header row: `id,date,amount,category_id,paid_by,created_by,notes,created_at`

### Edge Cases

- Network failure on submit — show error toast, do not clear amount field
- Google Sheets API rate limit or error — return 503, frontend shows error
- Empty sheet (only header row) — History shows empty state, no crash
- Duplicate row on double-tap submit — frontend disables button while in-flight

### Out of Scope

- Firebase Auth token gating on function calls (phase 2)
- Subscription persistence (entity 004)
- Edit/delete via functions (entity 010)
- Real-time listeners or Firestore
- Offline queue / sync

## Stage Report: build

- DONE: Add `googleapis` to functions
  `npm install googleapis` succeeded; `functions/node_modules/googleapis` present; `functions/package.json` updated.
- DONE: Rewrite `functions/src/index.ts` with v2 `onRequest` api function
  `api` export uses `firebase-functions/v2/https`; handles GET (read all rows) and POST (append row); CORS headers set; `helloWorld` preserved. `npm run build` passes.
- DONE: Update `firebase.json` with `/api/**` rewrite before catch-all
  Rewrite `{"source": "/api/**", "function": "api"}` inserted before `**` rule.
- DONE: Replace `addExpense()` with async POST to `/api/expenses`
  `app/app/lib/expenses.ts` — `addExpense` returns `Promise<Expense>`; `getTodayExpenses` is async.
- DONE: Replace `getAllExpenses()` with async GET in `historyService.ts`
  `historyService.ts` rewritten to fetch from API, sorted by date desc.
- DONE: Replace mock data source in `reportService.ts`
  All three export functions (`getMonthlySummary`, `getAnnualSummary`, `getExpensesByCategory`) now call `fetchAllExpenses()` from API; aggregation logic preserved.
- DONE: Update `page.tsx` with async `handleConfirm`, submitting state, error state
  `handleConfirm` is async; `submitting` useState disables both buttons in-flight; inline error display + alert on failure; `getTodayExpenses` loaded via `useEffect`.
- DONE: Update `history/page.tsx` with `useEffect` async load
  `getAllExpenses()` called in `useEffect`; loading spinner shown while fetching; empty state on error.
- DONE: Build functions — `npm run build` passes with no errors
  Clean TypeScript compile; output in `functions/lib/`.
- DONE: Build frontend — `npm run build` passes with 14 static pages
  Next.js static export succeeds; no TypeScript errors.
- FAILED: Deploy functions to Firebase
  Project `expense-sheet-b2db8` is on Spark (free) plan; Cloud Functions require Blaze (pay-as-you-go). Firebase blocked deploy with: "Required API cloudbuild.googleapis.com can't be enabled until the upgrade is complete." Captain must upgrade at https://console.firebase.google.com/project/expense-sheet-b2db8/usage/details then re-run `firebase deploy --only functions,hosting`.
- DONE: Deploy hosting
  `firebase deploy --only hosting` succeeded; frontend at https://expense-sheet-b2db8.web.app (warns about missing api function endpoint as expected).
- SKIPPED: Smoke-test curl verification
  Skipped because functions deploy blocked by billing gate. Cannot verify until captain upgrades to Blaze and deploys functions.

### Summary

All code is complete and committed (commit `4c7fa96`). The Firebase Function (`api`) handles GET/POST for `/api/expenses` using Application Default Credentials with the Sheets API. Frontend stubs across four files have been replaced with real async API calls with loading and error states. The only remaining blocker is a Firebase billing gate: the project must be upgraded to the Blaze plan before Cloud Functions can be deployed. The captain should upgrade the project, then run `firebase deploy --only functions,hosting` from the project root.
