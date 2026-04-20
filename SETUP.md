# Expense Tracker — Manual Setup

One-time steps required before the app can run. The agent builds the code scaffold; you do these steps to wire up the real infrastructure.

## Overview

| Step | What | Time |
|------|------|------|
| 1 | Create two Google Spreadsheets (prod + dev) | 5 min |
| 2 | Set up Spreadsheet tabs and columns | 15 min |
| 3 | Seed default categories | 10 min |
| 4 | Create Firebase project | 5 min |
| 5 | Create Google service account | 5 min |
| 6 | Configure environment variables | 5 min |
| 7 | Deploy | 5 min |

---

## Step 1 — Create Google Spreadsheets

Create **two** Spreadsheets in Google Drive:

- **Production:** the real data Spreadsheet
- **Dev/Staging:** a test Spreadsheet (safe to populate with fake data)

Share both Spreadsheets with both user emails (Editor access).

Note the Spreadsheet ID from each URL:
`https://docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`

---

## Step 2 — Create Spreadsheet Tabs and Columns

In each Spreadsheet, create 4 tabs with these exact column headers in row 1:

### Tab: Expenses

| Column | Header |
|--------|--------|
| A | id |
| B | date |
| C | amount |
| D | category_id |
| E | paid_by |
| F | notes |
| G | subscription_id |
| H | status |
| I | created_at |
| J | created_by |

### Tab: Categories

| Column | Header |
|--------|--------|
| A | id |
| B | name_en |
| C | name_zh |
| D | icon |
| E | sort_order |
| F | is_active |

### Tab: Subscriptions

| Column | Header |
|--------|--------|
| A | id |
| B | name |
| C | amount |
| D | category_id |
| E | frequency |
| F | due_day |
| G | due_month |
| H | paid_by |
| I | is_active |

### Tab: Users

| Column | Header |
|--------|--------|
| A | email |
| B | name |
| C | language |
| D | created_at |

---

## Step 3 — Seed Default Categories

In the Categories tab of **both** Spreadsheets, add these rows starting at row 2.
Set `is_active` to `TRUE` for all. Set `sort_order` 1–22 in order.

| id | name_en | name_zh | icon | sort_order |
|----|---------|---------|------|------------|
| cat_01 | Eating Out | 外食 | 🍜 | 1 |
| cat_02 | Daily Necessities | 日用品 | 🧴 | 2 |
| cat_03 | Groceries | 食材 | 🥬 | 3 |
| cat_04 | Medical | 醫療 | 🏥 | 4 |
| cat_05 | Travel | 旅遊 | ✈️ | 5 |
| cat_06 | Transportation | 交通 | 🚌 | 6 |
| cat_07 | Digital | 數位 | 💻 | 7 |
| cat_08 | Babies | 寶貝 | 👶 | 8 |
| cat_09 | Clothing | 衣服 | 👕 | 9 |
| cat_10 | Sports | 運動 | 🏃 | 10 |
| cat_11 | Gifts | 禮物 | 🎁 | 11 |
| cat_12 | Tuition | 學費 | 📚 | 12 |
| cat_13 | Tolls | 過路 | 🛣️ | 13 |
| cat_14 | Equipment | 設備 | 🔧 | 14 |
| cat_15 | Fuel | 加油 | ⛽ | 15 |
| cat_16 | Entertainment | 娛樂 | 🎬 | 16 |
| cat_17 | Rent | 房租 | 🏠 | 17 |
| cat_18 | Shopping | 購物 | 🛒 | 18 |
| cat_19 | Car Repair | 修車 | 🚗 | 19 |
| cat_20 | Donate | 捐款 | 💝 | 20 |
| cat_21 | Mortgage | 房貸 | 🏡 | 21 |
| cat_22 | Other | 其他 | 📦 | 22 |

In the Users tab of the **production** Spreadsheet only, add both user emails with their names and preferred language (`en` or `zh`).

---

## Step 4 — Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Create a new project (e.g., `expense-tracker-yourname`)
3. Enable **Hosting** (Firebase Hosting)
4. Enable **Functions** (Firebase Functions) — requires Blaze (pay-as-you-go) plan; expected cost $0
5. Enable **Authentication** → Sign-in method → Google Sign-In → Enable
6. Add both user emails as authorized users if needed (or leave open — the Users tab in the Spreadsheet is the access control)
7. Register a Web app in the project to get your Firebase config values

---

## Step 5 — Create Google Service Account

The Firebase Functions need a service account to read/write the Spreadsheet.

1. Go to https://console.cloud.google.com/
2. Select your Firebase project
3. Go to IAM & Admin > Service Accounts
4. Create a service account (e.g., `expense-tracker-sheets`)
5. Grant it no project roles (it only needs Sheets access)
6. Create a JSON key, download it
7. Share both Spreadsheets with the service account email (Editor access)
8. Enable the **Google Sheets API** for your project at https://console.cloud.google.com/apis/library/sheets.googleapis.com

---

## Step 6 — Configure Environment Variables

Copy `.env.example` to `.env` and fill in production values:

```bash
cp .env.example .env
```

From your Firebase Web app config:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

From your Google service account JSON key:
- `GOOGLE_SPREADSHEET_ID` — the production Spreadsheet ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — `client_email` from the JSON key
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — `private_key` from the JSON key (keep the `\n` characters)

For dev/staging, copy to `.env.local` and use the dev Spreadsheet ID.

Update `.firebaserc` with your real project ID:

```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

---

## Step 7 — Deploy

Install Firebase CLI if needed:

```bash
npm install -g firebase-tools
firebase login
```

Build and deploy:

```bash
# From the app directory
cd app
npm run build

# From the repo root
firebase deploy
```

For staging preview:

```bash
firebase hosting:channel:deploy preview
```

---

## Step 8 — Set Up Subscription Scheduler (optional)

If you use recurring subscriptions:

1. Open your production Google Spreadsheet
2. Go to Extensions > Apps Script
3. Copy the contents of `apps-script/subscription-scheduler.gs`
4. Paste into the Apps Script editor
5. Set up a daily time-driven trigger on `runSubscriptionScheduler`

---

## Verification Checklist

After completing setup:

- [ ] App loads at your Firebase Hosting URL
- [ ] Google Sign-In works for both user emails
- [ ] Adding an expense writes a row to the production Spreadsheet
- [ ] Reports load correctly
- [ ] Both users can sign in and see shared data
