---
id: "034"
title: Remove helloWorld Dead Code from Functions
status: spec
source: captain
started: 2026-05-03T09:41:34Z
completed:
verdict:
score: 0.8
worktree:
issue:
pr:
---

Remove the unused `helloWorld` Cloud Function that was left over from the Firebase template. It failed to deploy to the staging project due to a Cloud Build permission issue, and it is not used anywhere in the app.

## Why

The function is exported in `functions/src/index.ts` but never called by the frontend. It causes a noisy build failure every time we deploy to staging and will cause the same on any new project. Dead code that blocks deployment should be removed.

## What to change

- Delete the `helloWorld` export from `functions/src/index.ts`
- Confirm no other file references or imports it

## Acceptance Criteria

- **AC-1** `helloWorld` is no longer exported from `functions/src/index.ts`
- **AC-2** No other file in the repo references `helloWorld`
- **AC-3** `firebase deploy --project staging --only functions` completes without the helloWorld build error
- **AC-4** The `api` function is unaffected and still deploys successfully
