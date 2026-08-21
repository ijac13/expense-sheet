---
id: 057
title: Use Shared Calendar Date Picker on Subscriptions
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

Entity 046 built one shared calendar-style date picker (`app/app/components/DatePickerModal.tsx`) and swapped it into Home, the expense edit sheet, and History's custom date range. It deliberately left Subscriptions' two date fields (Add's Start Date, Cancel's end-date prompt) on the native `<input type="date">`, because entity 053's shipped test suite drives both fields directly through `setValue()` on the native input at twelve call sites — swapping the control would break that suite, and 046 was scoped to the four fields it could change without touching a different, already-verified entity's tests.

Captain wants the same calendar picker on Subscriptions too, for a consistent experience across the whole app.

## User Stories

- As the captain, I want tapping a date on Subscriptions to open the same calendar I now get everywhere else, so the app feels consistent.

## Success

- Subscriptions' Add-form Start Date and the Cancel-confirmation end-date both open `DatePickerModal` on tap, matching the other four entry points' behavior exactly (month grid, left/right stepping, year-jump view).
- Entity 053's test suite is updated to match the new control, not bypassed or deleted — same coverage, driven through the picker instead of the native input.

### Out of Scope

- Any change to entity 053's actual date logic (start/end validation, the archive-prompt flow, what gets written to the sheet) — this is purely swapping the input control, same as entity 046 was for its four fields.
- Any change to `DatePickerModal` itself — reuse as-is unless the build finds a genuine gap.

## Plan

Same shape as entity 046: identify the exact two call sites (`app/app/subscriptions/page.tsx`, Add form's Start Date and Cancel modal's end-date field), swap each to the shared component, and update entity 053's `app/test/subscription-dates.render.test.js` to drive the picker (open modal, pick a day) instead of `setValue()` on a native input — the same test intent, different interaction path.
