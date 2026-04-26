---
id: "001"
title: Project Setup
status: done
source: commission seed
started: 2026-04-18T15:31:13Z
completed: 2026-04-20T10:00:00Z
verdict: PASSED
score: 1.0
worktree:
issue:
pr:
---

Every other feature depends on this. Without the scaffold, there is no environment to build or test anything. The goal is a correctly structured, compilable codebase — not a working app, just the foundation every subsequent feature builds on top of.

## Success

Project setup is complete when:

- Code scaffold exists with the correct folder structure (Next.js + Firebase Functions)
- DaisyUI + fantasy theme is installed and renders (visible when the app starts)
- PWA manifest is in place
- `.env.example` is complete and documents every required variable
- App compiles and starts without errors (`npm run dev`)
- No credentials or personal data anywhere in the committed code


### Out of Scope

This does not include sign-in working, connecting to the Spreadsheet, or any feature screen. Those depend on the captain completing the manual setup steps and belong to their own feature entities.

## Public/Private Separation

Three layers, strictly separated:

| Layer | Where it lives | Public? |
|-------|---------------|---------|
| App code (Next.js, Firebase Functions, Google Apps Script) | GitHub repo (`ijac13/expense-sheet`) | ✓ Public |
| Credentials (Firebase config, Spreadsheet ID, API keys) | `.env` file, gitignored | ✗ Private |
| Actual data (expenses, users, subscriptions, categories) | Google Spreadsheet (Google Drive) | ✗ Private |

The `.env` file is never committed. The repo contains only `.env.example` with placeholder values and descriptions. No personal data, no credentials, ever in the codebase.

## Architecture

```
Mobile Browser (Captain + Husband)
        │
        ▼
Firebase Hosting
  Next.js Web App
  • Expense entry
  • Category selector
  • Reports & charts
  • Subscription management
  • Language toggle (EN/繁中)
        │
        ▼
Firebase Functions (Backend API)
  • Google Sheets read/write
  • AI category suggestion
  • Auth validation
  • Subscription scheduler
        │
        ▼
Google Spreadsheet (Single source of truth)
  • All expense data lives here
  • App reads and writes through Firebase Functions
  • Users can also edit the Spreadsheet directly
  • Direct edits are immediately reflected in the app on next read
```

**Key principle:** Google Sheets is the database. The app is the UI layer on top of it. There is no separate database. Both the app and the Spreadsheet are full edit interfaces — users can create, edit, and delete records from either. Any change made through the app or directly in the Spreadsheet is immediately the truth. The app always reads fresh from the Sheet; it never maintains a separate copy.

## Data Flow

1. Open app on phone → Firebase serves the Next.js web app
2. Sign in with Google → Firebase Auth validates, Firebase Function checks email against Users tab
3. Add or edit expense → Firebase Function writes to Expenses tab (create or update row)
4. Delete expense → Firebase Function removes the row from Expenses tab
5. View reports → Firebase Function reads Expenses tab, aggregates and returns data
6. Subscription due → Google Apps Script runs on schedule, writes confirmed expense row to Expenses tab
7. Direct Sheet edit (create, edit, or delete) → immediately visible in app on next data fetch

## Platform

This is a **mobile-optimized web app**, not a native app. One codebase works across iOS and Android through the browser — no App Store submission needed. It can be installed as a **PWA (Progressive Web App)**: users add it to their home screen and it runs full-screen without browser chrome, feeling like a native app.

## UI Design System

**DaisyUI** on top of Tailwind CSS — a free, open-source component library with pre-built themes. No design work needed; components look good out of the box.

**Theme: fantasy**

| Element | Value | Feel |
|---------|-------|------|
| Background | Pure white | Clean |
| Primary | Deep purple-magenta `oklch(37.45% 0.189 325.02)` | Bold |
| Secondary | Medium blue `oklch(53.92% 0.162 241.36)` | Cool |
| Accent | Warm amber `oklch(75.98% 0.204 56.72)` | Warm pop |
| Text | Dark blue-gray `oklch(27.807% 0.029 256.847)` | Easy to read |
| Box radius | 1rem | Soft, rounded |
| Field radius | 0.5rem | Soft, rounded |

Full theme config (for `tailwind.config.js` / `daisyui` plugin):
```json
{"name":"fantasy","color-scheme":"light","--color-base-100":"oklch(100% 0 0)","--color-base-200":"oklch(93% 0 0)","--color-base-300":"oklch(86% 0 0)","--color-base-content":"oklch(27.807% 0.029 256.847)","--color-primary":"oklch(37.45% 0.189 325.02)","--color-primary-content":"oklch(87.49% 0.037 325.02)","--color-secondary":"oklch(53.92% 0.162 241.36)","--color-secondary-content":"oklch(90.784% 0.032 241.36)","--color-accent":"oklch(75.98% 0.204 56.72)","--color-accent-content":"oklch(15.196% 0.04 56.72)","--color-neutral":"oklch(27.807% 0.029 256.847)","--color-neutral-content":"oklch(85.561% 0.005 256.847)","--color-info":"oklch(72.06% 0.191 231.6)","--color-success":"oklch(64.8% 0.15 160)","--color-warning":"oklch(84.71% 0.199 83.87)","--color-error":"oklch(71.76% 0.221 22.18)","--radius-selector":"1rem","--radius-field":"0.5rem","--radius-box":"1rem","--depth":"1","--noise":"0"}
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js (React), mobile-optimized web app (PWA) |
| UI components | DaisyUI + Tailwind CSS, fantasy theme |
| Hosting | Firebase Hosting |
| Backend | Firebase Functions (Node.js) |
| Database | Google Sheets API |
| Auth | Firebase Authentication — Google Sign-In only |
| Subscription scheduler | Google Apps Script (time-based trigger) |

**Cost:** All within Google/Firebase free tiers. Expected monthly cost: $0.

## Security

The app uses a **tiered security model** — friction matches risk. Logging an expense is low friction (habit-critical). Viewing reports requires extra verification (sensitive financial data).

| Layer | Requirement |
|-------|-------------|
| Sign-in | Google Sign-In only — no passwords stored in the app |
| Session timeout | Auto sign-out after 1 minute of inactivity |
| Token expiry | Firebase Auth tokens expire after 1 hour — enforced, not extended |
| Report access | Requires Google re-authentication before the reports screen loads. If the user has Google 2FA enabled on their account, it applies automatically here — no separate 2FA system to build. |
| Data in transit | HTTPS only — Firebase Hosting enforces this |
| Data in browser | No expense data cached in localStorage, sessionStorage, or cookies — always fetched fresh from the Sheet. Nothing sensitive left in the browser. |
| API access | Firebase Functions validate the auth token on every request — no unauthenticated calls reach the Sheet |

**Why Google re-auth for reports:**
The app already trusts Google for identity. Re-authenticating for sensitive screens means Google's own security (including their 2FA if enabled) protects the reports — no custom 2FA infrastructure needed.

## Google Spreadsheet Structure

One Google Spreadsheet file with 4 tabs. All expense data stays in one Spreadsheet forever — no year-based splitting. At ~7,300 rows/year for two users, 20 years of data stays well under Google Sheets limits.

### Tab 1: Expenses

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier (auto-generated by app or Apps Script) |
| date | date | Expense date — defaults to today, editable |
| amount | number | Amount in TWD |
| category_id | string | Reference to Categories tab `id` — never store category name directly |
| paid_by | string | User email of who paid — defaults to `created_by`, editable |
| notes | string | Optional free-text details |
| subscription_id | string | Links to Subscriptions tab `id` if auto-generated; empty for manual entries |
| status | string | Always `confirmed` — kept for future flexibility |
| created_at | datetime | Auto-filled when record is created; not editable |
| created_by | string | Email of user who created the record; not editable |

### Tab 2: Categories

Categories are **never deleted** — only archived. Renaming a category retroactively updates all historical expenses that reference it (by `category_id`), which is the intended behavior.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier — stable forever |
| name_en | string | English name — can be renamed at any time |
| name_zh | string | Traditional Chinese name — can be renamed at any time |
| icon | string | Emoji character |
| sort_order | number | Display order in the category selector |
| is_active | boolean | `true` = visible; `false` = archived, hidden from selector but preserved in history |

**Default categories (22):**

| Emoji | English | Chinese |
|-------|---------|---------|
| 🍜 | Eating Out | 外食 |
| 🧴 | Daily Necessities | 日用品 |
| 🥬 | Groceries | 食材 |
| 🏥 | Medical | 醫療 |
| ✈️ | Travel | 旅遊 |
| 🚌 | Transportation | 交通 |
| 💻 | Digital | 數位 |
| 👶 | Babies | 寶貝 |
| 👕 | Clothing | 衣服 |
| 🏃 | Sports | 運動 |
| 🎁 | Gifts | 禮物 |
| 📚 | Tuition | 學費 |
| 🛣️ | Tolls | 過路 |
| 🔧 | Equipment | 設備 |
| ⛽ | Fuel | 加油 |
| 🎬 | Entertainment | 娛樂 |
| 🏠 | Rent | 房租 |
| 🛒 | Shopping | 購物 |
| 🚗 | Car Repair | 修車 |
| 💝 | Donate | 捐款 |
| 🏡 | Mortgage | 房貸 |
| 📦 | Other | 其他 |

### Tab 3: Subscriptions

Recurring expense templates. When a subscription is due, Google Apps Script automatically creates a confirmed row in the Expenses tab — no manual action or confirmation needed.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier |
| name | string | Subscription name (e.g., "Netflix") |
| amount | number | Expected amount in TWD |
| category_id | string | Reference to Categories tab `id` |
| frequency | string | `monthly` or `annual` |
| due_day | number | Day of month (1–31) |
| due_month | number | Month for annual subscriptions (1–12); empty for monthly |
| paid_by | string | User email of who pays |
| is_active | boolean | Whether this subscription is still running |

### Tab 4: Users

Access is controlled by this tab. Only emails listed here can sign in to the app.

| Column | Type | Description |
|--------|------|-------------|
| email | string | Google account email |
| name | string | Display name |
| language | string | Preferred language: `en` or `zh` |
| created_at | datetime | When user was added |

## Environment Variables

All credentials go in `.env` (gitignored). The repo ships `.env.example`:

```
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Google Sheets
GOOGLE_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
```

## Staging Environment

Firebase Hosting preview channels provide staging — a temporary URL for testing before going live. No separate Firebase project needed.

- **Local dev:** `npm run dev` against a test Google Spreadsheet
- **Staging:** `firebase hosting:channel:deploy preview` — generates a unique preview URL (e.g., `expense-sheet--preview-abc123.web.app`) for the verify stage
- **Production:** `firebase deploy` — goes live at the main Firebase Hosting URL

The test Google Spreadsheet (for local dev and staging) is separate from the production Spreadsheet. Its ID goes in `.env.local` and is never used in production.

## What the Agent Builds

- Initialized Next.js project with Firebase Functions folder layout
- DaisyUI + Tailwind CSS installed and configured with the fantasy theme
- PWA manifest (`manifest.json`) and service worker setup
- Firebase configuration files (without real values)
- `.env.example` with all variables documented
- Google Apps Script file for subscription scheduler (scaffold only)
- Step-by-step manual setup instructions for the captain
- Verification that no credentials or personal data are in committed code

## What Captain Does Manually (One-Time)

1. Create two Google Spreadsheets in Google Drive — one for production, one for staging/dev
   - [x] prod: https://docs.google.com/spreadsheets/d/1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o/edit?gid=0#gid=0
   - [x] staging:https://docs.google.com/spreadsheets/d/19_D7yQaJvZrJyQ3q2oxaVWgWXoofXvCZ0kHUR4IeA-o/edit?usp=sharing
2. [x] In each: create the 4 tabs (Expenses, Categories, Subscriptions, Users) with the columns above
3. [x] Seed the Categories tab with the 22 default categories
4. [x] Add both user emails to the Users tab (production Sheet only)
5. Share both Spreadsheets with both user emails (Editor access)
  - [x] prod
  - [x] stagin
6. [x] Create a Firebase project — enable Hosting, Functions, and Authentication with Google Sign-In
7. [x] Create a Google service account with Sheets API access; download the key JSON
8. Copy `.env.example` to `.env` (production) and `.env.local` (staging), fill in respective Sheet IDs
9. Deploy to Firebase Hosting

## Stage Report: build

- DONE: Code scaffold exists with correct folder structure (Next.js + Firebase Functions)
  `app/` (Next.js App Router), `functions/src/index.ts` (Firebase Functions), `apps-script/` — commit d4b0070
- DONE: DaisyUI + fantasy theme installed and renders (visible when app starts)
  DaisyUI v5.5.19 installed; fantasy theme configured via `@plugin "daisyui/theme"` in globals.css; build output: `/*! 🌼 daisyUI 5.5.19 */`; page renders with `btn-primary`, `btn-secondary`, `badge-accent` components
- DONE: PWA manifest is in place
  `app/public/manifest.json` — display: standalone, theme_color: #5c1a5a matching fantasy primary, icons placeholder at `app/public/icons/`
- DONE: `.env.example` is complete and documents every required variable
  `.env.example` documents all 9 variables: 6 Firebase (NEXT_PUBLIC_*) + 3 Google Sheets (server-side); each variable has a description comment
- DONE: App compiles and starts without errors
  `npm run build` in `app/` passes: `✓ Compiled successfully in 1893ms`, TypeScript clean, 4/4 static pages generated
- DONE: No credentials or personal data anywhere in committed code
  `.env` and `.env.local` are gitignored; `.firebaserc` is gitignored; `.env.example` has only placeholder values; `functions/src/index.ts` has no credentials

### Summary

Built the full project scaffold on branch `feature/001-project-setup` (worktree: `.claude/worktrees/agent-a1f3b159`). Next.js 16 with App Router and Tailwind v4 is initialized; DaisyUI v5 fantasy theme is configured via CSS `@plugin` directives (the v4/v5 approach — no `tailwind.config.js` needed). The app renders a styled landing page proving the theme is active. Firebase Functions scaffold and Apps Script subscription-scheduler placeholder are in place alongside SETUP.md with the complete Spreadsheet schema and step-by-step manual setup instructions.
