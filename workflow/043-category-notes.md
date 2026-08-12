---
id: 043
title: Category Notes — Tooltip on Home
status: spec
source: captain
started: 2026-08-12T04:41:49Z
completed:
verdict:
score:
worktree:
issue:
pr:
---

Categories get ambiguous over time — what's the real difference between "Daily Necessities" and "Other," or why "Digital" covers phone bills. A short note attached to each category, set once, would let the captain remember the intended meaning instead of guessing from old entries months later.

## User Stories

- As the captain, I want to attach a short note to a category (e.g. "phone/internet bills, subscriptions") explaining what it's for, so I don't second-guess myself when logging or reviewing later.
- As the captain, when I tap a category on the Home screen, I want to see that note as a tooltip, so the reminder shows up right where I'm choosing a category, not buried in Settings.

## Success

- Each category (entity 003's Category Management) has an optional free-text note field, editable the same way name/icon/gov_category are edited today.
- Tapping a category on Home shows its note in a tooltip/popover, when one is set.
- A category with no note shows no tooltip — the field is optional, not required for every category.

### Out of Scope

- Per-expense notes — that's the existing `notes` field on an expense (entity 002/010). This is category-level, not expense-level.
- Showing the tooltip anywhere besides Home (Reports, History, Settings) — scope this to Home first.
- Rich text or images in the note — plain text only.

## Plan

Add a `note` field to the Categories tab and the `Category` type, editable via the existing Category Management edit form (entity 003's pattern). On Home, tapping a category today is already the quick-entry selection action — spec needs to decide how the tooltip triggers without conflicting with that (long-press, a small info icon, etc.), rather than assuming tap alone can do both jobs.
