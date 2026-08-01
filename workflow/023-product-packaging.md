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
---

After launch for ijac's household, package the app and sheet setup so other users can self-serve their own instance — their own Google Sheet, their own Firebase project, their own deployed app.

## Problem

Currently the app is hardwired to a single Firebase project (`expense-sheet-b2db8`) and a single spreadsheet ID. Another household cannot use it without manually forking the repo, setting up Firebase, and configuring everything from scratch.

## What success looks like

- A setup guide or script that lets a new household go from zero to their own live app in under 30 minutes
- Likely includes: one-click Google Sheets template copy, Firebase project setup steps, environment config, deploy instructions
- Optionally: a single hosted "onboarding flow" that provisions their sheet and returns config values

## Out of Scope (decide at spec time)

- Shared multi-tenant hosting (everyone on the same Firebase project)
- Monetization or accounts
- Mobile app store distribution
