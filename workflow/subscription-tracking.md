---
id: "004"
title: Subscription Tracking
status: verify
source: commission seed
started: 2026-04-21T00:00:00Z
completed:
verdict:
score: 0.9
worktree: feature/004-subscription-tracking
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

## Spec

### Goal

Allow users to define a recurring expense once — with a fixed amount, category, frequency, and due day — so the system automatically creates a confirmed expense entry on each cycle without any manual action.

### User Stories

- As a user, I want to define a recurring expense once so that it appears in my expense history every cycle without manual logging.
- As a user, I want to see all my active subscriptions in one list so that I know what recurring charges are running.
- As a user, I want to cancel a subscription so that it stops generating future entries while preserving the historical record.
- As a user, I want to create a new subscription when the amount changes so that past entries remain accurate and future entries reflect the new amount.

### Acceptance Criteria

- [ ] A Subscriptions tab exists showing all subscriptions (active and cancelled) with columns: name, amount, category, frequency, next due date, paid by, status.
- [ ] An "Add subscription" action opens a form with fields: name, amount, category (picker), frequency (monthly/annual), due day (1–31), and due month (1–12, annual only). `paid_by` is set automatically to the creating user.
- [ ] Submitting the add form creates a new row in the Subscriptions tab with `is_active: true`.
- [ ] Each subscription row has an edit action that allows changing name, category, and due date only — amount and frequency are not editable on an existing subscription.
- [ ] Each subscription row has a cancel action that sets `is_active: false` on that row.
- [ ] A cancelled subscription no longer appears as active and the scheduler skips it.
- [ ] The Google Apps Script daily trigger runs once per day and, for each active subscription where today matches the due date, creates a confirmed expense row in the Expenses tab with: amount, category, name as description, `subscription_id` linking back to the subscription, `created_by` set to `paid_by`, and `confirmed: true`.
- [ ] The auto-created expense row appears in the Home today list and in History exactly as a manually logged confirmed expense would.
- [ ] For a monthly subscription with `due_day: 1`, an expense is created on the 1st of every month.
- [ ] For an annual subscription with `due_day: 15` and `due_month: 3`, an expense is created on March 15 each year.
- [ ] If `due_day` is 31 and the current month has 30 days or fewer, the scheduler fires on the last day of that month instead.
- [ ] The Subscriptions tab data model stores: `id`, `name`, `amount`, `category_id`, `frequency`, `due_day`, `due_month` (annual only), `paid_by`, `is_active`.

### Edge Cases

- `due_day: 31` in a 30-day month (April, June, September, November): scheduler fires on the 30th.
- `due_day: 31` in February (28 or 29 days): scheduler fires on the 28th (or 29th in a leap year).
- Annual subscription with `due_day: 29` and `due_month: 2` in a non-leap year: scheduler fires on February 28.
- Cancelling a subscription on the same day it already fired: the expense for today was already created and is not removed; cancellation only stops future cycles.
- Creating a subscription with the same name as an existing subscription (active or cancelled): allowed — no uniqueness constraint on name. Both rows coexist and both (if active) fire independently.
- Two users creating a subscription at the same time: each creates their own row; no merge or deduplication occurs.
- The daily trigger runs but the sheet is unavailable or throws an error: the trigger should log the failure; no partial writes; retry on the next run is the next day's natural trigger.

### Out of Scope

- Variable or inflation-adjusted amounts — subscriptions have a fixed amount; change by cancelling and creating a new one.
- Pausing a subscription — only cancellation (`is_active: false`) is supported.
- Reminders or notifications before a subscription fires.
- End dates or expiry — subscriptions run until explicitly cancelled.
- Retroactively creating missed entries if the trigger did not run.
- Approval or pending state before an expense is created — all subscription-generated expenses are immediately confirmed.
- Viewing all historical expense entries for a specific subscription — use History filter (entity 013).
- Subscription sharing or splitting between users — `paid_by` is the single creating user.

## Stage Report: spec

- DONE: Read entity file and README spec template
  Source: `/Users/ijac/Claude-ijac/expense-sheet/workflow/subscription-tracking.md` and `workflow/README.md`
- DONE: Wrote `## Spec` section with Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope
  All key decisions from dispatch incorporated; all four edge cases from brief covered; acceptance criteria are binary and testable
- DONE: Appended `## Stage Report: spec` section
  Appended at end of file per protocol

### Summary

Converted the ideation and plan content into a formal spec covering 12 acceptance criteria, 7 edge cases, and 8 out-of-scope items. Key design decisions encoded: `paid_by` auto-set to creating user, `due_day` required, no expiry, cancel-only, amount changes via new subscription, editable fields limited to name/category/due date, scheduler creates confirmed expenses directly.
