---
id: 070
title: Move monthly chart to the top of Report > Annual
status: spec
source: captain
started: 2026-09-24T07:53:13Z
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
        - id: gate:070:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:070-ideation-1
              briefing:
                id: briefing:070:ideation:attempt-1:revision-1
                digest: sha256:b27ce0d7fe0de1017869d88162fa4ca4642accbd45ecabd79ca11cdd6b0ec19b
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:070:ideation:1
                briefing: briefing:070:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-24T07:52:55.148373Z"
                decision: approve
                reason: 'Captain approved: clear, small, single-page outcome. Placement decided: monthly trend chart goes directly under the year total (year picker -> total -> monthly trend -> rest in current order).'
              application:
                target-stage: spec
                state: consumed
---

The monthly chart is the most useful view in Report > Annual, so it should be the first block people see.

## User Stories

- As a user opening Report > Annual, I want the monthly chart first so that I see the year's spending trend before the details.

## Success

- The monthly chart is the first block in Report > Annual.
- Every other block keeps its current relative order.

### Out of Scope

- Changing the chart itself or other Report tabs.

## Plan

To be shaped at ideation.

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles
