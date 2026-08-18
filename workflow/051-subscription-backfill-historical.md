---
id: 051
title: Backfill Missing Historical Subscription Expense Entries
status: ideation
source: captain (found while scoping entity 050)
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Entity 050 fixes subscription auto-add going forward, but explicitly excludes backfilling — the scheduler never ran successfully, so every month since Jan 2025 that should have generated an expense entry never did. An approximate check (matching by amount within the due month, ±2%) against the 21 currently-active subscriptions found the picture is mixed, not uniformly missing:

- Several subscriptions (the gym payments, a couple of others) are already ~100% covered — the captain has been logging these by hand consistently, so there's likely nothing to backfill there.
- Several others have real, substantial gaps: Libi 投資贊助 (7/20 months covered), 網路 中華電信 (8/20), Netflix (11/20), 0975379852 (12/20).

The amount-matching check is approximate — a price change, a bundled charge, or an unrelated expense of the same amount could produce a false positive or false negative. This needs a careful, subscription-by-subscription review before writing anything, not an automated blanket fill.

## User Stories

- As the captain, I want my expense history to actually reflect the recurring payments I made in 2025 and early 2026, so my spending totals and reports for that period are accurate.
- As the captain, I want to review what would be added before it's written, category by category, since a wrong guess here corrupts real historical financial data.

## Success

- For each active subscription with a real gap, historical expense entries exist for the months genuinely missing — not duplicated for months already logged by hand.
- The captain reviews and confirms the specific list of entries to be added before any write happens.
- The distinction between "genuinely missing" and "already logged, just not linked to the subscription" is resolved per subscription, not assumed either way.

### Out of Scope

- Changing the going-forward auto-add mechanism itself — entity 050.
- Subscriptions that are already fully or near-fully covered by existing manual entries.
- Any subscription no longer active today (only 2026-08 known subscriptions were checked; a cancelled subscription's history is a separate call).

## Plan

Re-run and tighten the gap analysis per subscription (date proximity, not just amount, to cut down false positives/negatives), present the specific candidate list to the captain for review, then write only the confirmed entries — using entity 050's own deterministic-id scheme so a backfilled entry is indistinguishable from one the scheduler would have generated, and so re-running this is itself idempotent.
