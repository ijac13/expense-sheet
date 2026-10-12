---
id: 073
title: Backend Node.js runtime upgrade (before 2026-10-30)
status: ideation
source: captain, 2026-10-12 — production deploy warned Node.js 20 is decommissioned on 2026-10-30
started:
completed:
verdict:
score: 0.9
worktree:
issue:
pr:
mod-block:
---

Google decommissions the Node.js 20 runtime on 2026-10-30; after that date no backend (`api`, `subscriptionScheduler`) deploy succeeds, so every future fix is blocked until the runtime moves.

## User Stories

- As the captain, I want backend deploys to keep working after 2026-10-30 so that fixes and features can still ship.
- As the captain, I want the app to behave exactly as before so that the upgrade is invisible day to day.

## Success

- `functions` runs on a supported runtime with years of runway; staging and production both deployed on it.
- The daily 01:00 subscription logger runs cleanly on the new runtime (SchedulerLog shows a clean run on staging, then production).
- Shipped to production by 2026-10-14, two weeks before the deadline.

### Out of Scope

- Upgrading `firebase-functions` v6 → v7 (breaking changes; its own feature if wanted).

## Plan

Drafted at `docs/plans/node-runtime-upgrade.md`, currently in the captain's /r advisory review. Recommendation there: Node 24 (supported until 2028-04-30); change `functions/package.json` `engines.node` and `@types/node`; test on local Node 24; staging + one overnight scheduler run; production backend deploy is the captain's line.

Open questions for the captain (in the plan): Node 24 vs 22; whether to fold in firebase-functions v7 (recommend no).

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles
