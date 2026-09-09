---
id: 067
title: Backfill Ijac's 健保 and 勞保 Subscriptions for Jan-Sep 2026
status: ideation
source: captain
started:
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
        - id: gate:067:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:067-ideation-1
              briefing:
                id: briefing:067:ideation:attempt-1:revision-1
                digest: sha256:7c8a137aa5aa03255ad0802f54ef295d85723d36f097ac469ba6c0928d7d6478
                room-ref: ./review/ideation/briefing-1
---

Ijac's own 健保 (health insurance) and 勞保 (labor insurance) recurring costs — like wei's equivalent subscriptions backfilled in entity `065` — need to be backfilled from January through September 2026. Unlike `065`'s scope, this window explicitly includes September, since a live subscription with `due_day: 1` and a `start_date` after the 1st of the month it's created in does not actually fire for that first month (found while building `065`).

## User Stories

- As the captain, I want ijac's real 健保 and 勞保 expenses backfilled for each month from January through September 2026, so those months' totals and category breakdowns reflect what ijac actually paid, the same way `065` did for wei's equivalent subscriptions.
- As the captain, I want the same reviewable safety `065`/`060`-`064` used — staging rehearsed first, my approval before any production write, and a working, independently-scoped undo.

## Success

- Ijac's 健保 and 勞保 costs each get one row per month for January through September 2026 (2 expenses × 9 months = up to 18 rows, minus any month already covered by a pre-existing manual entry — confirm live, don't assume none exist, exactly as `065` found for wei's Uber/February).
- No pre-existing row (any payer, any month) altered or lost, proven by a before/after check.

### Out of Scope

- Any month before January 2026 or after September 2026 for these 2 expenses.
- wei's own 健保/勞保 subscriptions — already backfilled by `065`.
- Any change to the Subscriptions feature itself, or to ijac's subscription configuration (due day, start date, active status).

## Plan

To be filled in at spec time. Open questions for spec, mirroring `065`'s own investigation:

- Does ijac already have 健保 and 勞保 configured as app Subscriptions (matching wei's pattern), or does the captain need to set these up first? Confirm live against the Subscriptions tab — do not assume they exist.
- If they exist: what are their exact amounts, `due_day`, `start_date`, `is_active`, and subscription ids? Read live, the same way `065` read wei's three subscriptions' real configuration rather than trusting reference data.
- Why does this window include September when `065`'s did not — confirm live whether ijac's subscription(s), like wei's, have a `start_date`/`due_day` combination whose first live scheduler fire is October or later, leaving September genuinely uncovered.
- Scan the live Expenses tab for January-September 2026 for any pre-existing manual entry that already covers one of these subscription-months (the same collision `065` found for wei's Uber/February) — do not assume a clean 18-row backfill without checking. This is now a *known-likely* collision, not just a generic caution: entity `066` just backfilled 203 of ijac's own real expense rows for exactly Jan-Apr 2026 from her own ledger export, so her real 健保/勞保 payments for those months may already be among them under `exp-mig066-` ids. Spec must check `066`'s own rows specifically, not just any manual entry.
- id scheme and scoped undo, following `065`'s `exp-sub065-{subscriptionId}-{isoDate}` precedent but distinct from it (e.g. `exp-sub067-...`) so this entity's own undo cannot reach `065`'s rows or any other entity's.
- Confirm this is a direct app-data backfill (matching `065`'s and `051`'s established shape), not a spreadsheet import.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

### Feedback Cycles
