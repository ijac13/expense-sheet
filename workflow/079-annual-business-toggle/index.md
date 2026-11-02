---
id: 079
title: Reports > Annual chart ignores "include business cost" toggle
status: ideation
source: captain (bug report, 2026-11-02)
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
---

In Reports > Annual, the monthly chart responds to "Live only" but stays unchanged when the captain switches to "Include business cost", so the chart misreports monthly totals that should include business costs.

Evidence: `feedback-screenshots/annual_liveonly.png` and `feedback-screenshots/annual_includebusiness.png` (captain's screenshots — same chart in both modes).

## User Stories

- As the captain, I want the Annual monthly chart to show live + business amounts when I pick "Include business cost", so that I see my real total spend per month.
- As the captain, I want switching back to "Live only" to show live-only amounts, so that the toggle reliably changes what I see.

## Success

- Toggling between "Live only" and "Include business cost" changes the Annual monthly chart's per-month amounts to match the selected mode.
- Other figures on the Annual view that follow the toggle stay consistent with the chart.

### Out of Scope

- Redesigning the Annual report or the toggle itself.

## Plan

{Ideation: root-cause the toggle wiring, propose the fix.}

## Acceptance criteria

{Written at the `spec` stage.}

### Feedback Cycles
