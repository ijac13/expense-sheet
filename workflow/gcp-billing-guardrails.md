---
id: "027"
title: GCP Billing Guardrails
status: spec
source: captain
started: 2026-05-06T05:04:43Z
completed:
verdict:
score: 0.95
worktree:
issue:
pr:
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
