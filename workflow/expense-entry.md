---
id: "002"
title: Expense Entry
status: ideation
source: commission seed
started:
completed:
verdict:
score: 1.0
worktree:
issue:
pr:
---

This is the feature the whole app exists for. Every time money is spent, it gets logged immediately on the phone. If this isn't fast and easy enough to become a habit, nothing else matters.

## Success

A user can open the app, log an expense, and be done in a few taps:

- Amount input works like a calculator — supports simple math (`50+30`, `200-15`) to finalize the amount before confirming
- Category is selected from the grid and the selection is fast
- Date defaults to today, editable if needed
- Paid by defaults to the logged-in user, editable if the other person paid
- Notes are optional and never required to save
- The expense is written to the Expenses tab in the Google Spreadsheet immediately
- Both users can log independently from their own phones and see each other's entries

### Out of Scope

- Editing or deleting an existing expense (separate concern)
- Recurring/subscription expenses (entity 004)
- Category management — creating or editing categories (entity 003)

## Plan

### Entry Flow

Amount → Category → Confirm (with optional: date, paid by, notes)

The common case — amount and category — should take 3 taps or fewer. Everything else is optional and secondary.

### Amount Input

- Numeric keypad, large touch targets
- Supports simple arithmetic: `+`, `-`, `*`, `/`
- Expression evaluates on confirm (e.g., `120+80` → `200`)
- Amount is in TWD

### Fields

| Field | Default | Editable? | Required? |
|-------|---------|-----------|----------|
| amount | — | yes | yes |
| category_id | — | yes | yes |
| date | today | yes | yes |
| paid_by | logged-in user | yes | no |
| notes | empty | yes | no |

### Writes to Spreadsheet

On save, a Firebase Function creates a new row in the Expenses tab:
- `id` — auto-generated
- `created_by` — logged-in user's email (auto-filled, not editable)
- `created_at` — current timestamp (auto-filled, not editable)
- `status` — always `confirmed`
