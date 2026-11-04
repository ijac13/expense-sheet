---
title: Keep the backend awake so Home, Report and History open without a 4-second wait
status: spec
source: captain (report "prod is slower now", 2026-11-04)
id: 081
gates:
    version: 1
    records:
        - id: gate:081:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:081-ideation-1
              briefing:
                id: briefing:081:ideation:attempt-1:revision-1
                digest: sha256:57f3097ad9f94583da80b1d80988e35b5b48c80ba152148eb5948cd8c4bb876d
                room-ref: '@review/ideation/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:081:ideation:1
                briefing: briefing:081:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-11-04T06:15:14.554613Z"
                decision: approve
                reason: 'Captain approved in the review pane with no notes: accepts keeping one backend instance always running.'
              application:
                target-stage: spec
                state: consumed
started: 2026-11-04T06:15:22Z
---

After the app sits unused, the backend goes to sleep, and the next visit waits about 4 seconds while it wakes up, so Home's Save button, Report and History all feel slow.

## User Stories

- As the captain, I want Home's Save button to turn on quickly when I open the app, so that I can log an expense right away.
- As the captain, I want Report and History to show quickly, even after the app sat unused for a while.

## Success

- The production backend keeps one copy always running, so the first visit after a break no longer waits for the backend to wake up.
- A first request after a long idle period answers in about the same time as a normal one (roughly 0.5 seconds from Taiwan, not 4 seconds).
- The monthly cost of the always-running copy is stated before it ships.

### Out of Scope

- Moving the backend to Taiwan (asia-east1); that is a separate, bigger change.
- Making the backend start faster (loading heavy code only when needed); possible follow-up.
- Any change to what the website shows.

## Plan

Diagnosis (2026-11-04, first officer, read-only):

- Four back-to-back requests to production `/api/categories`: first 4.2s, then about 0.45s each. The 4.2s is the backend waking up (a "cold start").
- Home enables Save only after `/api/categories` returns (`app/app/page.tsx`, `categoriesReady`); Report and History also wait on the same backend (`api` function).
- 079 and 080 deployed the website only; the backend was not redeployed, so they are not the cause.
- The backend is `functions/src/index.ts` `export const api = onRequest({ secrets: [anthropicKey] }, ...)`, region us-central1, no minimum instances set.

Direction (option 1, captain-chosen): set a minimum of one running instance on the `api` function, then deploy the backend. Spec states the exact setting, the expected monthly cost, how to confirm it on staging, and the production backend deploy, which is the captain's command to run.
