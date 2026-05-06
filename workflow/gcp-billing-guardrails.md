---
id: "027"
title: GCP Billing Guardrails
status: verify
source: captain
started: 2026-05-06T05:04:43Z
completed:
verdict:
score: 0.95
worktree: .worktrees/spacedock-ensign-gcp-billing-guardrails
issue:
pr:
mod-block: merge:pr-merge
---

Protect against runaway GCP bills — alert at TWD $500 so I know costs are climbing, and automatically kill billing at TWD $1,000 before it goes further.

## Why This Matters

The expense-sheet app (and future GCP projects) run on a single GCP billing account. Expected monthly cost is ~$0 (free tier covers all usage). Two layers of protection for runaway bugs or misconfigured services:

1. **Alert at TWD $500** — email notification only. If expected cost is ~$0, anything near $500 means something is wrong.
2. **Kill billing at TWD $1,000** — automatically sever the billing account from the project. Nuclear but finite.

## How GCP Actually Works

**Budgets and alerts** (the alert layer):
- GCP Budget with a threshold rule at TWD $500 → email to Billing Admin/Project Owner.
- **Budgets do NOT cap spending.** Alerts are informational only.

**Programmatic billing disable** (the kill layer):
- Pattern: Budget at TWD $1,000 → Pub/Sub topic → Cloud Run Function → Cloud Billing API.
- The function calls `billing.updateProjectBillingInfo({ billingAccountName: '' })` to remove the billing account link.
- The function lives in the **same project** — it runs, kills billing, then dies with the project. That's fine; its job is done.
- **Critical caveats:**
  - Notification delay means actual spend may slightly overshoot TWD $1,000.
  - Disabling billing terminates ALL GCP services immediately. Resources may be irretrievably deleted.
  - Manual re-enable required to restore. No automatic recovery.
  - Cannot disable billing on a project locked to a billing account.

## Success

- A GCP Budget on the billing account with:
  - Threshold at TWD $500 → email alert
  - Threshold at TWD $1,000 → Pub/Sub trigger
- A Cloud Run function subscribed to the Pub/Sub topic that:
  - Compares `costAmount` to the TWD $1,000 kill threshold
  - Calls the Cloud Billing API to detach the billing account
  - Has a `SIMULATE` flag for dry-run testing before going live
- Setup documented: how to re-enable billing after it's been cut

### Out of Scope

- Automatic re-enablement (manual only, by design)
- Per-service spend caps (project-level only)
- Slack/webhook notifications (email is sufficient)
- Forecasted spend alerts (actual spend only)
- Separate watchdog project (unnecessary — function doesn't need to survive after the kill)

---

## Spec: GCP Billing Guardrails Setup

### Currency Conversion

GCP budgets are denominated in USD. Conversion at ~31 TWD/USD:

| TWD threshold | USD equivalent | Purpose |
|---|---|---|
| TWD $500 | USD $16.13 | Email alert |
| TWD $1,000 | USD $32.26 | Billing kill threshold |

Use USD $16 and USD $32 when configuring the budget. The function compares `costAmount` to `32` (USD).

---

### Step 1: Create a GCP Budget with Two Thresholds

**Where:** GCP Console → Billing → Budgets & Alerts → Create Budget

**AC:** Budget exists on the billing account with both thresholds configured and saved.

Settings:

1. **Scope:** Select the billing account. Under "Projects", scope to the specific project (e.g. `expense-sheet`).
2. **Budget amount:** Set type to "Specified amount". Enter `32` USD (monthly).
3. **Threshold rules — add two:**

   | Threshold | % of budget | USD trigger | Action |
   |---|---|---|---|
   | Alert | 50% | USD $16 | Email to Billing Admins and Project Owners |
   | Kill | 100% | USD $32 | Pub/Sub (configure in step 2) |

4. **Alert threshold (50%):**
   - Check "Email alerts to billing admins and users"
   - Leave Pub/Sub unchecked for this threshold

5. **Kill threshold (100%):**
   - Uncheck email (optional — add email here too if you want a warning before kill)
   - Check "Connect a Pub/Sub topic" → link to the topic created in Step 2

> Note: The budget alert fires when GCP's billing backend processes usage — this lags real-time by up to several hours. Actual spend may overshoot USD $32 before the kill function executes.

---

### Step 2: Create a Pub/Sub Topic

**Where:** GCP Console → Pub/Sub → Topics → Create Topic

**AC:** Topic exists and is linked to the 100% threshold in the budget.

Steps:

1. Topic ID: `billing-kill-trigger`
2. Leave default settings (no schema required).
3. Click Create.
4. Return to the budget (Step 1) and select this topic for the 100% threshold.

The budget publisher identity is `billing-budget@system.gserviceaccount.com`. GCP grants it `roles/pubsub.publisher` on the topic automatically when you connect a budget to it — no manual IAM grant needed here.

---

### Step 3: Create Service Account and IAM Permissions

**Where:** GCP Console → IAM & Admin → Service Accounts

**AC:** Service account exists with exactly two roles: `roles/billing.projectManager` and `roles/run.invoker`. No over-permissioned roles granted.

Steps:

1. Create service account:
   - Name: `billing-kill-sa`
   - ID: `billing-kill-sa@<PROJECT_ID>.iam.gserviceaccount.com`

2. Grant **project-level** IAM role:
   - `roles/billing.projectManager` — required to call `updateProjectBillingInfo` (detach billing)

3. The Cloud Run Function will use this service account as its runtime identity (set in Step 4).

> `roles/billing.projectManager` is a billing account-level role. It must be granted on the **billing account** in the Billing console (Billing → Account Management → Add Member), not just the project. Without this, the API call to detach billing will return `403`.

Billing account IAM grant:

- Go to: Billing → Account Management → Permissions → Add Principal
- Principal: `billing-kill-sa@<PROJECT_ID>.iam.gserviceaccount.com`
- Role: `Billing Account Costs Manager` (maps to `roles/billing.costsManager`) — this is the minimum role that permits `updateProjectBillingInfo` on a project within the billing account.

---

### Step 4: Deploy Cloud Run Function (Node.js)

**Where:** GCP Console → Cloud Run → Functions → Create Function, or via `gcloud`

**AC:** Function is deployed, subscribed to `billing-kill-trigger`, and visible in Cloud Run console with status "Active".

#### Function configuration

| Setting | Value |
|---|---|
| Runtime | Node.js 20 |
| Trigger | Pub/Sub — topic `billing-kill-trigger` |
| Service account | `billing-kill-sa@<PROJECT_ID>.iam.gserviceaccount.com` |
| Region | Same region as the project (e.g. `asia-east1`) |
| Min instances | 0 |
| Max instances | 1 |

#### Environment variable

| Variable | Value |
|---|---|
| `SIMULATE` | `true` (dry-run) or `false` (live kill) |
| `GCP_PROJECT_ID` | Your GCP project ID |
| `KILL_THRESHOLD_USD` | `32` |

#### Function logic (pseudocode)

```
onPubSubMessage(message):
  data = base64decode(message.data)  // GCP budget notification JSON
  costAmount = data.costAmount        // actual spend in USD
  budgetAmount = data.budgetAmount    // budget ceiling in USD

  if costAmount < KILL_THRESHOLD_USD:
    log("costAmount $X below threshold $Y — no action")
    return

  if SIMULATE == "true":
    log("SIMULATE mode: would detach billing from project GCP_PROJECT_ID")
    return

  call billing.updateProjectBillingInfo(
    name: "projects/GCP_PROJECT_ID",
    projectBillingInfo: { billingAccountName: "" }
  )
  log("Billing detached from GCP_PROJECT_ID")
```

#### Key implementation notes

- The Pub/Sub message from a GCP Budget contains `costAmount` (float, USD) and `budgetAmount` (float, USD). Parse via `JSON.parse(Buffer.from(message.data, 'base64').toString())`.
- Use the `@google-cloud/billing` Node.js client library: `new CloudBillingClient()`.
- The function authenticates via the attached service account — no explicit credential file needed.
- The function checks `costAmount >= KILL_THRESHOLD_USD` before acting. GCP sends notifications at each threshold; this guard prevents the 50% alert from accidentally triggering the kill if the function is reused.

#### Deploy via gcloud (reference)

```
gcloud functions deploy billing-kill \
  --gen2 \
  --runtime nodejs20 \
  --trigger-topic billing-kill-trigger \
  --service-account billing-kill-sa@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars SIMULATE=true,GCP_PROJECT_ID=PROJECT_ID,KILL_THRESHOLD_USD=32 \
  --region asia-east1 \
  --entry-point handleBillingAlert
```

---

### Step 5: Test with SIMULATE Flag

**AC:** Function logs "SIMULATE mode: would detach billing" when invoked with a payload at or above the threshold. No billing changes occur.

Steps:

1. Deploy with `SIMULATE=true`.
2. Publish a test message to `billing-kill-trigger` via Console or gcloud:

```
gcloud pubsub topics publish billing-kill-trigger \
  --message='{"costAmount":35,"budgetAmount":32,"budgetDisplayName":"expense-sheet-guardrail"}'
```

3. Check Cloud Run logs (Logging → Log Explorer, filter by function name).
4. Confirm log line: `SIMULATE mode: would detach billing from project <PROJECT_ID>`.
5. Confirm no change to billing in Billing → Account Management.

Once satisfied, redeploy with `SIMULATE=false` to go live.

---

### Step 6: Re-enabling Billing After a Kill

**AC:** Steps to restore service are documented and verified to work.

If the kill function fires:

1. **All GCP services in the project stop immediately.** Cloud Run, Cloud SQL, Firestore, etc. are suspended.
2. To re-enable:
   - Go to: GCP Console → Billing → Account Management
   - Find the project → click "Change billing"
   - Re-link to the billing account
3. Services resume after billing is re-linked. Stateful resources (databases, storage) should persist if re-linked within GCP's retention window (typically 30 days for most services, but check per-service docs).
4. Investigate the root cause before re-enabling — re-linking without fixing the cause will trigger the kill again.

> You cannot re-enable billing programmatically from inside the killed project — it must be done via Console or from an account with billing admin access at the billing account level.

---

### Checklist Summary

| Step | Description | AC |
|---|---|---|
| 1 | Create GCP Budget | Budget with 50% email and 100% Pub/Sub thresholds saved |
| 2 | Create Pub/Sub topic | Topic `billing-kill-trigger` linked to budget 100% threshold |
| 3 | Service account + IAM | `billing-kill-sa` with `roles/billing.costsManager` on billing account |
| 4 | Deploy Cloud Run Function | Function deployed, subscribed to topic, `SIMULATE=true` |
| 5 | Smoke test | SIMULATE log confirmed, no billing changes |
| 6 | Go live | Redeploy with `SIMULATE=false` |
| 7 | Document re-enable | Steps tested and understood before going live |

---

## Stage Report: spec

- DONE: USD equivalent amounts calculated and included
  TWD $500 = USD $16.13, TWD $1,000 = USD $32.26 at 31 TWD/USD; spec uses USD $16 and USD $32 throughout
- DONE: Spec covers all setup steps with binary AC
  Six setup steps with explicit AC per step, plus SIMULATE dry-run test and re-enable documentation

### Summary

Wrote a 7-step setup guide covering budget creation (USD thresholds), Pub/Sub topic, IAM/service account (billing account-level grant required for `updateProjectBillingInfo`), Cloud Run Function deployment in Node.js with SIMULATE flag, smoke-test procedure, and re-enable steps. Key detail surfaced: `roles/billing.costsManager` must be granted at the billing account level, not the project level, or the detach call returns 403.

### Feedback Cycles

**Cycle 1** (2026-05-06) — Verify REJECTED:
- `billing-guardrails/README.md` contains `expense-sheet-b2db8` hardcoded in 6 places (lines 52, 53, 72, 82, 85, 86)
- Fix: replace all occurrences with `<YOUR_PROJECT_ID>` placeholder

---

## Stage Report: build

- DONE: `billing-guardrails/index.js` — Cloud Run Function with SIMULATE flag, threshold check at USD $32, billing detach call
  `/Users/ijac/Claude-ijac/expense-sheet/.worktrees/spacedock-ensign-gcp-billing-guardrails/billing-guardrails/index.js` — exports `handleBillingAlert`, reads `PROJECT_ID`/`SIMULATE`/`KILL_THRESHOLD_USD` from env, checks existing billing status before detach to avoid double-call
- DONE: `billing-guardrails/package.json` — correct dependencies
  Minimal package with `@google-cloud/billing: ^4.1.0` and `engines: node>=20`
- DONE: `billing-guardrails/README.md` — deploy steps, IAM requirements, SIMULATE test procedure, re-enable instructions
  Covers API enablement, billing-account-level IAM grant, deploy command, test Pub/Sub message, SIMULATE=false arm step, re-enable steps
- DONE: AC from spec self-checked in stage report
  See summary below

### Summary

Created `billing-guardrails/` with three files. The function parses the base64-encoded Pub/Sub budget notification, guards against acting below the USD $32 threshold, checks `billingEnabled` before calling the API to avoid redundant detach calls, and re-throws on API failure so Cloud Run marks the invocation failed. README documents the billing-account-level IAM requirement (the critical 403-prevention detail from the spec) and the full SIMULATE-then-arm workflow.

---

## Stage Report: verify

- DONE: Function parses base64 Pub/Sub message and extracts `costAmount`
  `index.js` line 25: `JSON.parse(Buffer.from(rawData, 'base64').toString())`, destructures `costAmount` at line 31
- DONE: Threshold check at USD $32 (KILL_THRESHOLD_USD env var defaulting to 32)
  `index.js` line 6: `parseFloat(process.env.KILL_THRESHOLD_USD || '32')`, guard at line 34
- DONE: SIMULATE flag prevents actual billing detach when true
  `index.js` lines 41–45: returns early with log message before any API call when `SIMULATE === 'true'`
- DONE: Checks billing is already enabled before calling detach (no double-call)
  `index.js` lines 49–58: calls `getProjectBillingInfo` and checks `billingEnabled` before proceeding
- DONE: `@google-cloud/billing` in package.json dependencies
  `package.json` line 11: `"@google-cloud/billing": "^4.1.0"`
- DONE: README covers API enablement
  `README.md` lines 8–14: four `gcloud services enable` commands
- DONE: README covers billing-account-level IAM (`roles/billing.costsManager`)
  `README.md` lines 33–42: explicit billing-account-level grant steps with role name
- DONE: README covers deploy command
  `README.md` lines 44–54: full `gcloud run deploy` command
- DONE: README covers SIMULATE test
  `README.md` lines 56–74: test publish command and expected log line
- DONE: README covers arm step (SIMULATE=false)
  `README.md` lines 76–88: redeploy command with `SIMULATE=false`
- DONE: README covers re-enable procedure
  `README.md` lines 92–104: four-step re-enable process with console path
- FAILED: PII check — no hardcoded project IDs, credentials, or personal data committed
  `README.md` lines 52, 53, 72, 82, 85, 86: real project ID `expense-sheet-b2db8` hardcoded in deploy commands instead of `<PROJECT_ID>` placeholder

### Summary

All functional ACs pass: base64 parse, threshold guard, SIMULATE short-circuit, billing-enabled pre-check, dependency declaration, and all six README documentation sections. PII check FAILED: `README.md` deploy examples contain the hardcoded GCP project ID `expense-sheet-b2db8` in six places. The spec's own reference deploy command uses `PROJECT_ID` as a placeholder; the README should match that pattern. Replace with `<PROJECT_ID>` before this stage can pass.

---

## Stage Report: build (cycle 1 fix)

- DONE: All 6 occurrences of expense-sheet-b2db8 replaced with <YOUR_PROJECT_ID> in README.md
  `billing-guardrails/README.md` lines 51, 52, 72, 85, 86 — all `expense-sheet-b2db8` strings replaced; no occurrences remain
- DONE: No other files changed
  Only `billing-guardrails/README.md` and `workflow/gcp-billing-guardrails.md` (this report) were modified

### Summary

Replaced all hardcoded `expense-sheet-b2db8` project ID occurrences in `billing-guardrails/README.md` with the `<YOUR_PROJECT_ID>` placeholder. The replacements appear in the two deploy commands (lines 51, 52, 85, 86) and the expected SIMULATE log line (line 72). No functional code files (`index.js`, `package.json`) were touched.
