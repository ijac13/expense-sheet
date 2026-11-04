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
        - id: gate:081:spec
          stage: spec
          attempts:
            - id: gate-attempt:081-spec-1
              briefing:
                id: briefing:081:spec:attempt-1:revision-1
                digest: sha256:a76af3ea05b6eaf5f0dbdc132eced194a64d7dbadd69171aac8afb522a2f9106
                room-ref: '@review/spec/briefing-1'
started: 2026-11-04T06:15:22Z
---

## Questions for the captain

- **Q1 — Cost ceiling.** One always-running backend copy costs about **USD $8 a month (about TWD 260)** per project. Your billing kill switch cuts off the production project at USD $32 a month. Is USD $8 a month on production OK? (Recommended: yes.)
  - Answer:
- **Q2 — Staging too?** Keeping staging awake as well lets us prove the speed-up on staging before production, for another ~USD $8 a month on the staging project. Choose: (a) both awake, ~USD $16 total — recommended, matches "preview on staging before production"; or (b) production only, ~USD $8, and the speed-up is first measured on production after your deploy.
  - Answer:


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

## Spec

### Goal

Keep one copy of the `api` backend always running so the first Home, Report or History visit after a break answers in about 0.5 seconds instead of about 4 seconds.

### Chosen approach

- Add `minInstances: 1` to the options of `export const api = onRequest({ secrets: [anthropicKey] }, ...)` in `functions/src/index.ts:299`. Plain-language: "minimum instances" tells Google to keep at least one copy of the backend switched on, even when nobody is using it, so nobody waits for it to boot.
- Per function, not global. Firebase Functions v2 accepts `minInstances` in each function's options (`onRequest({...})`, typed `number | Expression<number>` in `firebase-functions@7.4.0` `lib/v2/options.d.ts:85`); `setGlobalOptions` would also keep the daily `subscriptionScheduler` awake, which wastes money. Source: Firebase "Manage functions" doc, "Keep a minimum number of instances warm" (https://firebase.google.com/docs/functions/manage-functions).
- If the captain picks Q2 (b): use `minInstances: projectID.equals("expense-sheet-b2db8").thenElse(1, 0)` (`projectID` is built into `firebase-functions/params`). This picks the value per project from committed code, with no hidden `.env` file (the `.env` files are gitignored).
- Memory, CPU and region stay as they are.

### Expected monthly cost

- Current `api` config: 256 MiB memory, 1 vCPU, us-central1 (Tier 1 pricing).
- Idle always-running copy, 730 hours a month: CPU 1 x 2,628,000 s x USD 0.0000025 = USD 6.57; memory 0.25 GiB x 2,628,000 s x USD 0.0000025 = USD 1.64. Total about **USD 8.2 a month** per project, before the free tier.
- Sources: Firebase "Manage functions" doc states about USD $8/month for a 256 MiB function at 1 CPU with concurrency on (our exact config); Cloud Run pricing page (https://cloud.google.com/run/pricing) gives the idle rates above. The Cloud Run pricing page did not render its numbers in my fetch, so the rates are cross-checked against the Firebase doc figure, not read live. The Firebase CLI prints its own cost estimate at deploy time; verify records that number.
- Billing kill switch (`billing-guardrails/README.md`): detaches production billing at USD $32 a month. This change uses about a quarter of that.

### User Stories

- As the captain, I want Home's Save button to turn on quickly when I open the app, so that I can log an expense right away.
- As the captain, I want Report and History to show quickly, even after the app sat unused for hours, so that checking spending feels instant.
- As the captain, I want to know the monthly cost before it ships, so that it stays inside my billing limit.

### Edge Cases

- **Backend redeployed.** Each deploy replaces the running copy; the first request right after a deploy can still be slow. Expected, not a failure.
- **Google recycles the copy.** Google occasionally restarts instances for maintenance; it starts a replacement on its own, but a request landing in that moment can be slow. Rare.
- **Two people at once.** One copy serves up to 80 requests at the same time (concurrency 80), so the captain and partner logging together both hit the warm copy.
- **Burst beyond one copy.** If traffic ever needs a second copy, that second one starts cold. Not expected at this app's usage. The production timing sample below (1.2s, 3.7s, 0.47s) shows a second cold copy can occur today.
- **Kill switch trips.** If total production spend reaches USD $32, billing detaches and the whole backend stops. This change adds ~USD $8 to the monthly total.
- **Deploy confirmation prompt.** The Firebase CLI asks to confirm the cost of minimum instances on deploy. A non-interactive deploy (an agent running it) needs `--force` or fails; verify must expect this prompt.

### Out of Scope

- Moving the backend to Taiwan (asia-east1).
- Making the backend start faster (loading heavy code only when needed).
- Changing memory, CPU or concurrency (a smaller CPU setting could cut cost to ~USD $3 but forces one request at a time; separate decision).
- Any change to what the website shows.
- Keeping `subscriptionScheduler` awake.

## Acceptance criteria

**AC-1 — The `api` function declares one minimum instance in code.**
Verified by: offline — a new test in `functions/test/` builds and requires `functions/lib/index.js` and asserts `api.__endpoint.minInstances` is `1` (or, for Q2 (b), is the projectID expression resolving to 1 for `expense-sheet-b2db8` and 0 otherwise). Today the value is `null` (checked 2026-11-04). Falsified by: removing `minInstances` from the `onRequest` options.

**AC-2 — `subscriptionScheduler` stays at zero minimum instances.**
Verified by: offline — same test asserts `subscriptionScheduler.__endpoint.minInstances` is not 1. Falsified by: moving the setting into `setGlobalOptions`.

**AC-3 — The deployed staging `api` shows minimum instances 1** (Q2 (a) only; for (b) it shows none).
Verified by: offline — `firebase functions:list --project staging --json` shows `"minInstances": 1` on `api`. Falsified by: deploying without the code change.

**AC-4 — The first request after idle is fast on staging** (Q2 (a) only).
Verified by: offline — after at least 30 minutes with no traffic, `curl -s -o /dev/null -w "%{http_code} %{time_total}\n" https://expense-sheet-staging.web.app/api/categories` returns 401 (no login needed; the 401 still runs the backend) in under 1.0 s. Baseline today: 4.68 s first, 0.45 s after. Falsified by: staging scaling to zero (the first request returns to ~4 s).

**AC-5 — The deployed production `api` shows minimum instances 1, and the first request after idle is fast.**
Verified by: offline, after the captain's deploy — `firebase functions:list --project production --json` shows `"minInstances": 1` on `api`; after at least 30 minutes idle, the same curl against `https://expense-sheet-b2db8.web.app/api/categories` answers under 1.0 s. Baseline today: 4.2 s (first officer), 1.2 s then 3.7 s (this spec). Falsified by: production still showing no `minInstances`.

**AC-6 — Home's Save button turns on quickly after a break.**
Verified by: interactive — the captain opens production Home after at least 30 minutes away and Save is usable within about a second. Falsified by: the familiar ~4 s wait.

## Risk evidence

Riskiest mechanism: that `minInstances` is set per function in this SDK, and that staging and production deploy the same code the same way. Exercised read-only on 2026-11-04, nothing deployed:

- `firebase functions:list --project production`: `api` is gcfv2, us-central1, 256 MiB, cpu 1, concurrency 80, maxInstances 20, no minInstances.
- `firebase functions:list --project staging`: identical config. Both projects deploy the same `functions/` source; only the gitignored `.env` / `.env.staging` values differ (STAGING_SETUP.md: `firebase deploy --only functions --project staging|production`).
- Built `functions/lib` and read `api.__endpoint`: `minInstances: null` today, so AC-1's test can read the value offline.
- `firebase-functions@7.4.0` types: `minInstances?: number | Expression<number>` per function; `projectID` param and `.equals().thenElse()` exist for the Q2 (b) variant.
- Timing (401, unauthenticated): staging 4.68 s cold then 0.45 s; production 1.2 s, 3.7 s, 0.47 s.
- `gcloud` is unusable in this sandbox (config read denied), so Cloud Run console-level settings were read through the Firebase CLI only.

## Expected surface and tolerance

Estimate: +25 net LOC across 2 files, tolerance ±50%.

- `functions/src/index.ts` around line 299: add `minInstances` to the `api` options plus a short comment with the cost (+2 to +6 lines; +1 import line for Q2 (b)).
- `functions/test/minInstances.test.js` (new): AC-1 and AC-2 (~20 lines).

Semantics this may change: billing (always-on instance, ~USD 8/month per project). No API shape, stored data, auth or schedule change.

## Test plan

- Build: `npm --prefix functions test` (runs the new test plus the existing suite).
- Verify: `firebase deploy --only functions:api --project staging` (expect the cost confirmation prompt; record the CLI's cost estimate), then AC-3 `functions:list`, wait 30+ minutes, AC-4 curl.
- Production backend deploy is the captain's command, run from the main checkout after merge:

      firebase deploy --only functions:api --project production

  Then AC-5 (`firebase functions:list --project production --json` and the 30-minute-idle curl) and AC-6 by the captain. Website deploy is not needed (no website change).
- Cost: a few minutes of agent time plus a 30-minute idle wait per environment. Live staging drive needed for AC-4 only.

## Stage Report: spec

- DONE: Write the spec (Spec Template) in the entity body: goal, user stories, edge cases, out of scope, and a top-level ## Acceptance criteria section with each AC marked offline or interactive
  `## Spec` plus top-level `## Acceptance criteria` with AC-1..AC-5 offline, AC-6 interactive.
- DONE: State the exact setting (minimum instances on the api function in functions/src/index.ts) and confirm against Firebase Functions v2 docs how it is set, per function or globally
  `minInstances: 1` in the `api` onRequest options at `functions/src/index.ts:299`; per function (Firebase "Manage functions" doc, SDK 7.4.0 `options.d.ts:85`); global rejected because it would also wake `subscriptionScheduler`.
- DONE: State the expected monthly cost of one always-running instance at the api function's current memory/CPU, with the source of the price
  About USD 8.2/month per project (256 MiB, 1 vCPU, Tier 1 idle rates); Firebase doc quotes ~USD 8 for this exact config; Cloud Run pricing page numbers did not render live, flagged in the spec.
- DONE: Exercise the riskiest mechanism read-only: confirm the current api function config (memory, region, concurrency) and how staging vs production deploys differ; do not deploy anything
  `firebase functions:list` on both projects: identical 256 MiB / cpu 1 / concurrency 80 / us-central1 / no minInstances; only gitignored .env values differ; `api.__endpoint.minInstances` is null today. Nothing deployed.
- DONE: Name expected files and lines changed, with tolerance
  +25 LOC across `functions/src/index.ts` and a new `functions/test/minInstances.test.js`, ±50%.
- DONE: Propose proof for each AC, including a staging check (first request after idle time) and the production backend deploy as a command the captain runs
  AC-4 30-minute-idle curl on staging (baseline 4.68 s); captain runs `firebase deploy --only functions:api --project production`.
- DONE: Add a short plain-language question at the top for the captain if any decision is theirs (for example cost ceiling)
  Q1 cost ceiling (USD 8/month vs USD 32 kill switch); Q2 staging awake too (recommended) or production only.

### Summary

Spec sets `minInstances: 1` on the `api` function only, at about USD 8/month per project. Read-only checks confirmed staging and production run identical configs and that the setting can be checked offline from the built code. Two captain decisions sit at the top: the cost ceiling, and whether staging stays awake too (recommended, so the speed-up is proven on staging first). The Firebase CLI's cost confirmation prompt on deploy is called out for verify.
