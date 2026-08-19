---
id: 053
title: Add Start/End Dates to Subscriptions
status: ideation
source: captain
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Subscriptions currently store one amount, one category, one due day — but real subscriptions change price over time (YouTube's record says NT$497 today, but 17 months of actual logged payments were NT$399; Netflix's record says NT$380, actual logged history is NT$560). Editing a subscription's amount to reflect today's real price silently overwrites the only record of what it used to cost, and — found live while working entity 051 — breaks history-matching tools that key off the current amount: changing 0981811423's amount from 850 to 499 today made its own 16 months of NT$850 history invisible to matching by amount, because there's only ever one amount on file.

Captain's direct instruction: add a start date and end date to each subscription.

- End date defaults to null — an active subscription has no end date.
- When a subscription is archived (deactivated), the app asks for its end date, defaulting to the date it's archived.

## User Stories

- As the captain, I want to change a subscription's price without erasing what it used to cost, so entity 051-style historical analysis stays accurate after a price change.
- As the captain, I want an archived subscription to record when it actually ended, not just that it's inactive, so history isn't ambiguous about which months it was really running.
- As the user, I'll end the subscription if the price change and create a new subscription with the new price. 

## Success

- Each subscription carries a start date and an end date (nullable).
- Archiving a subscription prompts for an end date, pre-filled with today's date, editable before confirming.
- An active subscription's end date is null.

### Out of Scope

- Multiple price periods / full price-change history per subscription (e.g. "NT$399 from Jan 2025, NT$497 from Jul 2026") — this entity is just start/end date, not a price-history log. A follow-up can revisit whether price changes need their own dated record, informed by how much 051's backfill actually needed it.
- Retroactively backfilling start/end dates for existing subscriptions — a separate data-entry pass, not this entity's build.
- Changing entity 050's scheduler or 051's backfill logic to use these new dates — future work can use them once they exist.
