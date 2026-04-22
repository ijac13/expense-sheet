---
id: "016"
title: UI Fixes — Round 1 Captain Review
status: verify
source: captain review
started: 2026-04-22T08:00:00Z
completed:
verdict:
score: 1.0
worktree:
issue:
pr:
---

Fixes from captain's first full preview review. Three UI bugs and one UX regression to correct before gating the design entity to done.

## Issues

1. **Home trapped in Today list** — showList toggle means clicking the Home tab when already on `/` does nothing (no route change = no re-render). Captain can't get back to the Add Expense form from the Today list. Fix: remove the toggle entirely. Home is always the Add Expense form.

2. **Calculator hidden behind a sheet** — captain prefers the original layout where the keypad is always visible at the bottom and categories are scrollable above. The compact dock + bottom sheet is not the right flow for this app.

3. **History rows route to home** — `/expense/[id]` is a static export with only `mock-001/002/003` pre-generated. History mock IDs (`h1`, `h2`, …) don't exist as static pages; Firebase rewrites them to `index.html` (home). Fix: inline bottom sheet for expense detail — no separate route needed.

## Out of Scope

- Data persistence to Google Sheets — all writes are intentionally stubbed until Firebase Functions phase
- Edit/delete from detail sheet — read-only detail only for now
