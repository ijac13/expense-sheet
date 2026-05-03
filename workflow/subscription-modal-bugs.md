---
id: "031"
title: Subscription Modal — Amount Not Editable and Duplicate on Add
status: ideation
source: captain feedback
started:
completed:
verdict:
score: 0.9
worktree:
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

## Acceptance Criteria

- **AC-1** All fields including amount are editable when the edit modal is open
- **AC-2** Submitting a new subscription always creates exactly one entry, even if the Add button is tapped multiple times rapidly
- **AC-3** The Add button is disabled or shows a loading state while submission is in progress
- **AC-4** Editing a subscription and saving updates the existing entry without creating a duplicate
