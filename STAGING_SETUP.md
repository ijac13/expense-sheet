# Staging Environment Setup

This document covers the remaining manual steps to bring staging online, plus the deploy commands for both environments.

## What's already done

- `.firebaserc` has both `production` (`expense-sheet-b2db8`) and `staging` (placeholder) named targets
- `functions/.env.staging.example` and `app/.env.staging.example` exist with TODO placeholders — copy each to its non-`.example` name and fill in after completing the steps below
- Production config is untouched and still deployable

---

## Step 1 — Create the staging Firebase project

1. Go to https://console.firebase.google.com/
2. Click **Add project**, name it (e.g., `expense-sheet-staging`)
3. Enable **Hosting** — Firebase Hosting
4. Enable **Functions** — requires Blaze (pay-as-you-go) plan
5. Enable **Authentication** → Sign-in method → **Google** → Enable
6. Add both user emails under Authentication → Settings → Authorized domains if needed
7. Register a **Web app** in the project to get your Firebase config values (you need them in Step 3)

Note your staging project ID (visible in Project Settings, e.g., `expense-sheet-staging-abc12`).

---

## Step 2 — Create a Google service account for staging

The staging Firebase Functions need their own service account to read/write the staging Spreadsheet.

1. Go to https://console.cloud.google.com/ and select your **staging** Firebase project
2. IAM & Admin → Service Accounts → **Create service account** (e.g., `expense-tracker-staging`)
3. Grant no project roles — it only needs Sheets access
4. Create a **JSON key** and download it
5. Share the staging Google Spreadsheet with the service account email (Editor access)
6. Enable the **Google Sheets API** for the staging project: https://console.cloud.google.com/apis/library/sheets.googleapis.com

---

## Step 3 — Fill in the env file placeholders

Update `.firebaserc` — replace the staging placeholder with the real project ID:

```json
{
  "projects": {
    "default": "expense-sheet-b2db8",
    "production": "expense-sheet-b2db8",
    "staging": "YOUR_REAL_STAGING_PROJECT_ID"
  }
}
```

Copy `functions/.env.staging.example` to `functions/.env.staging` and fill in values from the staging service account JSON key:

- `SPREADSHEET_ID` — the staging Google Spreadsheet ID (from the URL)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — `client_email` from the JSON key
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — `private_key` from the JSON key (keep the `\n` characters, wrap in double quotes)

Copy `app/.env.staging.example` to `app/.env.staging` and fill in values from Firebase Console → Project Settings → Your apps → Web app:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

---

## Step 4 — Set the ANTHROPIC_API_KEY secret for staging

Firebase Functions uses a secret for the Anthropic API key (not an env file). Set it for the staging project:

```bash
firebase --project staging functions:secrets:set ANTHROPIC_API_KEY
# Paste the key when prompted
```

---

## Deploy commands

### Deploy to staging

```bash
# Build the app with staging env vars
# (ensure app/.env.staging is filled in from app/.env.staging.example)
cd app
cp .env.staging .env.local
npm run build
cd ..

# Deploy functions and hosting to the staging project
firebase deploy --project staging
```

### Deploy to production

```bash
# Build the app with production env vars (assumes .env.local has production values)
cd app
npm run build
cd ..

# Deploy functions and hosting to the production project
firebase deploy --project production
```

### Deploy only functions (faster iteration)

```bash
firebase deploy --only functions --project staging
firebase deploy --only functions --project production
```

### Deploy only hosting

```bash
firebase deploy --only hosting --project staging
firebase deploy --only hosting --project production
```

---

## Verification checklist (after first staging deploy)

- [ ] App loads at the staging Firebase Hosting URL
- [ ] Google Sign-In works
- [ ] Adding an expense writes a row to the **staging** Spreadsheet (not production)
- [ ] Subscriptions load correctly
- [ ] AI insights endpoint responds (requires ANTHROPIC_API_KEY secret)
