---
id: 050
title: Subscriptions Never Auto-Generate Expense Entries on Due Date
status: ideation
source: captain (found checking expense history for recurring entries)
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Recurring subscriptions are supposed to automatically create a matching expense entry on their due date — that's the entire point of `apps-script/subscription-scheduler.gs`. Checked production directly: of 1,962 expense rows, none carry the id format (`Utilities.getUuid()`) that script would produce. Zero evidence it has ever run, despite 21 active subscriptions with due dates that should have fired repeatedly across the months of real data in the sheet. The script is a Google Apps Script meant to run on its own daily trigger set up manually inside the Google Sheet's Apps Script editor — a one-time setup step separate from the app's own deploy pipeline, and the evidence says it was never done.

## User Stories

- As the captain, I want a subscription's payment to automatically appear in my expense history on its due date, so I don't have to remember to log recurring expenses by hand.
- As the captain, I want to trust that once this is set up, it keeps working without me checking on it — this failed silently for months before anyone noticed.

## Success

- Every active subscription generates a real expense entry, automatically, on its actual due date — verified live, not just read from code.
- The generated entry matches the current Expenses schema exactly (the existing script sets a `status` field that doesn't exist in the sheet at all — a sign it's drifted from the real schema).
- Whatever mechanism ends up running this is actually confirmed running, not just installed — this bug was invisible for months precisely because nobody could tell from the app itself whether it was working.

### Out of Scope

- Changing subscription create/edit/delete itself — already built and working
- Backfilling expense entries for due dates that were already missed historically

## Plan

Open question for spec: keep this as a Google Apps Script (needs manual one-time setup entirely inside Google's UI, outside this repo's deploy pipeline and outside anything this workflow can verify or redeploy) — or move the logic into a scheduled Firebase Function (deploys and verifies the same way as everything else built this session, no separate manual Google-side setup step to silently skip). That choice should get made explicitly, not defaulted into.

Whichever mechanism is chosen, align it to the current Expenses schema (drop the `status` field the existing script writes, which doesn't exist) and to entity 047's header-based column resolution rather than reintroducing positional writes.
