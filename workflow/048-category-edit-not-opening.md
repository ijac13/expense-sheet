---
id: 048
title: Category Edit Form Doesn't Open in Category Management
status: ideation
source: captain (found manually testing entity 044 on staging)
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Tapping a category's Edit button in Settings → Category Management does nothing — no form, no modal, no visible response at all, every time. Confirmed pre-existing and unrelated to entity 044: the button/open-form code (`openEdit`, `isFormOpen`, the button's `onClick`) is byte-identical between `main` and entity 044's branch, and a static read of that logic shows nothing obviously wrong — this needs live/runtime investigation (browser console error, event handler not attaching, an overlay blocking the click target, a hydration issue, etc.), not a guessed fix.

## User Stories

- As the captain, I want tapping a category's Edit button to actually open the edit form, so I can change its name, icon, or gov_category.

## Success

- Tapping Edit on any active category opens the edit form, pre-filled with that category's current values, every time.
- Root cause is identified and documented (from live reproduction, not a guess) before a fix is written.

### Out of Scope

- The save-confirmation/error-toast behavior itself — already fixed by entity 044. This is specifically about the form never opening in the first place.

## Plan

Reproduce live against staging with browser devtools open (console errors, whether the click handler fires at all). Compare against the "Add category" button, which uses the same `setFormMode` mechanism and doesn't appear to be broken — the difference between the two paths is the likely lead.
