---
id: 046
title: Calendar-Style Date Picker (Home, History, Reports)
status: spec
source: captain
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Tapping a date field on Home, History, or Reports today uses whatever basic date input each screen currently has. Replace it with a calendar-style picker modal — like Google Calendar's — so picking a date is visual: see the month grid, step left/right between months, and jump to a year view for fast long-distance navigation.

## User Stories

- As the captain, I want to tap a date field on Home, History, or Reports and see a calendar modal, so I can visually pick a date instead of typing or stepping through one at a time.
- As the captain, I want to move the calendar left/right to change months, so I can quickly get to a nearby date.
- As the captain, I want to tap the month/year label to jump into a year view, so I can get to a date months or years away without repeated clicking.

## Success

- Tapping a date field on Home, History, and Reports opens a calendar modal instead of today's input.
- The calendar shows the current month with the selected date highlighted.
- Left/right arrows step one month at a time.
- Tapping the month/year label switches to a year-select view; picking a year returns to the month view for that year.
- Picking a day closes the modal and sets that date on the field that opened it.
- One shared component behind all three entry points — not three separate implementations.

### Out of Scope

- Changing what happens after a date is picked (existing logic per screen is untouched)
- Date-range selection (this is single-date picking; a report date-range picker, if wanted, is a separate ask)

## Plan

Build one shared calendar/date-picker component, reused across Home, History, and Reports the way entity 040 reused a shared edit surface across two entry points. Spec should identify each screen's current date-entry point before deciding the swap-in approach.
