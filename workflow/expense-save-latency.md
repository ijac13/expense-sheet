---
id: "037"
title: Expense Save — Optimistic UI Update
status: verify
source: captain observation
started: 2026-05-11T04:11:34Z
completed:
verdict:
score: 0.85
worktree: .worktrees/spacedock-ensign-expense-save-latency
issue:
pr:
---

When saving an expense, the record should appear in the webapp immediately — before the Google Sheet write completes. A few seconds of latency before the Sheet reflects it is fine. The UI must not make the user wait for the round trip.

## Current behaviour

`handleConfirm` in `app/app/page.tsx` does:
1. `await addExpense(...)` — POST to Cloud Function → writes to Sheet (slow)
2. `await getTodayExpenses()` — GET from Sheet (slow)
3. `setExpenses(updated)` — only then updates UI

The user sees no feedback until both round trips complete.

## Desired behaviour

1. Tap Save → record appears in UI immediately (optimistic local state update)
2. "✓ Saved" indicator shows straight away
3. Sheet write fires in background
4. On success: replace optimistic entry with server-confirmed data
5. On failure: roll back the optimistic entry, show error

## Acceptance Criteria

- **AC-1** Record appears in the "today's expenses" count and list immediately after tapping Save, without waiting for the API response
- **AC-2** The "✓ Saved" flash shows immediately on tap, not after the API round trip
- **AC-3** If the API call fails, the optimistic entry is removed and an error is shown — no silent data loss
- **AC-4** Once the API call succeeds, the UI reflects the server-confirmed record (correct id, date, etc.)
- **AC-5** No regression on the amount/note/category reset behaviour after save
