# Expense Tracker Design Spec

Personal expense tracking web app with Google Sheets as the database.

## Goals

- Replace existing expense tracking app with a flexible, customizable solution
- Low cost, low maintenance
- Habit-forming: quick and easy mobile expense entry
- Full sync between web app and Google Sheet (bidirectional)
- Support for 2 users inputting expenses

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js (React) |
| Hosting | Firebase Hosting |
| Backend | Firebase Functions |
| Database | Google Sheets |
| Auth | Firebase Authentication (Google Sign-In) |
| Scheduled Tasks | Google Apps Script |
| Invoice Scanning | Gmail API |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile Browser                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Firebase Hosting                            │
│              Next.js Web App (React frontend)                   │
│         • Expense entry form                                    │
│         • Category selector                                     │
│         • Reports & charts                                      │
│         • Subscription management                               │
│         • Language toggle (EN/繁中)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase Functions                           │
│         • Google Sheets read/write                              │
│         • Category suggestion (AI)                              │
│         • Authentication validation                             │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Google Sheets   │ │   Gmail API      │ │ Google Apps      │
│   (Database)     │ │ (Invoice scan)   │ │ Script (Cron)    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

**Data flow:**

1. Open app on phone → Firebase serves the web app
2. Sign in with Google → Firebase Auth validates, checks Sheet access
3. Add expense → Firebase Function writes to Google Sheet
4. View reports → Firebase Function reads from Sheet, returns chart data
5. Daily scheduled task → Apps Script checks Gmail for invoices, confirms pending subscriptions

**Direct Sheet editing:** Fully supported. The web app reads from Sheets, so any direct edits appear immediately in the app. The Sheet structure will be human-friendly for manual editing.

---

## Google Sheet Structure

### Sheet 1: Expenses

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier (auto-generated) |
| date | date | Expense date, default as the created_date, editable |
| amount | number | Amount in TWD |
| category | string | Category name |
| paid_by | string | Who paid (user email or name), default as the same as created_by, editable|
| notes | string | Optional details |
| subscription_id | string | Links to subscription (if from recurring) |
| status | string | "confirmed" or "pending" (default confirmed, but if has subscriptioin_id, then default pending, and confirmed if invoice found or manual edit) |
| created_at | datetime | When record was created , also fill in, non-editable |
| created_by | string | User who created the record, also fill in, non-editable |

### Sheet 2: Categories

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier |
| name_en | string | English name |
| name_zh | string | Traditional Chinese name |
| icon | string | Emoji character (e.g., 🍜, 🏥) |
| sort_order | number | Display order |
| is_active | boolean | Whether category is visible |

**Default categories** (from your existing app):

| Emoji | Chinese | English |
|-------|---------|---------|
| 🍜 | 外食 | Eating Out |
| 🧴 | 日用品 | Daily Necessities |
| 🥬 | 食材 | Groceries |
| 🏥 | 醫療 | Medical |
| ✈️ | 旅遊 | Travel |
| 🚌 | 交通 | Transportation |
| 💻 | 數位 | Digital |
| 👶 | 寶貝 | Babies |
| 👕 | 衣服 | Clothing |
| 🏃 | 運動 | Sports |
| 🎁 | 禮物 | Gifts |
| 📚 | 學費 | Tuition |
| 🛣️ | 過路 | Tolls |
| 🔧 | 設備 | Equipment |
| ⛽ | 加油 | Fuel |
| 🎬 | 娛樂 | Entertainment |
| 🏠 | 房租 | Rent |
| 🛒 | 購物 | Shopping |
| 🚗 | 修車 | Car Repair |
| 📦 | 其他 | Other |

### Sheet 3: Subscriptions

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier |
| name | string | Subscription name (e.g., "Netflix") |
| amount | number | Expected amount |
| category | string | Category |
| frequency | string | "monthly" or "annual" |
| due_day | number | Day of month (1-31) |
| due_month | number | Month for annual (1-12, null for monthly) |
| paid_by | string | Who pays this subscription |
| gmail_search | string | Gmail search query to find invoices |
| is_active | boolean | Whether subscription is active |
| last_confirmed | date | Last confirmed invoice date |

### Sheet 4: Users

| Column | Type | Description |
|--------|------|-------------|
| email | string | Google account email |
| name | string | Display name |
| language | string | Preferred language ("en" or "zh") |
| created_at | datetime | When user was created |

---

## Features

### 1. Category Management

**Selection:**
- Grid view with icons (similar to existing app)
- Tap to select, long-press to edit
- Search/filter for many categories


**Creation:**
- Add new category from the app
- Specify English name, Chinese name, icon
- Auto-syncs to Categories sheet

**AI Suggestions:**
- When user types notes without selecting a category
- Analyzes notes + historical patterns
- Suggests top 3 matching categories
- Learning source: user's past categorizations in Expenses sheet

### 2. Expense Recording

**One-time expense:**
- Amount (numeric keypad)
- Category (grid selector)
- Date (defaults to today, can change)
- Paid by (dropdown of users)
- Notes (optional text)
- Quick-save with minimal taps

**Recurring subscriptions:**
- Create subscription template
- Set frequency (monthly/annual)
- Set due day
- Configure Gmail search query for invoice matching

**Subscription confirmation flow:**

```
Due date arrives
      │
      ▼
Create PENDING expense entry
      │
      ▼
Apps Script scans Gmail daily
      │
      ├── Invoice found → Mark "confirmed", update amount if different
      │
      └── No invoice after 7 days → Flag for manual review
```

### 3. Gmail Invoice Scanning

**How it works:**

1. Each subscription has a `gmail_search` field (e.g., `from:netflix.com subject:invoice`)
2. Daily Apps Script trigger runs
3. For each pending subscription expense:
   - Search Gmail using the configured query
   - Look for emails within date range (due date ± 7 days)
   - If found: extract amount (pattern matching), confirm expense
   - If amount differs: update expense, add note

**Invoice parsing:**
- Pattern matching for common formats
- Support for major services (Netflix, Spotify, Adobe, etc.)
- Fallback: confirm without amount update, flag for review

### 4. Reports & Analytics

**Monthly summary:**
- Total spending for selected month
- Pie chart by category
- Pie chart by paid_by
- List of top spending categories
- Comparison to previous month

**Trend analysis:**
- Line chart: monthly totals over time
- Bar chart: compare categories across months
- Identify spending patterns

**Category deep-dive:**
- Select a category
- See all transactions in that category
- Filter by date range
- See who paid breakdown

**Paid_by deep-dive:**
- Select a user
- See all transactions in that user
- Filter by date range
- See category breakdown

**All reports:**
- Filter by date range
- Filter by paid_by
- Filter by category
- Export option (downloads from Sheet)

### 5. Authentication & Sharing

**Google Sign-In only:**
- User signs in with Google account
- App checks if user's email exists in Users sheet
- If not in Users sheet → access denied

**Adding users:**
1. Add user's email to Users sheet
2. Share the Google Sheet with that email
3. User can now sign in to the app

**Permission model:**
- Sheet access = App access
- All authorized users can add/edit expenses
- All authorized users see all expenses

---

## User Interface

### Language Support

- Toggle between English and Traditional Chinese
- User preference saved in Users sheet
- All UI labels, category names, buttons bilingual

### Mobile-First Design

**Home screen:**
- Large "Add Expense" button
- Recent expenses list
- Quick stats (today's total, month total)

**Add expense funtion:**
- support simple caluclation like +, -, *, / for adding expense 

**Add expense flow:**
- Amount → Category → Confirm
- Minimal taps for common cases
- Optional: add notes, change date, change paid_by

**Navigation:**
- Bottom tabs: Home, Subscriptions, Reports, Settings
- Swipe gestures for common actions

---

## Cost Estimate

| Service | Free Tier | Expected Cost |
|---------|-----------|---------------|
| Firebase Hosting | 10 GB/month | $0 |
| Firebase Functions | 2M invocations/month | $0 |
| Google Sheets API | 300 requests/minute | $0 |
| Gmail API | 1B quota units/day | $0 |
| Google Apps Script | 90 min/day runtime | $0 |

**Total monthly cost: $0** (within free tiers for personal use)

---

## BigQuery Integration (Future)

When you want deeper analysis:

1. Open BigQuery in Google Cloud Console
2. Add external data source → Google Sheets
3. Select your expense sheet
4. Query with SQL

No data migration needed. BigQuery reads directly from your Sheet.

---

## Decisions Made

- **Icon set:** Emoji (simple, no library needed)
- **Chart library:** Recharts (React-native, good documentation)

## Implementation Phases

**Phase 1 (MVP):**
- Core expense recording
- Category management
- Reports & analytics
- Google Sign-In
- Bilingual support (EN/繁中)

**Phase 2 (Later):**
- Subscription management
- Gmail invoice scanning
- Auto-confirmation flow

This allows getting the app working quickly, then adding advanced features iteratively.

---

## Next Steps

After design approval:

**Phase 1 Implementation:**
1. Create implementation plan
2. Set up Google Sheet with defined structure (Expenses, Categories, Users sheets)
3. Set up Firebase project (Hosting, Functions, Auth)
4. Build core expense entry flow
5. Add category management with AI suggestions
6. Build reports & analytics
7. Testing and deployment

**Phase 2 Implementation (future):**
1. Add Subscriptions sheet
2. Build subscription management UI
3. Implement Gmail invoice scanning
4. Add auto-confirmation flow
