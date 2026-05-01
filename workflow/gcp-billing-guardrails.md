---
id: "027"
title: GCP Billing Guardrails
status: ideation
source: captain
started:
completed:
verdict:
score: 0.95
worktree:
issue:
pr:
---

Protect against runaway GCP bills — alert at a soft threshold (X) so I know costs are climbing, and automatically kill billing at a hard threshold (Y) before it gets out of hand.

## Why This Matters

The expense-sheet app runs on GCP (Firebase/Cloud Run). As usage grows, unexpected charges can accumulate silently. Two layers of protection are needed:

1. **Alert at X** — passive warning, no action. Just a heads-up: "you've spent $X."
2. **Stop billing at Y** — active kill switch. When costs hit $Y, automatically sever the billing account from the project. This is nuclear but finite.

## How GCP Actually Works

From the docs:

**Budgets and alerts** (the alert-at-X part):
- Create a GCP Budget on the billing account with threshold rules (e.g., 50%, 90%, 100% of a dollar amount, or explicit dollar values).
- Default notification channels: email to Billing Admins/Project Owners, or Cloud Monitoring custom channels.
- **Budgets do NOT cap spending.** Alerts are informational only.
- Up to 50,000 budgets per billing account.

**Programmatic billing disable** (the stop-at-Y part):
- Pattern: Budget with Pub/Sub notification → Cloud Run Function → Cloud Billing API call.
- The function calls `billing.updateProjectBillingInfo({ billingAccountName: '' })` to remove the billing account link.
- **Critical caveats:**
  - There is a delay between incurring costs and receiving notifications — actual spend may overshoot Y.
  - Disabling billing **terminates ALL Google Cloud services immediately**, including the Cloud Function itself if it lives in the same project.
  - Resources may be irretrievably deleted. Manual re-enable required to restore.
  - Cannot disable billing on a project locked to a billing account.

## Success

- A GCP Budget exists on the project's billing account with:
  - Threshold at $X → email alert to me
  - Threshold at $Y → Pub/Sub trigger
- A Cloud Run function (or Cloud Function) subscribed to the Pub/Sub topic that:
  - Checks current `costAmount` vs `budgetAmount`
  - Calls the Cloud Billing API to detach the billing account when Y is exceeded
  - Has a `SIMULATE` flag for safe dry-run testing before going live
- The function runs in a **separate project** or has IAM scoped to avoid self-termination
- Setup is documented so it can be re-enabled quickly if triggered

### Out of Scope

- Automatic re-enablement after billing is cut (manual only by design)
- Per-service spend caps (this is project-level only)
- Slack/webhook notifications (email is sufficient for now)
- Forecasted spend alerts (actual spend only)

## Open Questions

1. What should X and Y be? (e.g., X = $10 alert, Y = $30 kill)
2. Should the Cloud Function live in the same project or a separate "watchdog" project to avoid self-termination?
3. Should there be a middle threshold (e.g., $Y/2) that alerts but doesn't kill?
