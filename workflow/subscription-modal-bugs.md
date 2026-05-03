---
id: "031"
title: Subscription Modal — Amount Not Editable and Duplicate on Add
status: verify
source: captain feedback
started: 2026-05-03T09:03:27Z
completed:
verdict:
score: 0.9
worktree: .worktrees/spacedock-ensign-subscription-modal-bugs
issue:
pr:
---

Two bugs in the subscription add/edit flow: the amount field is locked in the edit modal, and occasionally adding a new subscription creates a duplicate entry.

## Bug A — Amount field not editable in edit modal

`feedback-screenshots/subscription-002.png` shows the Subscriptions list with Edit buttons. When Edit is tapped, the amount field in the modal cannot be changed.

**Expected:** All fields (name, amount, category, frequency, due date, paid by) are editable in the edit modal
**Actual:** The amount field appears locked or read-only — tapping it does nothing

**Likely cause:** The amount input is marked `readOnly` or `disabled` in the edit modal form, or the field is rendered as display text instead of an input when in edit mode.

## Bug B — Adding a new subscription sometimes creates two entries

When tapping the `+ Add` button and submitting a new subscription, it occasionally appears twice in the list.

**Expected:** One submission = one entry
**Actual:** Two identical subscriptions appear

**Likely cause:** Double-submit — either the Add button can be tapped twice before the first submission completes, or the local state is updated optimistically AND the server response triggers a second append. No debounce or loading state guard on the submit button.

## Root Cause Analysis

### Bug A — Amount field absent from edit form

`EditFormState` (page.tsx line 32–36) defines only `name`, `category_id`, `due_day`, `due_month`. The amount field is never included in edit form state, and the edit modal renders no amount input at all. This is a missing field, not a `readOnly`/`disabled` attribute. Fix: add `amount` to `EditFormState`, populate it in `openEdit()`, add an amount `<input>` in the edit modal, and include it in the PATCH body sent to `updateSubscription`.

The backend PATCH handler (functions/src/index.ts line 252) does not accept amount updates — column 2 (`existing[2]`) is always preserved. The backend also needs to be updated to accept and write the new amount.

### Bug B — No submission guard on Add button

`handleAdd` (page.tsx line 95) has no in-flight flag. The Add button (line 360) is always enabled. Tapping it twice fires two concurrent POST requests to `/api/subscriptions`. Each call returns a distinct subscription object (IDs are `sub-${Date.now()}`, which may differ by 1 ms). Both complete successfully, and each triggers a `setSubscriptions((prev) => [...prev, newSub])` append, producing two list entries and two Google Sheet rows.

The same missing guard also applies to the Save button in the edit modal — rapid double-tap can send two PATCH requests and transiently show stale state.

## Spec

### Goal

Fix two bugs in the subscription modal: (A) allow the amount field to be edited, and (B) prevent duplicate entries when the Add button is tapped rapidly.

### User Stories

- As a user editing a subscription, I can change the amount so I can keep it accurate when pricing changes.
- As a user adding a new subscription, I always get exactly one entry in the list regardless of how quickly I tap the Add button.
- As a user saving any subscription form, I get visible feedback that my action is processing.

### Acceptance Criteria

**Bug A — Amount editable in edit modal**

- **AC-1** When the edit modal opens, the amount field is pre-filled with the subscription's current amount.
- **AC-2** The amount input in the edit modal is a number input that accepts changes — tapping it opens the keyboard and the value updates as the user types.
- **AC-3** Saving the edit modal with a changed amount updates the subscription's amount in the list immediately (optimistic update) and persists to the sheet.
- **AC-4** Saving the edit modal with an unchanged amount leaves the amount as-is — no regression.
- **AC-5** Saving with an empty or zero amount is rejected before submission — the Save button stays disabled or an inline error is shown.

**Bug B — No duplicate on Add**

- **AC-6** Tapping the Add button once creates exactly one subscription entry in the list.
- **AC-7** Tapping the Add button twice in rapid succession (before the first request completes) still creates exactly one subscription — the second tap has no effect.
- **AC-8** While the Add request is in flight, the Add button is visually disabled (or shows a loading spinner) so the user knows submission is in progress.
- **AC-9** After the Add request completes (success or error), the Add button returns to its normal state.
- **AC-10** While the Save request for an edit is in flight, the Save button is visually disabled to prevent double-submit.

### Edge Cases

- Network is slow (>3 s): the Add/Save button stays disabled for the full duration; no timeout is required but no second request fires.
- User enters a decimal amount (e.g. 149.5): the value is accepted and saved as-is; the list renders it correctly.
- User clears the amount field to empty and taps Save: submission is blocked (AC-5).
- User opens edit, changes nothing, taps Save: the PATCH still fires and succeeds silently — no duplicate, no error.
- User opens edit modal, changes amount, then taps the backdrop to dismiss: changes are discarded, subscription is unchanged.

### Out of Scope

- Changing the frequency (monthly/annual) in the edit modal — frequency is intentionally read-only after creation.
- Changing the paid_by field in the edit modal — not part of this bug fix.
- Debounce or retry logic for network errors.
- Optimistic rollback if the server returns an error after state update.
- Any changes to the cancelled-subscription display or cancel flow.

## Acceptance Criteria

- **AC-1** When the edit modal opens, the amount field is pre-filled with the subscription's current amount.
- **AC-2** Submitting a new subscription always creates exactly one entry in the list, even if the Add button is tapped multiple times rapidly.
- **AC-3** The Add button is disabled while submission is in progress.
- **AC-4** Editing a subscription and saving updates the existing entry's amount without creating a duplicate.
- **AC-5** The Save button in the edit modal is disabled while the save request is in flight.

## Stage Report: spec

- DONE: Root cause identified for both bugs with evidence from the codebase
  Bug A: `EditFormState` (page.tsx:32–36) omits `amount`; backend PATCH (functions/src/index.ts:252) also preserves existing amount, never writing updates. Bug B: `handleAdd` (page.tsx:95) has no in-flight guard; Add button (page.tsx:360) is always enabled, allowing concurrent POSTs that each append to local state.
- DONE: Spec written with binary acceptance criteria covering both fixes
  5 AC items in the top-level Acceptance Criteria section; full spec block with 10 testable ACs, edge cases, and explicit out-of-scope section written to entity file.

### Summary

Dug into `app/app/subscriptions/page.tsx` and `functions/src/index.ts`. Bug A root cause is that `amount` was never added to `EditFormState` and the edit modal has no amount input — the backend PATCH handler also ignores amount. Bug B root cause is the lack of a submission-in-flight guard on `handleAdd` and the Add button, allowing two concurrent POSTs. Spec written with 10 binary acceptance criteria, edge cases, and clear out-of-scope boundaries.
