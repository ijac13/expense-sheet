---
id: "009"
title: Multi-Currency Support
status: ideation
source: commission seed
started:
completed:
verdict:
score: 0.6
worktree:
issue:
pr:
---

Sometimes an expense happens in a foreign currency — while traveling, or paying for an international service online. The app's base currency is TWD, but forcing manual conversion before logging creates friction and loses the original amount.

## User Stories

- As a user, I want to log an expense in a foreign currency so I don't have to convert it manually before entering
- As a user, I want to see both the original amount and the TWD equivalent so I know what I actually paid
- As a user, I want reports to always show totals in TWD so comparisons are consistent

## Success

- Entry form has an optional currency selector (defaults to TWD)
- When a non-TWD currency is selected, a TWD equivalent field appears
- Both the original amount+currency and the TWD amount are stored
- Expense lists show the TWD amount; original currency shown as secondary info
- Reports always aggregate in TWD

### Out of Scope

- Automatic exchange rate fetching — user enters the rate or TWD equivalent manually
- Currency conversion history or rate tracking
- Changing the base currency from TWD

## Plan

### Data Model Changes

Add two columns to the Expenses tab:
- `original_amount` — the amount in the original currency (empty for TWD expenses)
- `original_currency` — the currency code (e.g., USD, JPY); empty for TWD expenses

The existing `amount` field always holds the TWD value.

### Entry Form

Currency selector next to the amount field, defaults to TWD. When a foreign currency is selected:
- First field: amount in foreign currency
- Second field: TWD equivalent (user enters manually)
- The TWD equivalent is stored as `amount`; original is stored in `original_amount` + `original_currency`

### Display

Expense rows: show `amount` (TWD) as primary. If `original_currency` is set, show original as secondary (e.g., "¥3,000 → NT$680").

## Open Questions

- **Which currencies to support?** — common ones only (USD, EUR, JPY, CNY, HKD) or a full list?
- **TWD equivalent entry** — should the user enter the TWD amount directly, or enter an exchange rate and have the app calculate it?
- **Entry form layout** — when foreign currency is selected, does the layout change (two amount fields) or does a separate "original amount" field appear alongside the main one?
- **Existing expenses** — if this feature is added after data already exists, do old expenses need any migration?
