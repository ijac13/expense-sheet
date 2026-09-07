---
id: 063
title: Home Page Slow Load and Stale Categories Before Adding an Expense
status: spec
source: captain
started: 2026-09-07T12:45:42Z
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
        - id: gate:063:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:063-ideation-1
              briefing:
                id: briefing:063:ideation:attempt-1:revision-1
                digest: sha256:375845444224572a7e5b9d0b951eab6970fbb1a84244a57d048d6ec0c2a57a06
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:063:ideation:1
                briefing: briefing:063:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-07T12:44:06.892043Z"
                decision: approve
                reason: Seed clearly captures the observed slow-load/auto-refresh/stale-categories problem with concrete user stories and open questions; ready for spec to investigate root cause.
              application:
                target-stage: spec
                state: consumed
---

When I open the production expense-sheet web app, the home page keeps loading something and the "save" button is grayed out. Then it refreshes the page on its own, and sometimes the categories shown on the home page change after that refresh. Only after that can I actually add an expense record.

Why do I need to wait? What is it loading, and what is it refreshing for?

## User Stories

- As a user, I want the home page ready to accept an expense the moment it opens, so I do not wait through a load-then-auto-refresh cycle every time I want to log a spend.
- As a user, I want the "save" button to only be grayed out when there is a real reason (e.g. no category selected), not while something invisible is still loading.
- As a user, I want the categories on the home page to be correct on first paint, not change out from under me after an unexplained refresh.

## Success

- Understand why the "save" button is grayed out on open and what condition clears it.
- Understand what triggers the automatic page refresh, and why categories can differ before vs. after it.
- Either the wait goes away, or — if something must load first — it is fast and legible (a visible loading state) rather than a silent stall ending in a self-refresh.

### Out of Scope

- Redesigning the home page beyond fixing this load/refresh behavior.
- Any change to how categories are defined or migrated — this is about what's DISPLAYED, not the category data itself.

## Plan

To be filled in at spec time. Open questions:

- What is the home page actually waiting on before enabling "save" — auth, a categories fetch, a scheduler check, something else?
- What causes the auto-refresh — a client-side reload, a service-worker update, a stale-cache recovery, something else?
- Why would categories shown differ before vs. after the refresh — is the first paint reading a stale/cached category list that the refresh corrects?
- Is this reproducible on demand, or intermittent? Does it depend on network conditions, time since last visit, or browser cache state?
