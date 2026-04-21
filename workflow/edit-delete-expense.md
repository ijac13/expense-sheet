---
id: "010"
title: Edit and Delete Expense
status: ideation
source: commission seed
started:
completed:
verdict:
score: 0.8
worktree:
issue:
pr:
---

Sometimes an expense is logged with the wrong amount, wrong category, or wrong date. Users need to be able to fix or remove entries from both the app and directly in the Google Spreadsheet.

## User Stories

- As a user, I want to edit a past expense so I can correct a mistake without deleting and re-entering it
- As a user, I want to delete an expense so I can remove a duplicate or an entry that shouldn't exist
- As a user, I want changes made in the app to be reflected in the Google Spreadsheet immediately

## Success

- Tapping an expense in the today list or History opens an edit screen pre-filled with its values
- All fields are editable: amount, category, date, paid by, notes
- Saving updates the row in the Expenses tab
- Deleting removes the row from the Expenses tab
- Changes made directly in the Google Spreadsheet are reflected in the app on next read

### Out of Scope

- Editing auto-generated subscription expenses differently from manual ones — same edit flow
- Bulk edit or delete
- Undo after delete
- Edit history or audit log

## Plan

### Entry Point

From the today list (Home) or History: tap any expense row → opens edit screen.

### Edit Screen

Same layout as the entry form (entity 002), pre-filled with the expense's current values. "Save" updates the row. "Delete" removes it with a confirmation dialog.

### Confirmation on Delete

Single confirmation: "Delete this expense?" with Cancel and Delete buttons. No undo.

### Writes to Spreadsheet

- Edit: Firebase Function updates the matching row by `id`
- Delete: Firebase Function removes the matching row by `id`

## Open Questions

- **Who can edit whose expenses?** — can each user only edit their own entries, or can either user edit any expense?
- **Delete confirmation** — is one tap enough, or should delete require an extra step (e.g., swipe to reveal delete button)?
- **Subscription expenses** — can auto-generated subscription entries be edited or deleted from the app, or are they read-only?
