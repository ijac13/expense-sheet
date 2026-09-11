---
id: 068
title: Add a Month Picker to Reports
status: spec
source: captain
started: 2026-09-11T07:54:16Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:068:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:068-ideation-1
              briefing:
                id: briefing:068:ideation:attempt-1:revision-1
                digest: sha256:90ca23ac973e7d0b11350a5eb7f1f1eef5c3a6ef9bc0a1385423846e7d9830b4
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:068:ideation:1
                briefing: briefing:068:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-11T07:53:10.661918Z"
                decision: approve
              application:
                target-stage: spec
                state: consumed
---

Reports currently requires stepping month by month (Annual/Monthly navigation) to reach a specific month. The captain wants to jump straight to any month, using a picker UI similar to the day picker already used elsewhere in the app (`app/app/components/DatePickerModal.tsx`, used on Home, History, Subscriptions, and the expense-edit sheet).

## User Stories

- As the captain, I want a month picker on Reports so I can jump directly to any month, instead of stepping through months one at a time.
- As the captain, I want that picker to look and feel like the day picker I already use elsewhere in the app (Home/History), so it's familiar rather than a new pattern to learn.

## Success

- Reports has a visible month-picker control that opens a UI matching `DatePickerModal`'s look and interaction, adapted for picking a month (and year) rather than a specific day.
- Selecting a month in the picker navigates Reports straight to that month, replacing (or supplementing — spec to decide) today's one-step-at-a-time navigation.

### Out of Scope

- Any change to `DatePickerModal`'s existing day-picking behavior on Home/History/Subscriptions/expense-edit.
- Any change to what Reports displays for a given month once selected.
- A picker for the Annual view (this is about Monthly navigation specifically) — confirm at spec time whether Annual needs anything analogous.

## Plan

To be filled in at spec time. Open questions for spec:

- Read `DatePickerModal.tsx` directly to characterize its actual UI/interaction (calendar grid? scrollable wheel? something else) before designing a month-only variant — do not assume its shape from the name alone.
- Does Reports currently have Monthly navigation state that a picker can hook into directly, or does this need new state/routing?
- Should the month picker also let the captain jump between years, given Reports' data spans multiple years (2022 onward per prior entities)?
- Is a shared/reusable component the right shape (e.g. a `MonthPickerModal` sibling to `DatePickerModal`), or should `DatePickerModal` itself be extended with a mode prop? Spec's call.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

### Feedback Cycles
