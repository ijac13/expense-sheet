---
id: "059"
title: Subscriptions — Add Notes and Search
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

Add a notes field to subscriptions and a search function on the Subscriptions page, so it's easier to record context on a subscription and find one quickly as the list grows.

## User Stories

- As the captain, I want to add a free-text note to a subscription, so I can record context (why it exists, when to cancel, plan details) that doesn't fit in the existing fields.
- As the captain, I want to search the Subscriptions page by name (and possibly note content), so I can find a specific subscription quickly instead of scrolling the full list.

## Success

- Each subscription can have an optional notes field, editable from the Add/Edit form.
- Notes are visible somewhere on the subscription (list item and/or detail view) without cluttering the default list.
- A search input on the Subscriptions page filters the list live as you type.
- Existing subscriptions (no note set) are unaffected — notes field starts empty, search matches everything until typed into.

### Out of Scope (decide at spec time)

- Whether notes are searchable, or search is name-only
- Any notes/search feature on other pages (Expenses, Categories, Reports)
- Rich text or formatting in notes — plain text only unless spec decides otherwise

## Plan

To be filled in at spec time: where notes lives in the Google Sheet schema (new column vs. reuse), whether it needs migration handling like entity 053/054's column additions, and where search fits in the existing Subscriptions page layout.
