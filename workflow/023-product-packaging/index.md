---
id: "023"
title: Post-Launch Product Packaging — Multi-Household Distribution
status: spec
source: captain feedback
started: 2026-09-15T08:28:38Z
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
              resolution:
                type: Resolution
                id: resolution:spacedock:023:ideation:1
                briefing: briefing:023:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-15T08:28:21.106628Z"
                decision: approve
                reason: 'Captain approved: architecture reviewed against the live codebase, isolation model confirmed, decision to host the provisioning helper made explicit.'
              application:
                target-stage: spec
                state: consumed
        - id: gate:023:spec
          stage: spec
          attempts:
            - id: gate-attempt:023-spec-1
              briefing:
                id: briefing:023:spec:attempt-1:revision-1
                digest: sha256:7e2d07d1df1fe226d1ae052fa28be3cd8ecbebb8827648281cd74a7838f0d3ab
                room-ref: ./review/spec/briefing-1
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

## Spec

### Goal

Give any new household a path from zero to their own live, fully isolated instance — own Firebase project, own Google Sheet, own deployed app — without the captain's infrastructure, credentials, or backend ever touching their data, transiently or ongoing. The mechanism the captain hosts and operates is a static guided setup page plus a provisioning script that runs entirely under the new household's own Google/Firebase/GitHub identity, on their own machine — never under the captain's, and never through anything the captain runs as a live service. This resolves the ideation's open "decide at spec time" item: the mechanism is guide + local script, not a hosted provisioning API or an OAuth backend acting on the household's behalf (see Out of Scope).

### User Stories

- As a new household, I want a single guided page that walks me from "I found this app" to "it's live and mine," without reading raw setup docs or assembling `gcloud`/`firebase` commands by hand from a wall of text (today's `SETUP.md`).
- As a new household, I want my own copy of the code, my own Firebase project, my own Google Sheet, and my own deployed app — nothing shared with anyone else who uses this tool, and nothing the captain can see.
- As the captain, I want to point someone at the guide and script and be done — no ticket, no manual step on my side, no account of theirs that I hold any credential for, ever.
- As the captain, I want a structural guarantee, not a policy promise, that hosting this guide can never let me see or touch another household's Sheet or Firebase project — even by accident, even if I wanted to.
- As a new household, if a step fails partway (I decline an API prompt, billing isn't enabled, I'm signed into the wrong account), I want a clear error telling me what to fix and where to resume — not a half-created project I have to clean up by hand.

### Edge Cases

- Household declines or is denied Blaze billing on their new Firebase project: functions can't deploy. The script must stop with an explicit, actionable message rather than silently deploying hosting-only and reporting success.
- Household already has an existing Firebase/GCP project they'd rather reuse than create new: the script asks for a project ID and supports pointing at an existing project, but the guided default path assumes and optimizes for a brand-new project (see Out of Scope).
- Household re-runs the script after a partial or failed prior attempt (e.g., the service account from attempt 1 already exists): the script must detect and reuse it rather than erroring on "already exists" or minting a second key silently.
- Household is signed into the wrong Google account locally (e.g., still logged into an unrelated project from a prior `firebase login`/`gcloud auth login`): the script must print the active account and project and require explicit confirmation before making any change.
- The Sheet "make a copy" produces a Sheet the household forgets to share with the newly created service account: functions deploy successfully but every read/write 403s. The script must not report success until it independently confirms the service account can read the Sheet with a single test read.
- Two different households run the exact same guide/script independently and concurrently: since nothing routes through captain-operated infrastructure, this is trivially fine — no shared state to race on. Stated explicitly because it's a direct exercise of the isolation claim, not just an aside.
- Household's machine lacks the Firebase CLI or `gcloud` CLI: the script checks for both up front and gives an install pointer, rather than failing deep into an unrelated step with a confusing error.

### Out of Scope

- Automating Blaze billing enablement — Google requires a human to attach a payment method in-console; no API path exists that skips the household's own manual action. The guide links directly to the right console page; the script waits for confirmation before deploying.
- Any design where the household's setup flows through a server the captain operates — a hosted "provisioning API," an OAuth backend acting on the household's behalf, anything that would receive a household's token or secret even transiently. Ruled out at ideation; this entity's mechanism has no server-side surface at all to secure or trust, by construction.
- Supporting an existing (non-freshly-created) project as the guided default path — available as a fallback (see Edge Cases) but the guide's primary flow assumes a brand-new project.
- Monetization, accounts, or any admin view for the captain to see who has provisioned an instance — the captain keeps no record of who runs the script; that is the point.
- Mobile app store distribution.
- Migrating or importing existing spreadsheet data for a new household — every new instance starts from the blank, pre-seeded template only.
- Any architecture where captain's infrastructure, backend, or credentials can read/write another household's data, even transiently in passthrough — carried forward from ideation; the guide+script design satisfies this by having no passthrough path to rule out.

## Acceptance criteria

**Isolation guarantee (the riskiest claim)**

**AC-1 — Neither the guided page nor the provisioning script ever sends a household's credentials, tokens, Sheet ID, service-account key, or any project-identifying value to any endpoint the captain operates or controls.**
Verified by: offline — every network target in the guide page's source and the script's source is checked against an allowlist of Google's own domains (`console.firebase.google.com`, `console.cloud.google.com`, `docs.google.com`, `*.googleapis.com`) and GitHub's (`github.com`), all reached under the household's own authenticated session; a grep/allowlist test over both source files asserts zero fetch/POST/webhook targets outside that allowlist. Falsified by: any call to a captain-operated domain, or any call carrying a household secret or identifier to a non-Google, non-GitHub destination.

**AC-2 — The provisioning script never persists, logs, or transmits the generated service-account key or `.env` values anywhere off the household's own machine — no telemetry, no analytics, no crash reporter.**
Verified by: offline — code review / grep confirms the script bundles no logging, analytics, or error-reporting library, and no code path writes a secret value anywhere other than the local `.env` / `app/.env.local` files inside the household's own clone. Falsified by: any write of a secret value to a network call, a remote log, or a file outside the local repo clone.

**AC-3 — Nothing about running the guide or script ever authenticates as, or writes to, the captain's own Firebase/GCP account or project.**
Verified by: offline — a dry-run test confirms the script only ever calls `firebase`/`gcloud` CLIs bound to whichever project is currently logged in locally (the household's own, once they run `firebase login`), never a hardcoded project ID; a code review check confirms no captain project ID or captain credential path exists anywhere in the guide or script source. Falsified by: any code path that authenticates as, or writes to, the captain's own Firebase project.

**Provisioning mechanics**

**AC-4 — The Sheet template, once copied via the guide's "make a copy" link, has the exact tabs, header rows, and seeded categories `SETUP.md` steps 1–3 specify (Expenses, Categories, Subscriptions, Users tabs; all 22 categories with `is_active=TRUE` and correct `sort_order`).**
Verified by: offline — a fixture test compares a fresh copy of the template Sheet's structure against a checked-in fixture of the expected tabs/headers/rows. Falsified by: a missing tab, header, or category row versus the fixture.

**AC-5 — The script detects a failed or declined billing/API-enablement step and refuses to proceed to deploy.**
Verified by: offline — a test mocks the billing-check call reporting "not enabled," asserting the script exits non-zero with a message naming the exact console URL to fix it, and never invokes `firebase deploy`. Falsified by: the script proceeding to deploy, or exiting 0, when billing is not enabled.

**AC-6 — Re-running the script after a partial failure (service account already exists from a prior attempt) completes without erroring and without creating a duplicate account or key.**
Verified by: offline — a test mocks `gcloud iam service-accounts create` returning "already exists," asserting the script detects this, reuses the existing service account, and continues rather than aborting or minting a second key. Falsified by: the script erroring out, or creating a second service-account key, on a re-run.

**AC-7 — The script does not report success until it has independently confirmed the service account can read the new Sheet.**
Verified by: offline — a test stubs a Sheets API read as 403 after every other provisioning step "succeeds," asserting the script's final success message is not printed and the failure names the exact fix (share the Sheet with the printed service-account email). Falsified by: the script reporting success while the test read still fails.

**AC-8 — The generated `.env` / `app/.env.local` for a new household contains only that household's own emails and Sheet ID — never the captain's own project ID, spreadsheet ID, or example emails.**
Verified by: offline — a check on the generated env output asserts the household-entered values are present and that the literal captain values (`expense-sheet-b2db8`, the two example emails) are absent, failing the script if either literal appears. Falsified by: a generated env file containing the captain's project ID, spreadsheet ID, or example emails.

**End-to-end, live**

**AC-9 — A live drive through the public guide and script, starting from zero on a throwaway Google account, produces a working app (sign-in, log an expense, view reports) with no captain intervention at any step.**
Verified by: interactive — captain or a delegate runs the full guide end to end against a throwaway account/project, confirming sign-in, expense logging, and reports work, then tears the throwaway project down. Falsified by: any step requiring the captain's own credentials, account, or manual intervention beyond running the public guide/script as a test user herself.

**AC-10 — After a live test provisioning run, the captain's own Firebase/GCP console shows no new project, and the test household's new project's IAM page shows no reference to the captain's account.**
Verified by: interactive — captain checks her own console's project list before and after the test run (no new project appears) and checks the new project's IAM page (no captain account/email present). Falsified by: a new project appearing in the captain's console, or the captain's account appearing in the test project's IAM.

## Risk evidence

The riskiest unverified claim is "no ongoing access after setup" — but the guide+script design makes a stronger claim true by construction: there is no access at any point, ongoing or otherwise, because captain-operated infrastructure never receives a household's request in the first place. The guide is static content; the script runs on the household's own machine against their own locally authenticated `firebase`/`gcloud` sessions. There is no server in the middle to compromise, log, or accidentally widen — AC-1 through AC-3 and AC-10 exercise this directly (network-target allowlisting, no telemetry, no hardcoded captain credentials, and a live before/after check of the captain's own console). This was checked against the real repo, not assumed: `functions/src/index.ts` reads `SPREADSHEET_ID` and the service-account values from environment only (no hardcoded fallback), `app/app/lib/users.ts` reads authorized emails from `NEXT_PUBLIC_USER*_EMAIL` env vars only, and `.gitignore` already excludes `expense-sheet-*.json` / `service-account*.json` key files — the app's existing config shape already assumes per-instance values, which is what the script fills in. The remaining real risk is entirely in the script's own correctness (AC-4 through AC-8): whether it reliably reaches a working deploy and fails loudly instead of partially, not whether isolation holds.

## Expected surface and tolerance

Estimate: a new provisioning script (`scripts/provision.ts` or `.sh`, ~200–300 LOC) and a new static guide (`docs/provisioning-guide.md` or an equivalent guided page), plus small edits to `README.md`/`SETUP.md` pointing new households at the guide instead of (or ahead of) the raw manual steps, plus a fixture file for the Sheet-template structure check (AC-4) and a handful of new test files for the script's mocked-CLI behavior (AC-5 through AC-8). Tolerance ±30%. This entity touches no `functions/src` or `app/` runtime code — it is tooling only, so it carries zero blast radius to ijac's own household's production app or data path.

## Test plan

Offline: a network-target allowlist test over the guide page and script source (AC-1); a code-review/grep check for logging/analytics libraries and hardcoded captain credentials (AC-2, AC-3); a fixture comparison test for the copied Sheet template's tabs/headers/categories (AC-4); mocked-CLI tests for the billing-declined, already-exists-on-rerun, and Sheet-not-shared-yet paths (AC-5, AC-6, AC-7); a generated-env-output check asserting no captain literals leak through (AC-8). Interactive: one live drive provisioning a throwaway account/project end to end (AC-9), with a before/after check of the captain's own console (AC-10) — both need a live Google identity, not new automation.

### Feedback Cycles

## Stage Report: spec

- DONE: Write a completed spec (goal, user stories, edge cases, out-of-scope) for the provisioning helper, building on the reviewed architecture in docs/plans/023-product-packaging-architecture.md rather than re-deriving it
  `## Spec` section — Goal names the guide+script mechanism directly and resolves the ideation's "decide at spec time" item; Out of Scope restates the architecture doc's no-passthrough constraint and ties it to why the chosen design satisfies it structurally.
- DONE: Design the exact provisioning mechanism (script, CLI, or guided steps) and write a top-level Acceptance criteria section where every AC is independently testable and binary, each labeled offline or interactive
  `## Acceptance criteria` — a static captain-hosted guide page plus a local provisioning script run under the household's own Firebase/gcloud/GitHub sessions; 10 ACs across 3 groups (isolation guarantee, provisioning mechanics, end-to-end live), each with a `Verified by: {offline|interactive}` clause and a falsifying condition.
- DONE: Verify the riskiest claim explicitly: that the provisioning helper has no ongoing access to a household's live data after setup completes, and write that as its own falsifiable acceptance criterion
  AC-1/AC-2/AC-3 (offline) and AC-10 (interactive) under "Isolation guarantee (the riskiest claim)" — verified against real repo code (`functions/src/index.ts`'s env-only config, `app/app/lib/users.ts`'s env-only allowlist, `.gitignore`'s existing key-file patterns) rather than asserted; `## Risk evidence` explains why the design makes a stronger claim (no access at all, not just no ongoing access) true by construction.

### Summary

Spec resolves the ideation's open mechanism question: a static, captain-hosted guided page plus a provisioning script that runs entirely on the new household's own machine under their own Google/Firebase/GitHub logins — no server captain operates ever sits in the data or credential path. This makes the isolation claim structural rather than a discard-after-use promise, and the spec's riskiest-claim ACs (AC-1–AC-3, AC-10) test that structure directly against real code in this repo. Remaining real risk is pushed into the script's own correctness (billing-declined, re-run-after-partial-failure, Sheet-not-yet-shared) rather than into isolation.
