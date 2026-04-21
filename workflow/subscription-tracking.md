---
id: "004"
title: Subscription Tracking
status: spec
source: commission seed
started: 2026-04-21T00:00:00Z
completed:
verdict:
score: 0.9
worktree:
issue:
pr:
---

Recurring expenses (Netflix, Spotify, rent, etc.) are real spending too. I don't want to manually log them every month. Define a subscription once — name, amount, category, frequency (monthly or annual), and which day it fires — and the system automatically creates a confirmed expense entry on that day every cycle. No expiry, no pending state, no confirmation needed. It runs forever until cancelled. It just appears in the expense list as if I logged it.

## User Stories

- As a user, I want to define a recurring expense once so I never have to manually log it each cycle
- As a user, I want to see all my active subscriptions in one list so I know what's running
- As a user, I want to cancel a subscription so it stops creating entries without losing the record
- As a user, I want to create a new subscription when the amount changes so past entries stay accurate

## Success

- Subscriptions tab shows all active subscriptions with name, amount, category, frequency, next due date
- Adding a subscription creates a row in the Subscriptions tab; `paid_by` is set to whoever creates it
- When a subscription is due, Google Apps Script automatically creates a confirmed expense row in the Expenses tab — no manual action needed
- The auto-created expense appears in the Home today list and History exactly like a manually logged expense
- Cancelling a subscription sets `is_active: false` — stops future entries, record is preserved
- When an amount changes: cancel the old subscription and create a new one — past entries retain the old amount, future entries use the new one

### Out of Scope

- Variable amounts — subscriptions have a fixed amount; create a new subscription to change the amount
- Pausing a subscription — only cancellation is supported
- Reminders or notifications before a subscription fires
- End dates or expiry — subscriptions run until cancelled, no end date
- Retroactively creating missed entries
- Approval or review before an entry is created — it fires and confirms automatically
- Viewing all past entries for a subscription — use History filter (entity 013)

## Plan

### Data Model

Defined in `project-setup.md` Subscriptions tab:

| Field | Notes |
|-------|-------|
| `id` | Stable identifier |
| `name` | e.g. "Netflix", "Rent" |
| `amount` | Fixed amount in TWD |
| `category_id` | Reference to Categories tab |
| `frequency` | `monthly` or `annual` |
| `due_day` | Required — day of month to fire (1–31) |
| `due_month` | Month for annual only (1–12) |
| `paid_by` | User email of who pays |
| `is_active` | `true` = running; `false` = cancelled |

### Subscriptions Tab (app)

List of all subscriptions. Each row shows: name, amount, category icon, frequency, next due date, paid by.

Actions per row:
- Tap to edit (name, category, due date only — not amount)
- Cancel button (sets `is_active: false`)

"+ Add subscription" button at top.

### Add / Edit Form

Fields: name, amount, category (picker), frequency (monthly/annual), due day, paid by.

### Scheduler (Google Apps Script)

A time-based trigger runs daily. For each active subscription where today matches the due date:
1. Create a new confirmed row in Expenses tab
2. Set `subscription_id` to link back to the subscription
3. Set `created_by` to the subscription's `paid_by` user

### What "due" means

- Monthly: fires on `due_day` every month (e.g., day 1 = fires on the 1st of each month)
- Annual: fires on `due_day` of `due_month` each year
- If `due_day` is 31 and the month has fewer days, fires on the last day of the month
