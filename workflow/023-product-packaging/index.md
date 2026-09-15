---
id: "023"
title: Post-Launch Product Packaging — Multi-Household Distribution
status: build
source: captain feedback
started: 2026-09-15T08:28:38Z
completed:
verdict:
score: 0.6
worktree: .worktrees/spacedock-ensign-023-product-packaging
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
              resolution:
                type: Resolution
                id: resolution:spacedock:023:spec:1
                briefing: briefing:023:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-09-15T09:17:10.018679Z"
                decision: approve
                reason: 'Captain approved: mechanism resolves the isolation constraint structurally (no server in the credential path at all), riskiest claim verified against real repo code, zero blast radius to production.'
              application:
                target-stage: build
                state: consumed
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

## Build plan

- `scripts/provision.js` — plain Node (CommonJS, zero new dependencies: only `node:fs`/`path`/`child_process`/`readline`-equivalent). Shells out only to `gcloud`, `firebase`, and `curl`, always under whichever identity/project is already logged in locally — never a hardcoded project ID or captain credential. The one live HTTP call (verifying the service account can read the household's Sheet) goes through `curl` against `sheets.googleapis.com` with a bearer token minted via `gcloud auth print-access-token --impersonate-service-account=...`, so every network target the process touches is a subprocess call to an allowlisted host, not a raw `fetch`/`http` call from the script itself.
- `scripts/fixtures/sheet-template.json` — single source of truth for the expected tabs/headers/22 seeded categories, mirroring `SETUP.md` steps 1–3 exactly. A pure `validateSheetTemplate()` function in the script compares a Sheets API read (real or stubbed) against this fixture — this is what AC-4 exercises offline via a mocked "fresh copy" response.
- `docs/provisioning-guide.md` — the captain-hosted static guide. Every link in it targets an allowlisted host by construction (Firebase console, Cloud console, `docs.google.com` for the "make a copy" Sheet link, `github.com` for the code) since those are the guide's only two navigation actions (Google console pages and the GitHub repo).
- `SETUP.md` / `README.md` — add a short pointer at the top of each sending new households to the guide first; manual steps stay as fallback/reference (spec's Out of Scope keeps the non-fresh-project path manual-only).
- Tests at `scripts/test/provision.test.js` (+ `scripts/test/helpers.js`), run via `node --test scripts/test/`, following the existing `scripts/hooks/test/` convention (no mocking library in this repo — real binaries are stubbed by prepending a temp bin dir with fake `gcloud`/`firebase`/`curl` scripts to `PATH`, and the real script is spawned as a subprocess against them). AC-1/AC-2/AC-3 are static source scans (regex/grep) over `provision.js` + `provisioning-guide.md`, needing no execution. AC-4 through AC-8 drive the real script through stubbed CLIs and assert on exit code, stdout, and the stub's logged invocations (e.g., "was `firebase deploy` ever called").
- AC-9/AC-10 stay deferred to the verify stage — both need a live Google identity, per the spec's own test plan.

## Stage Report: build

- DONE: Write a brief implementation plan before coding begins
  `## Build plan` section above, committed separately (`c2d89d7`) before any implementation.
- DONE: Build the provisioning script and guide on a dedicated branch, satisfying AC-1 through AC-8 (all offline-testable) with concrete test evidence; AC-9 and AC-10 are interactive/live and correctly stay deferred to the verify stage
  `scripts/provision.js` (309 LOC, zero new dependencies — only `node:fs`/`path`/`child_process`), `docs/provisioning-guide.md`, `scripts/fixtures/sheet-template.json`, `scripts/test/` (helpers + 16 tests + 4 stub binaries for `gcloud`/`firebase`/`curl`/`npm`). Committed on `spacedock-ensign/023-product-packaging` at `a7f97a4`. `node --test scripts/test/` → 16/16 passing. AC-9/AC-10 need a live Google identity and are explicitly out of this stage's scope per the spec's own test plan — not attempted here.
- DONE: Check off every acceptance criterion explicitly in the stage report with evidence, with special attention to AC-1 (network-target allowlist) and AC-2 (no telemetry/logging) since those two carry the isolation guarantee
  See per-AC evidence below.

### Acceptance criteria

- AC-1 (network-target allowlist) — MET. `grep -oE 'https?://[a-zA-Z0-9.-]+' docs/provisioning-guide.md scripts/provision.js | sort -u` → only `console.firebase.google.com`, `console.cloud.google.com`, `docs.google.com`, `github.com`, `sheets.googleapis.com`. Test `AC-1 every network target...` extracts every URL host from both files and asserts each is on the allowlist (`*.googleapis.com` suffix or one of the four fixed hosts); a paired falsifying-control test proves the allowlist function itself rejects `evil.example.com` and `not-googleapis.com`, so the assertion isn't vacuously true. gcloud/firebase/npm CLI installs are documented without embedding a URL at all (avoiding `cloud.google.com`/`nodejs.org`, which are not allowlisted), specifically to keep this property exact.
- AC-2 (no telemetry/logging, secrets stay local) — MET. Two tests: (1) every `require(...)` in `provision.js` is a `node:` builtin or a local relative path — no bare package name, so no analytics/logging/crash-reporter dependency can exist; also greps for `sentry|analytics|datadog|posthog|mixpanel|bugsnag|rollbar|amplitude` (no hits). (2) the script contains exactly two `writeFileSync` calls, and both target literally `functions/.env` and `app/.env.local` inside the repo clone (regex-matched against the literal `path.join(REPO_ROOT, ...)` call sites) — no other file, and no `node:http`/`https`/`net`/`dgram` require exists, so the only network-facing surface is the four allowlisted subprocess calls themselves.
- AC-3 (never authenticates as/writes to captain's project) — MET. Static test asserts neither `expense-sheet-b2db8` nor `expense-sheet-staging` appears anywhere in `provision.js` or `provisioning-guide.md`. Dynamic dry-run (inside the AC-6 test below): every logged `gcloud`/`firebase` invocation's `--project=` flag is collected and asserted equal to the test's own fake project id (`test-hh-full-run`) in every occurrence, never a captain literal — proving the project id is always the caller-supplied value, never hardcoded.
- AC-4 (Sheet template matches SETUP.md steps 1-3) — MET. `scripts/fixtures/sheet-template.json` mirrors SETUP.md's tabs/headers/22 categories exactly. `validateSheetTemplate()` (pure, exported) is asserted to accept a fixture-matching "fresh copy," and three falsifying mutations (drop the last category row, delete a tab, rename a header) are each asserted to fail with a specific, correctly-located error — proving the check discriminates rather than always passing.
- AC-5 (billing-declined refusal) — MET. With the stub `gcloud billing projects describe` reporting `False`, the script exits non-zero, stderr names the exact console URL (`console.cloud.google.com/billing/linkedaccount?project=<id>`), and the invocation log shows it stopped before ever calling `iam service-accounts` or `firebase deploy`.
- AC-6 (re-run after partial failure reuses SA/key) — MET. Test pre-places a key file (simulating "attempt 1 already ran") and stubs `iam service-accounts create` to fail with "already exists." Asserts: exit 0, `iam service-accounts create` was attempted and its failure tolerated, `iam service-accounts keys create` was never called (key reused, not re-minted), and the written `functions/.env`'s service-account email matches the pre-placed key's identity (proving the reused key's actual content flowed through, not just that a code path was skipped). Falsifiability checked by mutation: temporarily forcing the key-creation branch to always run made this test fail (confirmed live, then reverted before committing — no diff in the final `git log`).
- AC-7 (no success until Sheet read confirmed) — MET. With the stub Sheets read returning HTTP 403, asserts non-zero exit, stdout never contains the success string, stderr names the exact service-account email to share the Sheet with, and neither `firebase deploy` nor the `npm` build step was ever invoked. Also asserts `functions/.env`/`app/.env.local` were never written on this failed run.
- AC-8 (generated env has no captain literals) — MET. Pure-function test on `buildEnvContent()` asserts the household's real values are present and that `expense-sheet-b2db8`, `expense-sheet-staging`, and the script's own usage-text example emails (`your-email@gmail.com`, `your-partner-email@gmail.com`) are absent; a paired falsifying-control test injects `expense-sheet-b2db8` as the spreadsheet id and confirms the check does catch it. The AC-6 integration run additionally confirms the real written `functions/.env`/`app/.env.local` files carry none of these literals end-to-end.
- AC-9 / AC-10 — DEFERRED (interactive/live, per spec's own test plan; correctly out of this stage's scope).

### Regression check

No `functions/src` or `app/` files touched (`git diff --stat` against `main` shows only `README.md`, `SETUP.md`, `docs/`, `scripts/`, and this entity's own file) — zero blast radius to ijac's household's production app, matching the spec's "Expected surface and tolerance." `node scripts/hooks/pre-commit` (the repo's PII pre-commit hook) passed clean on the full staged diff before commit.

### Surface vs. estimate

`git diff --numstat $(git merge-base main HEAD)..HEAD` (this stage's commits only): `scripts/provision.js` 309 lines — within the spec's own ±30% tolerance on its 200-300 LOC estimate (bound: 390). Guide/fixture/tests (`docs/provisioning-guide.md` 122, fixture 41, `scripts/test/` 542 across helpers (75) + the test file (317) + 4 stub binaries (150)) were not separately bounded by the estimate ("a handful of new test files"); the stub-binary size is the direct consequence of this repo having no mocking library (confirmed by inspecting `scripts/hooks/test/`, the one precedent) — each external tool (`gcloud`/`firebase`/`curl`/`npm`) needed a real, PATH-stubbed executable rather than an in-process mock. AC unchanged from spec; no narrowing.

### Summary

Built `scripts/provision.js`, a dependency-free Node script that provisions a new household's Firebase project, service account, and env files entirely under their own `gcloud`/`firebase` login — every network-facing action is a subprocess call to `gcloud`, `firebase`, `npm`, or `curl` against Google's or GitHub's own domains, never a captain-operated endpoint. `docs/provisioning-guide.md` is the captain-hosted static guide households follow; `scripts/fixtures/sheet-template.json` is the single source of truth for the Sheet template's structure, shared between the script's own validation and its test. 16 tests in `scripts/test/` cover AC-1 through AC-8 offline, using PATH-stubbed CLI binaries (this repo's existing no-mocking-library convention) rather than in-process mocks; AC-1 and AC-2 — the two carrying the isolation guarantee — are proven by static source scans with paired falsifying controls, not just by the absence of a bug today. AC-9/AC-10 need a live Google identity and are deferred to verify, as the spec itself specifies.
