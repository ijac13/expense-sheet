---
id: "017"
title: Firebase Functions — Data Persistence to Google Sheets
status: build
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

## Stage Report

_To be written by build agent._
