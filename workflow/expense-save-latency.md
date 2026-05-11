---
id: "037"
title: Expense Save — Immediate UI Feedback with Acceptable Sheet Latency
status: ideation
source: captain observation
started: 2026-05-11T04:11:34Z
completed:
verdict:
score: 0.85
worktree:
issue:
pr:
---

When saving a record on the webapp, the record should appear in the UI immediately (no waiting for the Google Sheet write to complete). The Google Sheet write can have a few seconds of latency — that's acceptable. The user experience priority is instant feedback in the app.

## Observation

Currently testing whether:
1. The record appears in the webapp immediately after tapping Save (optimistic or post-confirm)
2. The Google Sheet eventually reflects the record (within a few seconds)
3. There are no cases where the UI shows success but the Sheet write silently failed
