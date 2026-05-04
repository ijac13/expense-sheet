---
id: "035"
title: New Category Not Persisted After Creation
status: spec
source: captain feedback
started: 2026-05-04T05:47:31Z
completed:
verdict:
score: 0.95
worktree:
issue:
pr:
---

Creating a new category appears to succeed (it shows up immediately in the list) but the category is not saved to the spreadsheet — it disappears on the next page load and never appears in the expense entry category picker.

## Evidence

`feedback-screenshots/category-003.png` (9:53) — Category management page shows "Cost from Rent 房客支出" at the bottom of the list, just after creation. Has an up arrow (↑) but no down arrow, confirming it was just appended.

`feedback-screenshots/category-004.png` (9:54) — Same page one minute later after navigating away and back. "Cost from Rent 房客支出" is gone. Last entry is "Other 其他" — the list reverted to the state fetched from the spreadsheet.

Tested on production (`expense-sheet-b2db8.web.app`).

## What's happening

The category is being added to local React state immediately (optimistic update), making it appear to succeed. But either:
- The API call to write the new category to the Google Spreadsheet is failing silently, OR
- The API call is never fired, OR
- The write succeeds but the row is written to the wrong location / wrong format so it's not read back correctly on the next fetch

When the page is navigated away and returned to, a fresh fetch from the spreadsheet loads — which doesn't include the new category.

The expense entry category picker also never shows the new category because it reads from the same spreadsheet source.

## Acceptance Criteria

- **AC-1** Creating a new category via the category management page writes a row to the Categories tab of the Google Spreadsheet
- **AC-2** After navigating away and returning to category management, the new category is still present in the list
- **AC-3** The new category appears in the expense entry category picker immediately after creation (on next page load or without needing a hard refresh)
- **AC-4** Creating a category with the same name as an existing one is handled gracefully (no silent failure, no duplicate)
- **AC-5** If the API call to save the category fails, the user sees an error — the optimistic update is rolled back or an error state is shown
