---
id: "023"
title: Post-Launch Product Packaging — Multi-Household Distribution
status: ideation
source: captain feedback
started:
completed:
verdict:
score: 0.6
worktree:
issue:
pr:
gates:
    version: 1
    records:
        - id: gate:023:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:023-ideation-1
              briefing:
                id: briefing:023:ideation:attempt-1:revision-1
                digest: sha256:07a6ce9d4a06a159561656a38c1061a0f5f1d6dc1272bf121dafc9122ca570ba
                room-ref: ./review/ideation/briefing-1
---

After launch for ijac's household, package the app and sheet setup so other users can self-serve their own instance — their own Google Sheet, their own Firebase project, their own deployed app.

## Problem

Currently the app is hardwired to a single Firebase project (`expense-sheet-b2db8`) and a single spreadsheet ID. Another household cannot use it without forking the repo and setting up Firebase from scratch — real friction, but any fix has to keep every household's data 100% theirs: never stored, visible, or accessible through anything the captain operates or is responsible for.

## What success looks like

- A new household can get a live instance without doing the full Firebase+Sheets setup alone — captain will host/operate the provisioning helper that creates each new instance, reducing their setup friction. See `docs/plans/023-product-packaging-architecture.md` for the reviewed architecture this decision is based on.
- But no shared backend, credential, or infrastructure the captain runs ever reads or writes another household's data — each instance's Sheet, backend, and data stay fully isolated and inaccessible to her, with zero ongoing support obligation for their numbers.
- A setup guide or provisioning script/tool that gets a new household from zero to their own live, fully isolated app.

## Out of Scope (decide at spec time)

- Any architecture where captain's infrastructure, backend, or credentials can read/write another household's data, even transiently in passthrough (rules out one shared backend proxying everyone's Sheet reads/writes)
- Monetization or accounts
- Mobile app store distribution
- Exact hosting/provisioning mechanism (one-click? script? manual guide?) — decide at spec
