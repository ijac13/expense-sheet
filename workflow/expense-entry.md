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
- Category is selected from the grid and the selection is fast — defaults to the last used category
- Date defaults to today, editable if needed
- Paid by defaults to the logged-in user, editable if the other person paid
- Notes are optional and never required to save
- The expense is written to the Expenses tab in the Google Spreadsheet immediately
- Both users can log independently from their own phones and see each other's entries

### Out of Scope

- Editing or deleting an existing expense (entity 010)
- Recurring/subscription expenses (entity 004)
- Category management — creating or editing categories (entity 003)
- AI category suggestion — users pick the category manually; no suggestion needed

## Plan

### Home Screen

The home screen opens directly to the entry UI — calculator ready, no extra tap needed. Date and paid by are pre-filled with defaults, so the common case is: type amount → pick category → confirm.

After confirm → today's expense list (the new entry is visible at the top)
After cancel → today's expense list

### Entry Flow

Amount → Category → Confirm (date and paid by pre-filled; notes optional and tucked away)

The common case takes 3 taps or fewer. Date and paid by are always visible but never blocking.

### Amount Input

- Numeric keypad, large touch targets
- Supports simple arithmetic: `+`, `-`, `*`, `/` and `()`
- Expression evaluates on confirm (e.g., `120+80` → `200`)
- Amount is in TWD

### Fields

| Field | Default | Editable? | Required? |
|-------|---------|-----------|----------|
| amount | — | yes | yes |
| category_id | last used category | yes | yes |
| date | today | yes | yes |
| paid_by | logged-in user | yes | no |
| notes | empty | yes | no |

### Today's Expense List

Shown after confirm or cancel. Shows all expenses for today regardless of who recorded them.

**Header:**
- Date (e.g., "April 18")
- Total amount for today (e.g., "NT$2,450")

**Each row (sorted by expense time, most recent first):**
- Category icon + category name
- Amount
- Notes in smaller font below the category (only shown if notes exist)

### Writes to Spreadsheet

On save, a Firebase Function creates a new row in the Expenses tab:
- `id` — auto-generated
- `created_by` — logged-in user's email (auto-filled, not editable)
- `created_at` — current timestamp (auto-filled, not editable)
- `status` — always `confirmed`
