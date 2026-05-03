# Staging Environment Setup

This document covers the remaining manual steps to bring staging online, plus the deploy commands for both environments.

## What's already done

- `.firebaserc` has both `production` (`expense-sheet-b2db8`) and `staging` (placeholder) named targets
- `functions/.env.staging.example` and `app/.env.staging.example` exist with TODO placeholders — copy each to its non-`.example` name and fill in after completing the steps below
- Production config is untouched and still deployable

---

## Step 1 — Create the staging Firebase project

1. Go to https://console.firebase.google.com/
2. Click **Add project** (the big card with a `+` icon on the project list page)
3. Enter a project name (e.g., `expense-sheet-staging`) — Firebase will suggest a project ID like `expense-sheet-staging-abc12`. Note this ID; you need it in Step 3.
4. Follow the wizard (you can disable Google Analytics if you prefer) and click **Create project**

**Enable Hosting:**

5. In the left sidebar, click **Build** → **Hosting**
6. Click **Get started** and follow the short wizard (you can skip the CLI steps — just click through to finish)

**Enable Functions:**

7. In the left sidebar, click **Build** → **Functions**
8. Firebase will prompt you to upgrade to the **Blaze (pay-as-you-go)** plan — Functions requires Blaze. Click **Upgrade project** and link a billing account.
9. Once on Blaze, click **Get started** and follow the wizard

**Enable Authentication:**

10. In the left sidebar, click **Build** → **Authentication**
11. Click **Get started**
12. Click the **Sign-in method** tab
13. Under **Native providers**, click **Google** → toggle the **Enable** switch → click **Save**
14. Optionally add both user emails under **Authentication** → **Settings** → **Authorized domains** if you see sign-in failures

**Find your project ID:**

15. Click the gear icon next to **Project Overview** in the top-left sidebar → **Project settings**
16. The **Project ID** is shown on the **General** tab under **Your project** (e.g., `expense-sheet-staging-abc12`). Copy it — you need it for Step 3.

**Register a web app:**

17. Still on the **Project settings** page → **General** tab → scroll down to **Your apps**
18. Click the `</>` (Web) icon to add a web app
19. Give it a nickname (e.g., `expense-sheet-staging-web`) and click **Register app**
20. The next screen shows your **Firebase SDK config** — a JS object with these keys:
    ```
    apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
    ```
    Keep this screen open or copy the values — you need them in Step 3.

---

## Step 2 — Create a Google service account for staging

The staging Firebase Functions need their own service account to read/write the staging Spreadsheet.

**Navigate to IAM:**

1. Go to https://console.cloud.google.com/
2. In the top project-picker dropdown (next to the Google Cloud logo), select your **staging** Firebase project (same project ID from Step 1)
3. In the left sidebar, click **IAM & Admin** → **Service Accounts**

**Create the service account:**

4. Click **+ Create service account** at the top
5. Enter a name (e.g., `expense-tracker-staging`) and an optional description, then click **Create and continue**
6. On the **Grant this service account access to project** screen, skip adding any roles — click **Continue**, then **Done**
   (No project-level IAM roles needed; access is granted via Sheets sharing in a later step)

**Download the JSON key:**

7. The new service account appears in the list — click its email address to open it
8. Click the **Keys** tab → **Add key** → **Create new key**
9. Select **JSON** → click **Create** — the browser downloads a file like `expense-sheet-staging-abc12-xxxx.json`
10. Note the `client_email` value inside the file (looks like `expense-tracker-staging@expense-sheet-staging-abc12.iam.gserviceaccount.com`) — you need it in Step 3

**Share the staging Google Sheet with the service account:**

11. Open the staging Google Spreadsheet in your browser
12. Click **Share** (top-right corner)
13. Paste the `client_email` from the JSON key into the **Add people and groups** field
14. Set the permission to **Editor** and click **Send** (or **Share**)

**Enable the Google Sheets API:**

15. In the Cloud Console with the staging project still selected, go to:
    https://console.cloud.google.com/apis/library/sheets.googleapis.com
16. Click **Enable** — if it already says **Manage**, it is already enabled

---

## Step 3 — Fill in the env files

Run these commands from the **project root** (the directory containing `functions/` and `app/`):

```bash
cp functions/.env.staging.example functions/.env.staging
cp app/.env.staging.example app/.env.staging
```

**Edit `functions/.env.staging`** — fill in three values:

| Variable | Where to find it | Example format |
|---|---|---|
| `SPREADSHEET_ID` | The long string between `/d/` and `/edit` in the Sheet URL | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` field in the downloaded JSON key | `expense-tracker-staging@expense-sheet-staging-abc12.iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` field in the downloaded JSON key | `"-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"` |

> **Private key newline warning:** The private key in the JSON file contains literal `\n` sequences that represent newline characters. When you paste the value into `.env.staging`, keep those `\n` sequences exactly as-is — do not convert them to real line breaks and do not strip them. The value must stay on a single line in the file, wrapped in double quotes. If the `\n` characters are lost, Firebase Functions will fail to authenticate.

**Edit `app/.env.staging`** — fill in six values from the Firebase Console SDK config (Step 1, item 20):

| Variable | Firebase config key | Example format |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` | `AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` | `expense-sheet-staging-abc12.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` | `expense-sheet-staging-abc12` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` | `expense-sheet-staging-abc12.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` | `123456789012` (numeric) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` | `1:123456789012:web:abc123def456` |

**Update `.firebaserc`** — replace the staging placeholder with the real project ID:

```json
{
  "projects": {
    "default": "expense-sheet-b2db8",
    "production": "expense-sheet-b2db8",
    "staging": "YOUR_REAL_STAGING_PROJECT_ID"
  }
}
```

---

## Step 4 — Set the ANTHROPIC_API_KEY secret for staging

Firebase Functions uses a secret (not an env file) for the Anthropic API key. Run this from the **project root**:

```bash
firebase --project staging functions:secrets:set ANTHROPIC_API_KEY
# Paste the key when prompted, then press Enter
```

This only needs to be done once per project. Firebase stores the secret in Google Secret Manager and injects it at deploy time — you do not need to re-run this command on subsequent deploys unless you rotate the key.

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
