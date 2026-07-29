---
id: 040
title: Tap to Edit Expense in Reports Drill-Down
status: ideation
source: captain feedback screenshot (feedback-screenshots/click to edit expense in history.png)
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Tapping an expense row inside a Reports category drill-down does nothing today — Home and History already open the edit screen (entity 010) when you tap a row, but the same tap in a Reports drill-down (entity 005) is dead, so a user who spots a mistake while reviewing a report has to go hunt down the same expense in History to fix it.

## User Stories

- As a user, I want to tap an expense row in a Reports category drill-down so I can edit it right there, instead of having to find the same expense in History.
- As a user, I want the exact same edit behavior I already get from Home and History (pre-filled fields, subscription warning, delete confirmation) so editing feels consistent everywhere an expense row appears.

## Success

- Tapping any expense row in the Reports category drill-down screen (entity 005) opens the same edit screen used by Home and History (entity 010), pre-filled with that expense's values.
- Save, delete, and the subscription-generated warning banner all behave identically to entity 010 — no new edit logic, just a new entry point into it.
- After a save or delete from this entry point, the drill-down list and the report totals refresh to reflect the change.
- Leaving the edit screen (back / cancel / save) returns to the drill-down list, not the top-level report.

### Out of Scope

- Any change to report aggregation, charts, or period/payer filters (entity 005)
- Any change to edit/delete behavior itself beyond wiring this new entry point (entity 010 already defines it)

## Plan

Reuse the existing edit screen and Firebase Function write path built for entity 010. Wire the drill-down list's row tap handler (entity 005) to open it, pre-filled with the tapped row's expense — same pattern as the Home and History entry points.
