# Billing Guardrails — Cloud Run Function

Automatically detaches GCP billing from the project when spend reaches the TWD $1,000 kill threshold (USD $32). Deployed as a Cloud Run Function subscribed to a Pub/Sub topic triggered by a GCP budget.

## Prerequisites

### APIs to enable

```
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudbilling.googleapis.com
gcloud services enable pubsub.googleapis.com
```

### Pub/Sub topic

Create the topic that the GCP budget will publish to:

```
gcloud pubsub topics create billing-kill-trigger
```

### Service account

Create the service account and grant it the required role:

```
gcloud iam service-accounts create billing-kill-sa \
  --display-name "Billing Kill Switch SA"
```

### IAM grant — billing account level (required)

The `updateProjectBillingInfo` API requires `roles/billing.costsManager` granted **at the billing account level**, not the project level. Without this, the detach call returns 403.

Steps:
1. Go to GCP Console → Billing → Account Management → Permissions → Add Principal
2. Principal: `billing-kill-sa@<PROJECT_ID>.iam.gserviceaccount.com`
3. Role: `Billing Account Costs Manager` (`roles/billing.costsManager`)

## Deploy

Deploy with `SIMULATE=true` first to verify the function works before arming it:

```
gcloud run deploy billing-kill-function \
  --source . \
  --region us-central1 \
  --trigger-topic billing-kill-trigger \
  --set-env-vars PROJECT_ID=<YOUR_PROJECT_ID>,SIMULATE=true \
  --service-account billing-kill-sa@<YOUR_PROJECT_ID>.iam.gserviceaccount.com \
  --runtime nodejs20
```

## Test with SIMULATE=true

Publish a test message that exceeds the threshold:

```
gcloud pubsub topics publish billing-kill-trigger \
  --message='{"costAmount":35,"budgetAmount":32,"budgetDisplayName":"expense-sheet-guardrail"}'
```

Check logs in Cloud Console → Cloud Run → billing-kill-function → Logs, or:

```
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=billing-kill-function" \
  --limit 20 --format "table(timestamp,textPayload)"
```

Expected log line: `SIMULATE mode: would detach billing from project <YOUR_PROJECT_ID>`

Confirm no billing changes occurred in Billing → Account Management.

## Arm the kill switch (SIMULATE=false)

Once the SIMULATE test passes, redeploy with `SIMULATE=false`:

```
gcloud run deploy billing-kill-function \
  --source . \
  --region us-central1 \
  --trigger-topic billing-kill-trigger \
  --set-env-vars PROJECT_ID=<YOUR_PROJECT_ID>,SIMULATE=false \
  --service-account billing-kill-sa@<YOUR_PROJECT_ID>.iam.gserviceaccount.com \
  --runtime nodejs20
```

The kill switch is now live. If `costAmount >= 32` (USD), billing is detached.

## Re-enable billing after a kill

If the kill function fires:

1. All GCP services in the project stop immediately (Cloud Run, Firestore, etc. are suspended).
2. To re-enable:
   - GCP Console → Billing → Account Management
   - Find the project → click "Change billing"
   - Re-link to the billing account
3. Services resume after billing is re-linked. Most stateful resources persist if re-linked within ~30 days.
4. **Investigate the root cause before re-enabling** — re-linking without fixing the cause will trigger the kill again.

You cannot re-enable billing programmatically from inside the killed project. It must be done via Console or by an account with billing admin access at the billing account level.

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `PROJECT_ID` | GCP project ID to detach billing from | required |
| `SIMULATE` | `true` = dry-run (logs only), `false` = live kill | `false` |
| `KILL_THRESHOLD_USD` | USD amount that triggers the kill | `32` |
