# Expense Tracker Phase 1 Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first expense tracking web app with Google Sheets as the database, Google Sign-In authentication, and bilingual support (EN/繁中).

**Architecture:** Next.js App Router for frontend and API routes, Firebase Hosting for deployment, Google Sheets API for data persistence. All API routes validate user authentication and check against Users sheet for authorization.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Firebase Auth, Google Sheets API, Recharts, next-intl

**Spec Reference:** `expense-sheet/2026-02-17-expense-tracker-design.md`

---

## File Structure

```
expense-tracker/
├── .env.local                      # Firebase config, Sheet ID, Google credentials
├── .env.example                    # Template for env vars
├── firebase.json                   # Firebase hosting config
├── .firebaserc                     # Firebase project alias
├── next.config.js                  # Next.js config
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Home page (expense list + quick stats)
│   │   ├── login/page.tsx          # Login page
│   │   ├── add/page.tsx            # Add expense page
│   │   ├── edit/[id]/page.tsx      # Edit expense page
│   │   ├── reports/page.tsx        # Reports dashboard
│   │   ├── categories/page.tsx     # Category management
│   │   ├── settings/page.tsx       # User settings
│   │   └── api/
│   │       ├── auth/check/route.ts # Validate user against Users sheet
│   │       ├── expenses/route.ts   # GET all, POST new expense
│   │       ├── expenses/[id]/route.ts # GET, PUT, DELETE single expense
│   │       ├── categories/route.ts # GET all, POST new category
│   │       ├── categories/[id]/route.ts # PUT, DELETE category
│   │       ├── users/route.ts      # GET users list
│   │       └── suggest-category/route.ts # AI category suggestion
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Select.tsx
│   │   │   └── BottomNav.tsx
│   │   ├── expense/
│   │   │   ├── ExpenseForm.tsx
│   │   │   ├── ExpenseList.tsx
│   │   │   ├── ExpenseItem.tsx
│   │   │   ├── AmountInput.tsx
│   │   │   └── CategoryGrid.tsx
│   │   ├── reports/
│   │   │   ├── MonthlySummary.tsx
│   │   │   ├── TrendChart.tsx
│   │   │   ├── CategoryPieChart.tsx
│   │   │   └── TransactionList.tsx
│   │   ├── categories/
│   │   │   ├── CategoryList.tsx
│   │   │   └── CategoryForm.tsx
│   │   └── auth/
│   │       ├── AuthGuard.tsx
│   │       └── LoginButton.tsx
│   ├── lib/
│   │   ├── firebase.ts             # Firebase client init
│   │   ├── firebase-admin.ts       # Firebase admin for server
│   │   ├── sheets.ts               # Google Sheets API wrapper
│   │   ├── auth.ts                 # Auth utilities
│   │   └── calculator.ts           # Amount calculator logic
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useExpenses.ts
│   │   ├── useCategories.ts
│   │   └── useUsers.ts
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── LanguageContext.tsx
│   ├── types/
│   │   └── index.ts
│   └── i18n/
│       ├── config.ts
│       ├── en.json
│       └── zh.json
```

---

## End Results (Acceptance Criteria)

The following must be true when Phase 1 is complete:

### Functional Requirements

| # | Feature | End Result |
|---|---------|------------|
| 1 | **Sign In** | User can sign in with Google; unauthorized users see "Access Denied" |
| 2 | **Add Expense** | User can enter amount (with calculator), select category, and save; appears in Google Sheet within 3 seconds |
| 3 | **View Expenses** | Home page shows today's total, month's total, and recent 10 expenses |
| 4 | **Edit Expense** | User can tap an expense and modify date, amount, category, paid_by, notes |
| 5 | **Delete Expense** | User can delete an expense; removed from Sheet |
| 6 | **Categories** | User can view, add, edit, and soft-delete categories |
| 7 | **AI Suggestion** | When typing notes, app suggests top 3 categories based on keywords and history |
| 8 | **Reports** | User can view monthly summary, category pie chart, paid_by pie chart, and 6-month trend |
| 9 | **Language Toggle** | User can switch between English and Traditional Chinese; all UI updates |
| 10 | **Mobile UI** | App is usable on mobile with bottom navigation, responsive layout |

### Non-Functional Requirements

| # | Requirement | Acceptance |
|---|-------------|------------|
| 1 | **Performance** | Page load < 3s, expense save < 2s |
| 2 | **Accessibility** | All buttons have adequate tap targets (44px min) |
| 3 | **Security** | All API routes validate Firebase token; only Users sheet members can access |
| 4 | **Data Integrity** | Direct Sheet edits reflect immediately in app |

---

## Test Plan

### Manual Test Checklist

Run these tests after each chunk is complete:

#### Chunk 1-2: Setup & Auth
- [ ] `npm run dev` starts without errors
- [ ] Visiting `/login` shows Google sign-in button
- [ ] Clicking sign-in opens Google OAuth popup
- [ ] After sign-in, authorized user redirects to home
- [ ] After sign-in, unauthorized user sees "Access Denied"
- [ ] Sign out works and redirects to login

#### Chunk 3: Data Layer
- [ ] `GET /api/expenses` returns expenses from Sheet
- [ ] `POST /api/expenses` creates new row in Sheet
- [ ] `PUT /api/expenses/[id]` updates correct row
- [ ] `DELETE /api/expenses/[id]` clears correct row
- [ ] Same tests pass for `/api/categories`
- [ ] Unauthorized requests return 401

#### Chunk 4: Expense Entry (Use Visual Companion)
- [ ] Amount input shows calculator keypad
- [ ] Calculator supports +, -, *, / with preview
- [ ] Category grid displays all 20 default categories with emojis
- [ ] Selecting category highlights it
- [ ] Form flow: Amount → Category → Details → Save
- [ ] Saved expense appears in Sheet with correct values

#### Chunk 5: Categories (Use Visual Companion)
- [ ] Categories page lists all active categories
- [ ] Add category modal opens with emoji picker
- [ ] New category appears in list and Sheet
- [ ] Edit category updates Sheet
- [ ] Delete category sets is_active=FALSE

#### Chunk 6: Reports (Use Visual Companion)
- [ ] Monthly summary shows correct totals
- [ ] Pie charts render with correct proportions
- [ ] Trend line chart shows 6 months
- [ ] Month selector changes data displayed

#### Chunk 7: i18n
- [ ] English translations display correctly
- [ ] Chinese translations display correctly
- [ ] Language toggle switches all UI text
- [ ] Category names show in selected language

#### Chunk 8: Navigation & Deploy
- [ ] Bottom nav appears on all pages except /login and /add
- [ ] Navigation between pages works
- [ ] `firebase deploy` succeeds
- [ ] Deployed app loads and functions correctly

### Visual Companion Usage

For UI-intensive chunks (4, 5, 6, 8), use the visual companion to:
1. Preview component layouts before coding
2. Get feedback on mobile responsiveness
3. Validate chart designs
4. Test navigation flow

**Invoke visual companion for:**
- AmountInput calculator keypad layout
- CategoryGrid 4-column layout
- ExpenseForm multi-step flow
- Reports dashboard layout
- Bottom navigation design

---

## Chunk 1: Project Setup & Infrastructure

**End Result:**
- Next.js project runs locally with `npm run dev`
- TypeScript compiles without errors
- Google Sheet exists with Expenses, Categories, Users sheets
- Firebase project configured with Auth enabled
- Environment variables set for all services
- Service account has edit access to Sheet

**Verification:**
```bash
npm run dev        # App starts at localhost:3000
npx tsc --noEmit   # No TypeScript errors
```

---

### Task 1.1: Create Next.js Project

**Files:**
- Create: `expense-tracker/package.json`
- Create: `expense-tracker/tsconfig.json`
- Create: `expense-tracker/next.config.js`
- Create: `expense-tracker/tailwind.config.ts`
- Create: `expense-tracker/.env.example`

- [ ] **Step 1: Create Next.js project with TypeScript and Tailwind**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet
npx create-next-app@latest expense-tracker --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Select options:
- Would you like to use TypeScript? Yes
- Would you like to use ESLint? Yes
- Would you like to use Tailwind CSS? Yes
- Would you like to use `src/` directory? Yes
- Would you like to use App Router? Yes
- Would you like to customize the default import alias? No

- [ ] **Step 2: Verify project structure**

```bash
ls -la /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app
```

Expected: `layout.tsx`, `page.tsx`, `globals.css`

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
npm install firebase firebase-admin googleapis recharts date-fns uuid
npm install -D @types/uuid
```

- [ ] **Step 4: Create .env.example**

Create file `expense-tracker/.env.example`:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (for server-side)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Google Sheets
GOOGLE_SHEETS_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=

# AI Category Suggestion (optional, can use simple matching first)
ANTHROPIC_API_KEY=
```

- [ ] **Step 5: Commit**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
git init
git add .
git commit -m "chore: initialize Next.js project with TypeScript and Tailwind"
```

---

### Task 1.2: Create TypeScript Types

**Files:**
- Create: `expense-tracker/src/types/index.ts`

- [ ] **Step 1: Create types file**

Create file `expense-tracker/src/types/index.ts`:

```typescript
// Expense record from Google Sheet
export interface Expense {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  amount: number;
  category: string;
  paid_by: string;
  notes: string;
  subscription_id: string | null;
  status: 'confirmed' | 'pending';
  created_at: string; // ISO datetime
  created_by: string;
}

// For creating new expense (some fields auto-generated)
export interface CreateExpenseInput {
  date?: string; // defaults to today
  amount: number;
  category: string;
  paid_by?: string; // defaults to current user
  notes?: string;
}

// For updating expense
export interface UpdateExpenseInput {
  date?: string;
  amount?: number;
  category?: string;
  paid_by?: string;
  notes?: string;
  status?: 'confirmed' | 'pending';
}

// Category record from Google Sheet
export interface Category {
  id: string;
  name_en: string;
  name_zh: string;
  icon: string; // emoji
  sort_order: number;
  is_active: boolean;
}

// For creating new category
export interface CreateCategoryInput {
  name_en: string;
  name_zh: string;
  icon: string;
}

// User record from Google Sheet
export interface User {
  email: string;
  name: string;
  language: 'en' | 'zh';
  created_at: string;
}

// Auth state
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Report types
export interface MonthlySummary {
  month: string; // YYYY-MM
  total: number;
  byCategory: { category: string; amount: number; percentage: number }[];
  byPaidBy: { paid_by: string; amount: number; percentage: number }[];
  previousMonthTotal: number;
  changePercentage: number;
}

export interface TrendDataPoint {
  month: string;
  total: number;
}

// Language type
export type Language = 'en' | 'zh';
```

- [ ] **Step 2: Verify types compile**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions"
```

---

### Task 1.3: Set Up Google Sheet Structure

**Files:**
- Manual: Create Google Sheet with specified structure

- [ ] **Step 1: Create new Google Sheet**

Manual steps (document for user):
1. Go to https://sheets.google.com
2. Create new blank spreadsheet
3. Name it "Expense Tracker"
4. Note the Sheet ID from URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

- [ ] **Step 2: Create Expenses sheet**

In the first sheet (rename to "Expenses"), add headers in row 1:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| id | date | amount | category | paid_by | notes | subscription_id | status | created_at | created_by |

- [ ] **Step 3: Create Categories sheet**

Add new sheet named "Categories" with headers:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| id | name_en | name_zh | icon | sort_order | is_active |

Add default categories (rows 2-21):

```
cat-001,Eating Out,外食,🍜,1,TRUE
cat-002,Daily Necessities,日用品,🧴,2,TRUE
cat-003,Groceries,食材,🥬,3,TRUE
cat-004,Medical,醫療,🏥,4,TRUE
cat-005,Travel,旅遊,✈️,5,TRUE
cat-006,Transportation,交通,🚌,6,TRUE
cat-007,Digital,數位,💻,7,TRUE
cat-008,Babies,寶貝,👶,8,TRUE
cat-009,Clothing,衣服,👕,9,TRUE
cat-010,Sports,運動,🏃,10,TRUE
cat-011,Gifts,禮物,🎁,11,TRUE
cat-012,Tuition,學費,📚,12,TRUE
cat-013,Tolls,過路,🛣️,13,TRUE
cat-014,Equipment,設備,🔧,14,TRUE
cat-015,Fuel,加油,⛽,15,TRUE
cat-016,Entertainment,娛樂,🎬,16,TRUE
cat-017,Rent,房租,🏠,17,TRUE
cat-018,Shopping,購物,🛒,18,TRUE
cat-019,Car Repair,修車,🚗,19,TRUE
cat-020,Other,其他,📦,20,TRUE
```

- [ ] **Step 4: Create Users sheet**

Add new sheet named "Users" with headers:

| A | B | C | D |
|---|---|---|---|
| email | name | language | created_at |

Add yourself as first user (row 2):
```
your-email@gmail.com,Your Name,zh,2026-02-17T00:00:00Z
```

- [ ] **Step 5: Document Sheet ID**

Save the Sheet ID for `.env.local` configuration.

---

### Task 1.4: Set Up Google Cloud Project

**Files:**
- Manual: Google Cloud Console configuration

- [ ] **Step 1: Create Google Cloud project**

Manual steps:
1. Go to https://console.cloud.google.com
2. Create new project named "expense-tracker"
3. Note the project ID

- [ ] **Step 2: Enable APIs**

In Google Cloud Console:
1. Go to APIs & Services > Library
2. Search and enable:
   - Google Sheets API
   - Google Drive API (for sharing access)

- [ ] **Step 3: Create service account**

1. Go to APIs & Services > Credentials
2. Create Credentials > Service Account
3. Name: "expense-tracker-sheets"
4. Create and continue
5. Skip roles (we'll grant Sheet access directly)
6. Done

- [ ] **Step 4: Create service account key**

1. Click on the created service account
2. Keys tab > Add Key > Create new key
3. Choose JSON
4. Save the downloaded JSON file securely
5. Extract values for `.env.local`:
   - `client_email` → GOOGLE_SERVICE_ACCOUNT_EMAIL
   - `private_key` → GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

- [ ] **Step 5: Share Google Sheet with service account**

1. Open your Google Sheet
2. Click Share
3. Add the service account email (from step 4)
4. Give Editor access

---

### Task 1.5: Set Up Firebase Project

**Files:**
- Create: `expense-tracker/firebase.json`
- Create: `expense-tracker/.firebaserc`

- [ ] **Step 1: Create Firebase project**

Manual steps:
1. Go to https://console.firebase.google.com
2. Add project (can use same Google Cloud project from Task 1.4)
3. Disable Google Analytics (optional, not needed)

- [ ] **Step 2: Enable Authentication**

1. In Firebase Console, go to Authentication
2. Get started
3. Sign-in method tab
4. Enable Google provider
5. Configure OAuth consent screen if prompted

- [ ] **Step 3: Register web app**

1. Project Overview > Add app > Web
2. Name: "expense-tracker-web"
3. Check "Also set up Firebase Hosting"
4. Register app
5. Copy the config values for `.env.local`

- [ ] **Step 4: Get Firebase Admin credentials**

1. Project Settings > Service accounts
2. Generate new private key
3. Extract values for `.env.local`

- [ ] **Step 5: Install Firebase CLI**

```bash
npm install -g firebase-tools
firebase login
```

- [ ] **Step 6: Initialize Firebase in project**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
firebase init hosting
```

Select:
- Use existing project: your-project-id
- Public directory: out (we'll change this)
- Single-page app: No
- Automatic builds with GitHub: No

- [ ] **Step 7: Update firebase.json for Next.js**

Replace `expense-tracker/firebase.json`:

```json
{
  "hosting": {
    "source": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "frameworksBackend": {
      "region": "us-central1"
    }
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add firebase.json .firebaserc
git commit -m "chore: configure Firebase hosting"
```

---

### Task 1.6: Create Environment Configuration

**Files:**
- Create: `expense-tracker/.env.local` (do not commit)
- Update: `expense-tracker/.gitignore`

- [ ] **Step 1: Update .gitignore**

Add to `expense-tracker/.gitignore`:

```
# Environment variables
.env.local
.env.*.local

# Firebase
.firebase/
```

- [ ] **Step 2: Create .env.local from values gathered**

Create `expense-tracker/.env.local` with actual values from previous tasks:

```env
# Firebase Configuration (from Task 1.5 Step 3)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin (from Task 1.5 Step 4)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Sheets (from Task 1.4)
GOOGLE_SHEETS_ID=your-sheet-id-from-url
GOOGLE_SERVICE_ACCOUNT_EMAIL=expense-tracker-sheets@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

- [ ] **Step 3: Verify app starts**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
npm run dev
```

Expected: App runs at http://localhost:3000

- [ ] **Step 4: Commit .gitignore update**

```bash
git add .gitignore
git commit -m "chore: update gitignore for environment files"
```

---

## Chunk 2: Authentication

**End Result:**
- Login page renders with Google sign-in button
- Clicking button opens Google OAuth popup
- Successful sign-in checks user against Users sheet
- Authorized users redirect to home page
- Unauthorized users see "Access Denied" message
- AuthGuard protects all routes requiring auth
- Sign out clears session and redirects to login

**Verification:**
1. Open `/login` → see Google button
2. Sign in with authorized email → redirect to `/`
3. Sign in with unauthorized email → see "Access Denied"
4. Visit `/` without auth → redirect to `/login`

---

### Task 2.1: Firebase Client Initialization

**Files:**
- Create: `expense-tracker/src/lib/firebase.ts`

- [ ] **Step 1: Create Firebase client library**

Create file `expense-tracker/src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
```

- [ ] **Step 2: Verify import works**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase.ts
git commit -m "feat: add Firebase client initialization"
```

---

### Task 2.2: Firebase Admin Initialization

**Files:**
- Create: `expense-tracker/src/lib/firebase-admin.ts`

- [ ] **Step 1: Create Firebase admin library**

Create file `expense-tracker/src/lib/firebase-admin.ts`:

```typescript
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
};

// Initialize Firebase Admin only once
const adminApp = getApps().length === 0
  ? initializeApp(firebaseAdminConfig)
  : getApps()[0];

const adminAuth = getAuth(adminApp);

export { adminApp, adminAuth };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/firebase-admin.ts
git commit -m "feat: add Firebase admin initialization"
```

---

### Task 2.3: Auth Context Provider

**Files:**
- Create: `expense-tracker/src/context/AuthContext.tsx`

- [ ] **Step 1: Create AuthContext**

Create file `expense-tracker/src/context/AuthContext.tsx`:

```typescript
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { AuthUser } from '@/types';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthorized: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const authUser: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(authUser);

        // Check if user is authorized (exists in Users sheet)
        try {
          const token = await firebaseUser.getIdToken();
          const response = await fetch('/api/auth/check', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();
          setIsAuthorized(data.authorized);
        } catch {
          setIsAuthorized(false);
        }
      } else {
        setUser(null);
        setIsAuthorized(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthorized, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/context/AuthContext.tsx
git commit -m "feat: add AuthContext with Google sign-in"
```

---

### Task 2.4: Google Sheets API Wrapper

**Files:**
- Create: `expense-tracker/src/lib/sheets.ts`

- [ ] **Step 1: Create Sheets API wrapper**

Create file `expense-tracker/src/lib/sheets.ts`:

```typescript
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;

// Create auth client
function getAuthClient() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// Get sheets instance
function getSheets() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

// Generic read function
export async function readSheet(sheetName: string): Promise<string[][]> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  return response.data.values || [];
}

// Generic append function
export async function appendToSheet(sheetName: string, values: string[][]): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

// Generic update function (update specific row)
export async function updateSheetRow(
  sheetName: string,
  rowIndex: number,
  values: string[]
): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// Delete row (by clearing it - actual deletion requires batchUpdate)
export async function clearSheetRow(sheetName: string, rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
  });
}

// Find row index by ID (column A)
export async function findRowById(sheetName: string, id: string): Promise<number | null> {
  const data = await readSheet(sheetName);
  for (let i = 1; i < data.length; i++) { // Skip header row
    if (data[i][0] === id) {
      return i + 1; // Sheet rows are 1-indexed
    }
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/sheets.ts
git commit -m "feat: add Google Sheets API wrapper"
```

---

### Task 2.5: Auth Check API Route

**Files:**
- Create: `expense-tracker/src/app/api/auth/check/route.ts`

- [ ] **Step 1: Create auth check API**

Create directories and file:

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/api/auth/check
```

Create file `expense-tracker/src/app/api/auth/check/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { readSheet } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ authorized: false, error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userEmail = decodedToken.email;

    if (!userEmail) {
      return NextResponse.json({ authorized: false, error: 'No email in token' }, { status: 401 });
    }

    // Check if user exists in Users sheet
    const usersData = await readSheet('Users');
    const userEmails = usersData.slice(1).map(row => row[0]?.toLowerCase()); // Skip header, get email column
    const isAuthorized = userEmails.includes(userEmail.toLowerCase());

    if (isAuthorized) {
      // Find user's preferred language
      const userRow = usersData.find(row => row[0]?.toLowerCase() === userEmail.toLowerCase());
      const language = userRow?.[2] || 'en';

      return NextResponse.json({
        authorized: true,
        email: userEmail,
        language
      });
    }

    return NextResponse.json({ authorized: false, error: 'User not in allowed list' }, { status: 403 });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authorized: false, error: 'Invalid token' }, { status: 401 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/check/route.ts
git commit -m "feat: add auth check API endpoint"
```

---

### Task 2.6: Auth Guard Component

**Files:**
- Create: `expense-tracker/src/components/auth/AuthGuard.tsx`

- [ ] **Step 1: Create AuthGuard component**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/components/auth
```

Create file `expense-tracker/src/components/auth/AuthGuard.tsx`:

```typescript
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, isAuthorized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            Your account ({user.email}) is not authorized to use this app.
          </p>
          <p className="text-sm text-gray-500">
            Please contact the administrator to get access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/auth/AuthGuard.tsx
git commit -m "feat: add AuthGuard component"
```

---

### Task 2.7: Login Page

**Files:**
- Create: `expense-tracker/src/app/login/page.tsx`
- Create: `expense-tracker/src/components/auth/LoginButton.tsx`

- [ ] **Step 1: Create LoginButton component**

Create file `expense-tracker/src/components/auth/LoginButton.tsx`:

```typescript
'use client';

import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export function LoginButton() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span className="text-gray-700 font-medium">
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </span>
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create login page**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/login
```

Create file `expense-tracker/src/app/login/page.tsx`:

```typescript
'use client';

import { useAuth } from '@/context/AuthContext';
import { LoginButton } from '@/components/auth/LoginButton';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { user, isAuthorized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && isAuthorized) {
      router.push('/');
    }
  }, [user, isAuthorized, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Expense Tracker</h1>
          <p className="text-gray-600">Sign in to manage your expenses</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <LoginButton />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/LoginButton.tsx src/app/login/page.tsx
git commit -m "feat: add login page with Google sign-in"
```

---

### Task 2.8: Update Root Layout with Providers

**Files:**
- Modify: `expense-tracker/src/app/layout.tsx`

- [ ] **Step 1: Update root layout**

Replace `expense-tracker/src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Personal expense tracking app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add AuthProvider to root layout"
```

---

### Task 2.9: Test Authentication Flow

- [ ] **Step 1: Start development server**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
npm run dev
```

- [ ] **Step 2: Test login flow**

1. Open http://localhost:3000/login
2. Click "Sign in with Google"
3. Complete Google sign-in
4. Verify redirect behavior based on authorization

- [ ] **Step 3: Verify auth check API**

Open browser dev tools, check Network tab for `/api/auth/check` response.

Expected: `{ authorized: true/false, ... }`

---

## Chunk 3: Core Data Layer (API Routes)

**End Result:**
- All API routes validate Firebase auth token
- `GET /api/users` returns users from Sheet
- `GET /api/expenses` returns expenses with optional filters
- `POST /api/expenses` creates expense in Sheet
- `PUT /api/expenses/[id]` updates expense
- `DELETE /api/expenses/[id]` removes expense
- Same CRUD operations work for categories
- React hooks (`useExpenses`, `useCategories`, `useUsers`) fetch and cache data

**Verification:**
```bash
# Test with curl (replace TOKEN with valid Firebase token)
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/expenses
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":100,"category":"Eating Out"}' http://localhost:3000/api/expenses
```
Then verify row appears in Google Sheet.

---

### Task 3.1: Users API Route

**Files:**
- Create: `expense-tracker/src/app/api/users/route.ts`

- [ ] **Step 1: Create users API**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/api/users
```

Create file `expense-tracker/src/app/api/users/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { readSheet } from '@/lib/sheets';
import { User } from '@/types';

// Helper to verify auth and get user email
async function verifyAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.email || null;
  } catch {
    return null;
  }
}

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await readSheet('Users');
    const users: User[] = data.slice(1).map(row => ({
      email: row[0] || '',
      name: row[1] || '',
      language: (row[2] as 'en' | 'zh') || 'en',
      created_at: row[3] || '',
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/users/route.ts
git commit -m "feat: add users API endpoint"
```

---

### Task 3.2: Categories API Routes

**Files:**
- Create: `expense-tracker/src/app/api/categories/route.ts`
- Create: `expense-tracker/src/app/api/categories/[id]/route.ts`

- [ ] **Step 1: Create categories list/create API**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/api/categories
```

Create file `expense-tracker/src/app/api/categories/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { readSheet, appendToSheet } from '@/lib/sheets';
import { Category, CreateCategoryInput } from '@/types';
import { v4 as uuidv4 } from 'uuid';

async function verifyAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.email || null;
  } catch {
    return null;
  }
}

// GET /api/categories - Get all active categories
export async function GET(request: NextRequest) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await readSheet('Categories');
    const categories: Category[] = data.slice(1)
      .filter(row => row[5]?.toUpperCase() === 'TRUE') // is_active
      .map(row => ({
        id: row[0] || '',
        name_en: row[1] || '',
        name_zh: row[2] || '',
        icon: row[3] || '',
        sort_order: parseInt(row[4]) || 0,
        is_active: row[5]?.toUpperCase() === 'TRUE',
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST /api/categories - Create new category
export async function POST(request: NextRequest) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: CreateCategoryInput = await request.json();

    // Get current max sort_order
    const data = await readSheet('Categories');
    const maxSortOrder = Math.max(...data.slice(1).map(row => parseInt(row[4]) || 0), 0);

    const newCategory: Category = {
      id: `cat-${uuidv4().slice(0, 8)}`,
      name_en: body.name_en,
      name_zh: body.name_zh,
      icon: body.icon,
      sort_order: maxSortOrder + 1,
      is_active: true,
    };

    await appendToSheet('Categories', [[
      newCategory.id,
      newCategory.name_en,
      newCategory.name_zh,
      newCategory.icon,
      newCategory.sort_order.toString(),
      'TRUE',
    ]]);

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create single category API**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/api/categories/\[id\]
```

Create file `expense-tracker/src/app/api/categories/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { readSheet, updateSheetRow, findRowById } from '@/lib/sheets';

async function verifyAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.email || null;
  } catch {
    return null;
  }
}

// PUT /api/categories/[id] - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
    const body = await request.json();

    const rowIndex = await findRowById('Categories', id);
    if (!rowIndex) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Read current row to merge updates
    const data = await readSheet('Categories');
    const currentRow = data[rowIndex - 1]; // Convert to 0-indexed

    const updatedRow = [
      id,
      body.name_en ?? currentRow[1],
      body.name_zh ?? currentRow[2],
      body.icon ?? currentRow[3],
      body.sort_order?.toString() ?? currentRow[4],
      body.is_active !== undefined ? (body.is_active ? 'TRUE' : 'FALSE') : currentRow[5],
    ];

    await updateSheetRow('Categories', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/categories/[id] - Soft delete (set is_active = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;

    const rowIndex = await findRowById('Categories', id);
    if (!rowIndex) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const data = await readSheet('Categories');
    const currentRow = data[rowIndex - 1];
    currentRow[5] = 'FALSE'; // Set is_active to false

    await updateSheetRow('Categories', rowIndex, currentRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/categories/
git commit -m "feat: add categories API endpoints"
```

---

### Task 3.3: Expenses API Routes

**Files:**
- Create: `expense-tracker/src/app/api/expenses/route.ts`
- Create: `expense-tracker/src/app/api/expenses/[id]/route.ts`

- [ ] **Step 1: Create expenses list/create API**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/api/expenses
```

Create file `expense-tracker/src/app/api/expenses/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { readSheet, appendToSheet } from '@/lib/sheets';
import { Expense, CreateExpenseInput } from '@/types';
import { v4 as uuidv4 } from 'uuid';

async function verifyAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.email || null;
  } catch {
    return null;
  }
}

// GET /api/expenses - Get expenses with optional filters
export async function GET(request: NextRequest) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
    const paidBy = searchParams.get('paidBy');

    const data = await readSheet('Expenses');
    let expenses: Expense[] = data.slice(1)
      .filter(row => row[0]) // Has ID
      .map(row => ({
        id: row[0],
        date: row[1],
        amount: parseFloat(row[2]) || 0,
        category: row[3],
        paid_by: row[4],
        notes: row[5] || '',
        subscription_id: row[6] || null,
        status: (row[7] as 'confirmed' | 'pending') || 'confirmed',
        created_at: row[8],
        created_by: row[9],
      }));

    // Apply filters
    if (startDate) {
      expenses = expenses.filter(e => e.date >= startDate);
    }
    if (endDate) {
      expenses = expenses.filter(e => e.date <= endDate);
    }
    if (category) {
      expenses = expenses.filter(e => e.category === category);
    }
    if (paidBy) {
      expenses = expenses.filter(e => e.paid_by === paidBy);
    }

    // Sort by date descending
    expenses.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST /api/expenses - Create new expense
export async function POST(request: NextRequest) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: CreateExpenseInput = await request.json();
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const newExpense: Expense = {
      id: `exp-${uuidv4().slice(0, 8)}`,
      date: body.date || today,
      amount: body.amount,
      category: body.category,
      paid_by: body.paid_by || userEmail,
      notes: body.notes || '',
      subscription_id: null,
      status: 'confirmed',
      created_at: now,
      created_by: userEmail,
    };

    await appendToSheet('Expenses', [[
      newExpense.id,
      newExpense.date,
      newExpense.amount.toString(),
      newExpense.category,
      newExpense.paid_by,
      newExpense.notes,
      newExpense.subscription_id || '',
      newExpense.status,
      newExpense.created_at,
      newExpense.created_by,
    ]]);

    return NextResponse.json({ expense: newExpense }, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create single expense API**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/api/expenses/\[id\]
```

Create file `expense-tracker/src/app/api/expenses/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { readSheet, updateSheetRow, clearSheetRow, findRowById } from '@/lib/sheets';
import { UpdateExpenseInput } from '@/types';

async function verifyAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.email || null;
  } catch {
    return null;
  }
}

// GET /api/expenses/[id] - Get single expense
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
    const rowIndex = await findRowById('Expenses', id);

    if (!rowIndex) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const data = await readSheet('Expenses');
    const row = data[rowIndex - 1];

    const expense = {
      id: row[0],
      date: row[1],
      amount: parseFloat(row[2]) || 0,
      category: row[3],
      paid_by: row[4],
      notes: row[5] || '',
      subscription_id: row[6] || null,
      status: row[7] || 'confirmed',
      created_at: row[8],
      created_by: row[9],
    };

    return NextResponse.json({ expense });
  } catch (error) {
    console.error('Error fetching expense:', error);
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 });
  }
}

// PUT /api/expenses/[id] - Update expense
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
    const body: UpdateExpenseInput = await request.json();

    const rowIndex = await findRowById('Expenses', id);
    if (!rowIndex) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const data = await readSheet('Expenses');
    const currentRow = data[rowIndex - 1];

    // Only update editable fields (preserve created_at, created_by)
    const updatedRow = [
      id,
      body.date ?? currentRow[1],
      body.amount?.toString() ?? currentRow[2],
      body.category ?? currentRow[3],
      body.paid_by ?? currentRow[4],
      body.notes ?? currentRow[5],
      currentRow[6], // subscription_id - not editable via this endpoint
      body.status ?? currentRow[7],
      currentRow[8], // created_at - non-editable
      currentRow[9], // created_by - non-editable
    ];

    await updateSheetRow('Expenses', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

// DELETE /api/expenses/[id] - Delete expense
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;

    const rowIndex = await findRowById('Expenses', id);
    if (!rowIndex) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await clearSheetRow('Expenses', rowIndex);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/expenses/
git commit -m "feat: add expenses API endpoints"
```

---

### Task 3.4: Data Fetching Hooks

**Files:**
- Create: `expense-tracker/src/hooks/useExpenses.ts`
- Create: `expense-tracker/src/hooks/useCategories.ts`
- Create: `expense-tracker/src/hooks/useUsers.ts`

- [ ] **Step 1: Create hooks directory and useExpenses**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/hooks
```

Create file `expense-tracker/src/hooks/useExpenses.ts`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { Expense, CreateExpenseInput, UpdateExpenseInput } from '@/types';

interface UseExpensesOptions {
  startDate?: string;
  endDate?: string;
  category?: string;
  paidBy?: string;
}

export function useExpenses(options: UseExpensesOptions = {}) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (options.startDate) params.set('startDate', options.startDate);
      if (options.endDate) params.set('endDate', options.endDate);
      if (options.category) params.set('category', options.category);
      if (options.paidBy) params.set('paidBy', options.paidBy);

      const response = await fetch(`/api/expenses?${params}`, { headers });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);
      setExpenses(data.expenses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  }, [options.startDate, options.endDate, options.category, options.paidBy]);

  useEffect(() => {
    if (auth.currentUser) {
      fetchExpenses();
    }
  }, [fetchExpenses]);

  const createExpense = async (input: CreateExpenseInput): Promise<Expense> => {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    await fetchExpenses(); // Refresh list
    return data.expense;
  };

  const updateExpense = async (id: string, input: UpdateExpenseInput): Promise<void> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    await fetchExpenses(); // Refresh list
  };

  const deleteExpense = async (id: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/expenses/${id}`, {
      method: 'DELETE',
      headers,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    await fetchExpenses(); // Refresh list
  };

  return {
    expenses,
    loading,
    error,
    refetch: fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
  };
}
```

- [ ] **Step 2: Create useCategories hook**

Create file `expense-tracker/src/hooks/useCategories.ts`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { Category, CreateCategoryInput } from '@/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/categories', { headers });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);
      setCategories(data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchCategories();
    }
  }, [fetchCategories]);

  const createCategory = async (input: CreateCategoryInput): Promise<Category> => {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    await fetchCategories();
    return data.category;
  };

  const updateCategory = async (id: string, input: Partial<Category>): Promise<void> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    await fetchCategories();
  };

  const deleteCategory = async (id: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/categories/${id}`, {
      method: 'DELETE',
      headers,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    await fetchCategories();
  };

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
```

- [ ] **Step 3: Create useUsers hook**

Create file `expense-tracker/src/hooks/useUsers.ts`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { User } from '@/types';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/users', { headers });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchUsers();
    }
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: add data fetching hooks for expenses, categories, users"
```

---

## Chunk 4: Expense Entry UI

**🎨 Visual Companion:** Use for AmountInput keypad layout, CategoryGrid design, and ExpenseForm multi-step flow.

**End Result:**
- Calculator keypad with 0-9, +, -, *, /, =, C, ⌫
- Expression preview shows calculated result (e.g., "100+50" → "= 150")
- Category grid shows 4 columns with emoji + name
- Selected category has blue highlight
- 3-step expense form: Amount → Category → Details
- "Save" creates expense in Sheet and redirects to home

**Verification:**
1. Open `/add`
2. Enter "100+50" → see "= 150" preview
3. Press "=" → amount becomes 150
4. Select "Eating Out" → blue highlight
5. Press "Next" → see details form
6. Press "Save" → redirects to home, expense in Sheet

---

### Task 4.1: Calculator Logic for Amount Input

**Files:**
- Create: `expense-tracker/src/lib/calculator.ts`

- [ ] **Step 1: Create calculator utility**

Create file `expense-tracker/src/lib/calculator.ts`:

```typescript
// Simple calculator that supports +, -, *, /
export function evaluateExpression(expression: string): number | null {
  // Remove spaces
  const cleaned = expression.replace(/\s/g, '');

  // Validate: only allow digits, operators, and decimal points
  if (!/^[\d+\-*/.,]+$/.test(cleaned)) {
    return null;
  }

  // Replace comma with period for decimal
  const normalized = cleaned.replace(/,/g, '.');

  try {
    // Use Function constructor for safe evaluation
    // Only allows basic arithmetic
    const result = new Function(`return ${normalized}`)();

    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return null;
    }

    // Round to 2 decimal places
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

// Format number for display
export function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// Parse display string back to number
export function parseAmount(display: string): number {
  const cleaned = display.replace(/,/g, '');
  return parseFloat(cleaned) || 0;
}
```

- [ ] **Step 2: Test calculator logic**

Create a simple test in the terminal:

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
node -e "
const expr = '100+50*2';
const result = new Function('return ' + expr)();
console.log('Expression:', expr);
console.log('Result:', result);
console.log('Expected: 200');
"
```

Expected: Result: 200

- [ ] **Step 3: Commit**

```bash
git add src/lib/calculator.ts
git commit -m "feat: add calculator utility for amount input"
```

---

### Task 4.2: UI Components

**Files:**
- Create: `expense-tracker/src/components/ui/Button.tsx`
- Create: `expense-tracker/src/components/ui/Input.tsx`
- Create: `expense-tracker/src/components/ui/Modal.tsx`

- [ ] **Step 1: Create Button component**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/components/ui
```

Create file `expense-tracker/src/components/ui/Button.tsx`:

```typescript
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500': variant === 'primary',
            'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500': variant === 'secondary',
            'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500': variant === 'outline',
            'text-gray-700 hover:bg-gray-100 focus:ring-gray-500': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500': variant === 'danger',
          },
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

- [ ] **Step 2: Create utility for className merging**

Create file `expense-tracker/src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Install clsx:

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
npm install clsx tailwind-merge
```

- [ ] **Step 3: Create Input component**

Create file `expense-tracker/src/components/ui/Input.tsx`:

```typescript
import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-3 py-2 border rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            error ? 'border-red-500' : 'border-gray-300',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

- [ ] **Step 4: Create Modal component**

Create file `expense-tracker/src/components/ui/Modal.tsx`:

```typescript
'use client';

import { useEffect, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-2xl',
          'max-h-[90vh] overflow-auto',
          className
        )}
      >
        {title && (
          <div className="sticky top-0 bg-white border-b px-4 py-3">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ src/lib/utils.ts
git commit -m "feat: add reusable UI components (Button, Input, Modal)"
```

---

### Task 4.3: Amount Input Component

**Files:**
- Create: `expense-tracker/src/components/expense/AmountInput.tsx`

- [ ] **Step 1: Create AmountInput component**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/components/expense
```

Create file `expense-tracker/src/components/expense/AmountInput.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { evaluateExpression, formatAmount } from '@/lib/calculator';
import { cn } from '@/lib/utils';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function AmountInput({ value, onChange, className }: AmountInputProps) {
  const [expression, setExpression] = useState(value > 0 ? value.toString() : '');
  const [preview, setPreview] = useState<number | null>(null);

  useEffect(() => {
    // Update preview when expression contains operators
    if (/[+\-*/]/.test(expression)) {
      const result = evaluateExpression(expression);
      setPreview(result);
    } else {
      setPreview(null);
    }
  }, [expression]);

  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      setExpression('');
      onChange(0);
      return;
    }

    if (key === '⌫') {
      setExpression(prev => prev.slice(0, -1));
      return;
    }

    if (key === '=') {
      const result = evaluateExpression(expression);
      if (result !== null) {
        setExpression(result.toString());
        onChange(result);
      }
      return;
    }

    // Prevent multiple operators in a row
    const lastChar = expression.slice(-1);
    const isOperator = ['+', '-', '*', '/'].includes(key);
    const lastIsOperator = ['+', '-', '*', '/'].includes(lastChar);

    if (isOperator && lastIsOperator) {
      // Replace last operator
      setExpression(prev => prev.slice(0, -1) + key);
      return;
    }

    // Prevent multiple decimal points in same number
    if (key === '.') {
      const parts = expression.split(/[+\-*/]/);
      const currentPart = parts[parts.length - 1];
      if (currentPart.includes('.')) return;
    }

    setExpression(prev => prev + key);
  };

  const keys = [
    ['7', '8', '9', '/'],
    ['4', '5', '6', '*'],
    ['1', '2', '3', '-'],
    ['C', '0', '.', '+'],
    ['⌫', '='],
  ];

  return (
    <div className={cn('w-full', className)}>
      {/* Display */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900 min-h-[2.5rem]">
            {expression || '0'}
          </div>
          {preview !== null && (
            <div className="text-lg text-gray-500 mt-1">
              = {formatAmount(preview)}
            </div>
          )}
        </div>
      </div>

      {/* Keypad */}
      <div className="grid gap-2">
        {keys.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={cn(
              'grid gap-2',
              rowIndex === 4 ? 'grid-cols-2' : 'grid-cols-4'
            )}
          >
            {row.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => handleKeyPress(key)}
                className={cn(
                  'py-4 text-xl font-medium rounded-lg transition-colors',
                  'active:scale-95',
                  key === '='
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : key === 'C' || key === '⌫'
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : ['+', '-', '*', '/'].includes(key)
                    ? 'bg-gray-100 text-blue-600 hover:bg-gray-200'
                    : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
                )}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/expense/AmountInput.tsx
git commit -m "feat: add AmountInput component with calculator"
```

---

### Task 4.4: Category Grid Component

**Files:**
- Create: `expense-tracker/src/components/expense/CategoryGrid.tsx`

- [ ] **Step 1: Create CategoryGrid component**

Create file `expense-tracker/src/components/expense/CategoryGrid.tsx`:

```typescript
'use client';

import { Category, Language } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryGridProps {
  categories: Category[];
  selected: string | null;
  onSelect: (categoryName: string) => void;
  language: Language;
  className?: string;
}

export function CategoryGrid({
  categories,
  selected,
  onSelect,
  language,
  className,
}: CategoryGridProps) {
  return (
    <div className={cn('grid grid-cols-4 gap-2', className)}>
      {categories.map(category => {
        const name = language === 'zh' ? category.name_zh : category.name_en;
        const isSelected = selected === category.name_en; // Use English name as key

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.name_en)}
            className={cn(
              'flex flex-col items-center justify-center p-3 rounded-lg transition-all',
              'border-2',
              isSelected
                ? 'border-blue-500 bg-blue-50'
                : 'border-transparent bg-gray-50 hover:bg-gray-100'
            )}
          >
            <span className="text-2xl mb-1">{category.icon}</span>
            <span className="text-xs text-center line-clamp-2">{name}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/expense/CategoryGrid.tsx
git commit -m "feat: add CategoryGrid component"
```

---

### Task 4.5: Expense Form Component

**Files:**
- Create: `expense-tracker/src/components/expense/ExpenseForm.tsx`

- [ ] **Step 1: Create ExpenseForm component**

Create file `expense-tracker/src/components/expense/ExpenseForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { AmountInput } from './AmountInput';
import { CategoryGrid } from './CategoryGrid';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Category, User, CreateExpenseInput, Language } from '@/types';
import { cn } from '@/lib/utils';

interface ExpenseFormProps {
  categories: Category[];
  users: User[];
  currentUserEmail: string;
  language: Language;
  onSubmit: (data: CreateExpenseInput) => Promise<void>;
  onCancel: () => void;
}

type Step = 'amount' | 'category' | 'details';

export function ExpenseForm({
  categories,
  users,
  currentUserEmail,
  language,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState(currentUserEmail);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const labels = {
    en: {
      amount: 'Amount',
      category: 'Category',
      details: 'Details',
      date: 'Date',
      paidBy: 'Paid by',
      notes: 'Notes (optional)',
      next: 'Next',
      back: 'Back',
      save: 'Save',
      cancel: 'Cancel',
    },
    zh: {
      amount: '金額',
      category: '分類',
      details: '詳細',
      date: '日期',
      paidBy: '付款人',
      notes: '備註（選填）',
      next: '下一步',
      back: '返回',
      save: '儲存',
      cancel: '取消',
    },
  };

  const t = labels[language];

  const handleSubmit = async () => {
    if (!category || amount <= 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        amount,
        category,
        date,
        paid_by: paidBy,
        notes,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedToCategory = amount > 0;
  const canProceedToDetails = category !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 py-4">
        {(['amount', 'category', 'details'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              step === s ? 'bg-blue-600' : 'bg-gray-300'
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto px-4">
        {step === 'amount' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-center">{t.amount}</h2>
            <AmountInput value={amount} onChange={setAmount} />
          </div>
        )}

        {step === 'category' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-center">{t.category}</h2>
            <CategoryGrid
              categories={categories}
              selected={category}
              onSelect={setCategory}
              language={language}
            />
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4 text-center">{t.details}</h2>

            <Input
              type="date"
              label={t.date}
              value={date}
              onChange={e => setDate(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.paidBy}
              </label>
              <select
                value={paidBy}
                onChange={e => setPaidBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {users.map(user => (
                  <option key={user.email} value={user.email}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label={t.notes}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={language === 'zh' ? '輸入備註...' : 'Enter notes...'}
            />

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mt-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t.amount}</span>
                <span className="text-xl font-bold">TWD {amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-600">{t.category}</span>
                <span>
                  {categories.find(c => c.name_en === category)?.[language === 'zh' ? 'name_zh' : 'name_en']}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-3">
          {step === 'amount' && (
            <>
              <Button variant="outline" onClick={onCancel} className="flex-1">
                {t.cancel}
              </Button>
              <Button
                onClick={() => setStep('category')}
                disabled={!canProceedToCategory}
                className="flex-1"
              >
                {t.next}
              </Button>
            </>
          )}

          {step === 'category' && (
            <>
              <Button variant="outline" onClick={() => setStep('amount')} className="flex-1">
                {t.back}
              </Button>
              <Button
                onClick={() => setStep('details')}
                disabled={!canProceedToDetails}
                className="flex-1"
              >
                {t.next}
              </Button>
            </>
          )}

          {step === 'details' && (
            <>
              <Button variant="outline" onClick={() => setStep('category')} className="flex-1">
                {t.back}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? '...' : t.save}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/expense/ExpenseForm.tsx
git commit -m "feat: add ExpenseForm component with multi-step flow"
```

---

### Task 4.6: Add Expense Page

**Files:**
- Create: `expense-tracker/src/app/add/page.tsx`

- [ ] **Step 1: Create add expense page**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/add
```

Create file `expense-tracker/src/app/add/page.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { ExpenseForm } from '@/components/expense/ExpenseForm';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { useCategories } from '@/hooks/useCategories';
import { useUsers } from '@/hooks/useUsers';
import { useExpenses } from '@/hooks/useExpenses';
import { CreateExpenseInput } from '@/types';

export default function AddExpensePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const { users, loading: usersLoading } = useUsers();
  const { createExpense } = useExpenses();

  // TODO: Get from user preferences
  const language = 'zh';

  const handleSubmit = async (data: CreateExpenseInput) => {
    await createExpense(data);
    router.push('/');
  };

  const handleCancel = () => {
    router.back();
  };

  if (categoriesLoading || usersLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <ExpenseForm
          categories={categories}
          users={users}
          currentUserEmail={user?.email || ''}
          language={language}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/add/page.tsx
git commit -m "feat: add expense entry page"
```

---

This plan continues with Chunks 5-8 covering:
- **Chunk 5:** Category Management & AI Suggestions
- **Chunk 6:** Reports & Analytics (charts, filters)
- **Chunk 7:** Internationalization (i18n)
- **Chunk 8:** Navigation, Settings, Polish & Deploy

---

## Chunk 5: Category Management & AI Suggestions

**🎨 Visual Companion:** Use for CategoryList layout and CategoryForm emoji picker design.

**End Result:**
- Categories page lists all active categories with emoji, English name, Chinese name
- Edit/delete buttons on each row
- "Add Category" button opens modal
- Modal has emoji picker (32 common emojis)
- Creating category adds row to Sheet
- Deleting category sets is_active=FALSE (soft delete)
- AI suggestion API returns top 3 categories based on notes text

**Verification:**
1. Open `/categories` → see all 20 default categories
2. Click "Add" → modal with form appears
3. Enter "Coffee", "咖啡", select ☕ → save
4. New category appears in list and Sheet
5. Click delete on a category → is_active becomes FALSE in Sheet
6. Test AI: `POST /api/suggest-category` with `{"notes":"uber ride"}` → returns `["Transportation"]`

---

### Task 5.1: Category List Component

**Files:**
- Create: `expense-tracker/src/components/categories/CategoryList.tsx`

- [ ] **Step 1: Create CategoryList component**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/components/categories
```

Create file `expense-tracker/src/components/categories/CategoryList.tsx`:

```typescript
'use client';

import { Category, Language } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryListProps {
  categories: Category[];
  language: Language;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

export function CategoryList({
  categories,
  language,
  onEdit,
  onDelete,
}: CategoryListProps) {
  return (
    <div className="space-y-2">
      {categories.map(category => {
        const name = language === 'zh' ? category.name_zh : category.name_en;

        return (
          <div
            key={category.id}
            className="flex items-center justify-between p-3 bg-white rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{category.icon}</span>
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-sm text-gray-500">
                  {language === 'zh' ? category.name_en : category.name_zh}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(category)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
              >
                ✏️
              </button>
              <button
                onClick={() => onDelete(category.id)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
              >
                🗑️
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/categories/CategoryList.tsx
git commit -m "feat: add CategoryList component"
```

---

### Task 5.2: Category Form Component

**Files:**
- Create: `expense-tracker/src/components/categories/CategoryForm.tsx`

- [ ] **Step 1: Create CategoryForm component**

Create file `expense-tracker/src/components/categories/CategoryForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Category, CreateCategoryInput, Language } from '@/types';

interface CategoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCategoryInput) => Promise<void>;
  category?: Category; // If provided, editing mode
  language: Language;
}

// Common emoji options for categories
const EMOJI_OPTIONS = [
  '🍜', '🧴', '🥬', '🏥', '✈️', '🚌', '💻', '👶',
  '👕', '🏃', '🎁', '📚', '🛣️', '🔧', '⛽', '🎬',
  '🏠', '🛒', '🚗', '📦', '💰', '☕', '🍺', '🎮',
  '📱', '💊', '🐕', '🌿', '🎨', '✂️', '🔌', '🎵',
];

export function CategoryForm({
  isOpen,
  onClose,
  onSubmit,
  category,
  language,
}: CategoryFormProps) {
  const [nameEn, setNameEn] = useState(category?.name_en || '');
  const [nameZh, setNameZh] = useState(category?.name_zh || '');
  const [icon, setIcon] = useState(category?.icon || '📦');
  const [submitting, setSubmitting] = useState(false);

  const labels = {
    en: {
      title: category ? 'Edit Category' : 'New Category',
      nameEn: 'English Name',
      nameZh: 'Chinese Name',
      icon: 'Icon',
      save: 'Save',
      cancel: 'Cancel',
    },
    zh: {
      title: category ? '編輯分類' : '新增分類',
      nameEn: '英文名稱',
      nameZh: '中文名稱',
      icon: '圖示',
      save: '儲存',
      cancel: '取消',
    },
  };

  const t = labels[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim() || !nameZh.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name_en: nameEn.trim(),
        name_zh: nameZh.trim(),
        icon,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.nameEn}
          value={nameEn}
          onChange={e => setNameEn(e.target.value)}
          placeholder="e.g., Food"
          required
        />

        <Input
          label={t.nameZh}
          value={nameZh}
          onChange={e => setNameZh(e.target.value)}
          placeholder="例如：餐飲"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.icon}
          </label>
          <div className="grid grid-cols-8 gap-2">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={cn(
                  'text-2xl p-2 rounded-lg transition-colors',
                  icon === emoji
                    ? 'bg-blue-100 ring-2 ring-blue-500'
                    : 'hover:bg-gray-100'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t.cancel}
          </Button>
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? '...' : t.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/categories/CategoryForm.tsx
git commit -m "feat: add CategoryForm component"
```

---

### Task 5.3: Categories Page

**Files:**
- Create: `expense-tracker/src/app/categories/page.tsx`

- [ ] **Step 1: Create categories page**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/categories
```

Create file `expense-tracker/src/app/categories/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { CategoryList } from '@/components/categories/CategoryList';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { Button } from '@/components/ui/Button';
import { useCategories } from '@/hooks/useCategories';
import { Category, CreateCategoryInput } from '@/types';

export default function CategoriesPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();

  // TODO: Get from user preferences
  const language = 'zh';

  const labels = {
    en: { title: 'Categories', add: 'Add Category' },
    zh: { title: '分類管理', add: '新增分類' },
  };

  const t = labels[language];

  const handleAdd = () => {
    setEditingCategory(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm(language === 'zh' ? '確定要刪除此分類？' : 'Delete this category?')) {
      await deleteCategory(id);
    }
  };

  const handleSubmit = async (data: CreateCategoryInput) => {
    if (editingCategory) {
      await updateCategory(editingCategory.id, data);
    } else {
      await createCategory(data);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white border-b px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t.title}</h1>
            <Button size="sm" onClick={handleAdd}>
              + {t.add}
            </Button>
          </div>
        </header>

        <main className="p-4">
          <CategoryList
            categories={categories}
            language={language}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </main>

        <CategoryForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          category={editingCategory}
          language={language}
        />
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/categories/page.tsx
git commit -m "feat: add categories management page"
```

---

### Task 5.4: AI Category Suggestion API

**Files:**
- Create: `expense-tracker/src/app/api/suggest-category/route.ts`

- [ ] **Step 1: Create suggestion API (simple pattern matching first)**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/api/suggest-category
```

Create file `expense-tracker/src/app/api/suggest-category/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { readSheet } from '@/lib/sheets';

async function verifyAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.email || null;
  } catch {
    return null;
  }
}

// Simple keyword-based suggestions
const KEYWORD_PATTERNS: Record<string, string[]> = {
  'Eating Out': ['restaurant', 'lunch', 'dinner', 'breakfast', '餐廳', '午餐', '晚餐', '早餐', 'cafe', '咖啡'],
  'Groceries': ['supermarket', 'grocery', '超市', '市場', 'costco', '全聯', '家樂福'],
  'Transportation': ['uber', 'taxi', 'bus', 'mrt', 'metro', '計程車', '公車', '捷運', 'grab', 'bolt'],
  'Digital': ['netflix', 'spotify', 'youtube', 'subscription', '訂閱', 'app', 'software'],
  'Medical': ['doctor', 'hospital', 'pharmacy', 'medicine', '醫院', '診所', '藥局', '藥'],
  'Fuel': ['gas', 'petrol', 'fuel', '加油', '油'],
  'Shopping': ['amazon', 'shop', 'mall', '購物', '商場', 'pchome', 'momo'],
  'Entertainment': ['movie', 'cinema', 'concert', 'game', '電影', '遊戲', '演唱會'],
};

export async function POST(request: NextRequest) {
  const userEmail = await verifyAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { notes } = await request.json();

    if (!notes || typeof notes !== 'string') {
      return NextResponse.json({ suggestions: [] });
    }

    const lowerNotes = notes.toLowerCase();
    const suggestions: { category: string; confidence: number }[] = [];

    // Pattern matching
    for (const [category, keywords] of Object.entries(KEYWORD_PATTERNS)) {
      for (const keyword of keywords) {
        if (lowerNotes.includes(keyword.toLowerCase())) {
          suggestions.push({ category, confidence: 0.8 });
          break;
        }
      }
    }

    // Also check historical patterns
    const expensesData = await readSheet('Expenses');
    const historicalMatches: Record<string, number> = {};

    for (let i = 1; i < expensesData.length; i++) {
      const row = expensesData[i];
      const expenseNotes = (row[5] || '').toLowerCase();
      const expenseCategory = row[3];

      if (expenseNotes && expenseCategory) {
        // Simple word overlap check
        const noteWords = lowerNotes.split(/\s+/);
        const expenseWords = expenseNotes.split(/\s+/);
        const overlap = noteWords.filter(w => expenseWords.includes(w)).length;

        if (overlap > 0) {
          historicalMatches[expenseCategory] = (historicalMatches[expenseCategory] || 0) + overlap;
        }
      }
    }

    // Add historical suggestions
    for (const [category, score] of Object.entries(historicalMatches)) {
      if (!suggestions.find(s => s.category === category)) {
        suggestions.push({ category, confidence: Math.min(0.7, score * 0.1) });
      }
    }

    // Sort by confidence and return top 3
    suggestions.sort((a, b) => b.confidence - a.confidence);
    const topSuggestions = suggestions.slice(0, 3).map(s => s.category);

    return NextResponse.json({ suggestions: topSuggestions });
  } catch (error) {
    console.error('Error suggesting category:', error);
    return NextResponse.json({ error: 'Failed to suggest category' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/suggest-category/route.ts
git commit -m "feat: add AI category suggestion API"
```

---

## Chunk 6: Reports & Analytics

**🎨 Visual Companion:** Use for dashboard layout, pie chart styling, and trend chart design.

**End Result:**
- Reports page shows month selector dropdown (last 12 months)
- Monthly summary card: total, % change vs last month, top 5 categories
- Category pie chart with colors and legend
- Paid_by pie chart showing who paid what
- 6-month trend line chart
- All data updates when month selector changes

**Verification:**
1. Add 5+ expenses across 2+ months in Sheet manually
2. Open `/reports` → see current month summary
3. Pie charts show correct proportions
4. Change month selector → data updates
5. Trend chart shows both months with lines

**Visual Mockup (for companion):**
```
┌─────────────────────────────┐
│ Reports          [Feb 2026▼]│
├─────────────────────────────┤
│    Total: TWD 15,000        │
│    +12% vs last month       │
│    ─────────────────────    │
│    [==== Eating Out 40%    ]│
│    [=== Shopping 30%       ]│
│    [== Transport 20%       ]│
├─────────────────────────────┤
│    [Pie Chart: By Category] │
├─────────────────────────────┤
│    [Pie Chart: By Paid By]  │
├─────────────────────────────┤
│    [Line Chart: 6mo Trend]  │
└─────────────────────────────┘
```

---

### Task 6.1: Report Utility Functions

**Files:**
- Create: `expense-tracker/src/lib/reports.ts`

- [ ] **Step 1: Create report utilities**

Create file `expense-tracker/src/lib/reports.ts`:

```typescript
import { Expense, MonthlySummary, TrendDataPoint } from '@/types';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';

export function calculateMonthlySummary(
  expenses: Expense[],
  month: string // YYYY-MM format
): MonthlySummary {
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = startOfMonth(new Date(year, monthNum - 1));
  const monthEnd = endOfMonth(monthStart);
  const prevMonthStart = startOfMonth(subMonths(monthStart, 1));
  const prevMonthEnd = endOfMonth(prevMonthStart);

  // Filter expenses for current month
  const monthExpenses = expenses.filter(e => {
    const date = parseISO(e.date);
    return date >= monthStart && date <= monthEnd && e.status === 'confirmed';
  });

  // Filter expenses for previous month
  const prevMonthExpenses = expenses.filter(e => {
    const date = parseISO(e.date);
    return date >= prevMonthStart && date <= prevMonthEnd && e.status === 'confirmed';
  });

  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const previousMonthTotal = prevMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Calculate by category
  const categoryTotals: Record<string, number> = {};
  monthExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const byCategory = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Calculate by paid_by
  const paidByTotals: Record<string, number> = {};
  monthExpenses.forEach(e => {
    paidByTotals[e.paid_by] = (paidByTotals[e.paid_by] || 0) + e.amount;
  });

  const byPaidBy = Object.entries(paidByTotals)
    .map(([paid_by, amount]) => ({
      paid_by,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const changePercentage = previousMonthTotal > 0
    ? ((total - previousMonthTotal) / previousMonthTotal) * 100
    : 0;

  return {
    month,
    total,
    byCategory,
    byPaidBy,
    previousMonthTotal,
    changePercentage,
  };
}

export function calculateTrend(
  expenses: Expense[],
  months: number = 6
): TrendDataPoint[] {
  const result: TrendDataPoint[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const monthStr = format(monthDate, 'yyyy-MM');
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const monthExpenses = expenses.filter(e => {
      const date = parseISO(e.date);
      return date >= monthStart && date <= monthEnd && e.status === 'confirmed';
    });

    const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    result.push({
      month: monthStr,
      total,
    });
  }

  return result;
}

export function filterExpenses(
  expenses: Expense[],
  filters: {
    startDate?: string;
    endDate?: string;
    category?: string;
    paidBy?: string;
  }
): Expense[] {
  return expenses.filter(e => {
    if (filters.startDate && e.date < filters.startDate) return false;
    if (filters.endDate && e.date > filters.endDate) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.paidBy && e.paid_by !== filters.paidBy) return false;
    return true;
  });
}
```

- [ ] **Step 2: Install date-fns if not already**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
npm install date-fns
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports.ts
git commit -m "feat: add report calculation utilities"
```

---

### Task 6.2: Chart Components

**Files:**
- Create: `expense-tracker/src/components/reports/CategoryPieChart.tsx`
- Create: `expense-tracker/src/components/reports/TrendChart.tsx`
- Create: `expense-tracker/src/components/reports/MonthlySummary.tsx`

- [ ] **Step 1: Create CategoryPieChart**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/components/reports
```

Create file `expense-tracker/src/components/reports/CategoryPieChart.tsx`:

```typescript
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Language } from '@/types';

interface CategoryPieChartProps {
  data: { category: string; amount: number; percentage: number }[];
  language: Language;
  title: string;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export function CategoryPieChart({ data, language, title }: CategoryPieChartProps) {
  const chartData = data.slice(0, 10).map((item, index) => ({
    name: item.category,
    value: item.amount,
    percentage: item.percentage,
    color: COLORS[index % COLORS.length],
  }));

  const formatValue = (value: number) => `TWD ${value.toLocaleString()}`;

  return (
    <div className="bg-white rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatValue(value)}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TrendChart**

Create file `expense-tracker/src/components/reports/TrendChart.tsx`:

```typescript
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendDataPoint, Language } from '@/types';

interface TrendChartProps {
  data: TrendDataPoint[];
  language: Language;
}

export function TrendChart({ data, language }: TrendChartProps) {
  const title = language === 'zh' ? '支出趨勢' : 'Spending Trend';

  const formatMonth = (month: string) => {
    const [, m] = month.split('-');
    return language === 'zh' ? `${parseInt(m)}月` : month;
  };

  const formatValue = (value: number) => `TWD ${value.toLocaleString()}`;

  return (
    <div className="bg-white rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={formatMonth} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatValue(value)} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create MonthlySummary component**

Create file `expense-tracker/src/components/reports/MonthlySummary.tsx`:

```typescript
'use client';

import { MonthlySummary as MonthlySummaryType, Language } from '@/types';
import { cn } from '@/lib/utils';

interface MonthlySummaryProps {
  summary: MonthlySummaryType;
  language: Language;
}

export function MonthlySummaryCard({ summary, language }: MonthlySummaryProps) {
  const labels = {
    en: {
      total: 'Total',
      vsLastMonth: 'vs last month',
      topCategories: 'Top Categories',
    },
    zh: {
      total: '總支出',
      vsLastMonth: '較上月',
      topCategories: '主要分類',
    },
  };

  const t = labels[language];
  const isIncrease = summary.changePercentage > 0;
  const changeText = `${isIncrease ? '+' : ''}${summary.changePercentage.toFixed(1)}%`;

  return (
    <div className="bg-white rounded-lg p-4">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-500">{t.total}</p>
        <p className="text-3xl font-bold">TWD {summary.total.toLocaleString()}</p>
        <p
          className={cn(
            'text-sm',
            isIncrease ? 'text-red-500' : 'text-green-500'
          )}
        >
          {changeText} {t.vsLastMonth}
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{t.topCategories}</p>
        <div className="space-y-2">
          {summary.byCategory.slice(0, 5).map((item, index) => (
            <div key={item.category} className="flex items-center justify-between">
              <span className="text-sm">{item.category}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-16 text-right">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/
git commit -m "feat: add report chart components"
```

---

### Task 6.3: Reports Page

**Files:**
- Create: `expense-tracker/src/app/reports/page.tsx`

- [ ] **Step 1: Create reports page**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/reports
```

Create file `expense-tracker/src/app/reports/page.tsx`:

```typescript
'use client';

import { useState, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { MonthlySummaryCard } from '@/components/reports/MonthlySummary';
import { CategoryPieChart } from '@/components/reports/CategoryPieChart';
import { TrendChart } from '@/components/reports/TrendChart';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { useUsers } from '@/hooks/useUsers';
import { calculateMonthlySummary, calculateTrend } from '@/lib/reports';

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { expenses, loading: expensesLoading } = useExpenses();
  const { categories } = useCategories();
  const { users } = useUsers();

  // TODO: Get from user preferences
  const language = 'zh';

  const labels = {
    en: {
      title: 'Reports',
      byCategory: 'By Category',
      byPaidBy: 'By Paid By',
    },
    zh: {
      title: '報表',
      byCategory: '分類統計',
      byPaidBy: '付款人統計',
    },
  };

  const t = labels[language];

  const summary = useMemo(() => {
    return calculateMonthlySummary(expenses, selectedMonth);
  }, [expenses, selectedMonth]);

  const trend = useMemo(() => {
    return calculateTrend(expenses, 6);
  }, [expenses]);

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = subMonths(now, i);
      options.push(format(date, 'yyyy-MM'));
    }
    return options;
  }, []);

  if (expensesLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white border-b px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t.title}</h1>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1 border rounded-lg text-sm"
            >
              {monthOptions.map(month => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="p-4 space-y-4">
          <MonthlySummaryCard summary={summary} language={language} />

          <TrendChart data={trend} language={language} />

          <CategoryPieChart
            data={summary.byCategory}
            language={language}
            title={t.byCategory}
          />

          <CategoryPieChart
            data={summary.byPaidBy.map(item => ({
              category: users.find(u => u.email === item.paid_by)?.name || item.paid_by,
              amount: item.amount,
              percentage: item.percentage,
            }))}
            language={language}
            title={t.byPaidBy}
          />
        </main>
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/reports/page.tsx
git commit -m "feat: add reports page with charts"
```

---

## Chunk 7: Internationalization (i18n)

**End Result:**
- All UI text uses translation keys (no hardcoded strings)
- `en.json` and `zh.json` contain all translations
- LanguageContext provides current language and `t` function
- User's language preference loads from Users sheet on login
- Category names display in selected language (name_en or name_zh)

**Verification:**
1. Default to Chinese (zh) for new users
2. All buttons, labels, headers in Chinese
3. Toggle to English → all text changes to English
4. Category grid shows English names
5. Toggle back to Chinese → Chinese category names

**Translation Coverage:**
- Common: save, cancel, delete, edit, add, back, next
- Navigation: home, reports, categories, settings
- Home: title, addExpense, todayTotal, monthTotal
- Expense form: amount, category, date, paidBy, notes
- Reports: title, total, byCategory, byPaidBy, trend
- Settings: language, account, signOut
- Auth: signIn, accessDenied

---

### Task 7.1: Language Context

**Files:**
- Create: `expense-tracker/src/context/LanguageContext.tsx`
- Create: `expense-tracker/src/i18n/en.json`
- Create: `expense-tracker/src/i18n/zh.json`

- [ ] **Step 1: Create i18n files**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/i18n
```

Create file `expense-tracker/src/i18n/en.json`:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "back": "Back",
    "next": "Next",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success"
  },
  "nav": {
    "home": "Home",
    "reports": "Reports",
    "categories": "Categories",
    "settings": "Settings"
  },
  "home": {
    "title": "Expenses",
    "addExpense": "Add Expense",
    "todayTotal": "Today",
    "monthTotal": "This Month",
    "recentExpenses": "Recent Expenses",
    "noExpenses": "No expenses yet"
  },
  "expense": {
    "amount": "Amount",
    "category": "Category",
    "date": "Date",
    "paidBy": "Paid by",
    "notes": "Notes",
    "notesPlaceholder": "Enter notes..."
  },
  "reports": {
    "title": "Reports",
    "total": "Total",
    "vsLastMonth": "vs last month",
    "byCategory": "By Category",
    "byPaidBy": "By Paid By",
    "trend": "Spending Trend",
    "topCategories": "Top Categories"
  },
  "categories": {
    "title": "Categories",
    "addCategory": "Add Category",
    "editCategory": "Edit Category",
    "nameEn": "English Name",
    "nameZh": "Chinese Name",
    "icon": "Icon",
    "confirmDelete": "Delete this category?"
  },
  "settings": {
    "title": "Settings",
    "language": "Language",
    "account": "Account",
    "signOut": "Sign Out"
  },
  "auth": {
    "signIn": "Sign in with Google",
    "signingIn": "Signing in...",
    "accessDenied": "Access Denied",
    "notAuthorized": "Your account is not authorized to use this app."
  }
}
```

Create file `expense-tracker/src/i18n/zh.json`:

```json
{
  "common": {
    "save": "儲存",
    "cancel": "取消",
    "delete": "刪除",
    "edit": "編輯",
    "add": "新增",
    "back": "返回",
    "next": "下一步",
    "loading": "載入中...",
    "error": "錯誤",
    "success": "成功"
  },
  "nav": {
    "home": "首頁",
    "reports": "報表",
    "categories": "分類",
    "settings": "設定"
  },
  "home": {
    "title": "支出",
    "addExpense": "記帳",
    "todayTotal": "今日",
    "monthTotal": "本月",
    "recentExpenses": "最近記錄",
    "noExpenses": "尚無記錄"
  },
  "expense": {
    "amount": "金額",
    "category": "分類",
    "date": "日期",
    "paidBy": "付款人",
    "notes": "備註",
    "notesPlaceholder": "輸入備註..."
  },
  "reports": {
    "title": "報表",
    "total": "總支出",
    "vsLastMonth": "較上月",
    "byCategory": "分類統計",
    "byPaidBy": "付款人統計",
    "trend": "支出趨勢",
    "topCategories": "主要分類"
  },
  "categories": {
    "title": "分類管理",
    "addCategory": "新增分類",
    "editCategory": "編輯分類",
    "nameEn": "英文名稱",
    "nameZh": "中文名稱",
    "icon": "圖示",
    "confirmDelete": "確定要刪除此分類？"
  },
  "settings": {
    "title": "設定",
    "language": "語言",
    "account": "帳戶",
    "signOut": "登出"
  },
  "auth": {
    "signIn": "使用 Google 登入",
    "signingIn": "登入中...",
    "accessDenied": "拒絕存取",
    "notAuthorized": "您的帳戶無權使用此應用程式。"
  }
}
```

- [ ] **Step 2: Create LanguageContext**

Create file `expense-tracker/src/context/LanguageContext.tsx`:

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '@/types';
import { useAuth } from './AuthContext';
import { auth } from '@/lib/firebase';

import en from '@/i18n/en.json';
import zh from '@/i18n/zh.json';

type Translations = typeof en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const translations: Record<Language, Translations> = { en, zh };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh');
  const { user, isAuthorized } = useAuth();

  // Load language preference from server on auth
  useEffect(() => {
    async function loadLanguage() {
      if (user && isAuthorized) {
        try {
          const token = await auth.currentUser?.getIdToken();
          const response = await fetch('/api/auth/check', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();
          if (data.language) {
            setLanguageState(data.language as Language);
          }
        } catch {
          // Keep default
        }
      }
    }
    loadLanguage();
  }, [user, isAuthorized]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    // TODO: Persist to server via API
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
```

- [ ] **Step 3: Update root layout to include LanguageProvider**

Update `expense-tracker/src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Personal expense tracking app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/i18n/ src/context/LanguageContext.tsx src/app/layout.tsx
git commit -m "feat: add internationalization with LanguageContext"
```

---

## Chunk 8: Navigation, Settings & Deployment

**🎨 Visual Companion:** Use for bottom navigation layout and home page design.

**End Result:**
- Bottom navigation with 4 tabs: Home 🏠, Reports 📊, Categories 📁, Settings ⚙️
- Active tab highlighted in blue
- Navigation hidden on /login and /add pages
- Home page shows: header with stats, "Add Expense" button, recent expenses list
- Settings page shows: language toggle, user profile, sign out button
- App deploys to Firebase Hosting
- Deployed app accessible via public URL

**Verification:**
1. Bottom nav visible on home, reports, categories, settings
2. Bottom nav hidden on login and add pages
3. Tapping nav items navigates correctly
4. Active tab has blue highlight
5. Home page shows today's and month's totals
6. Recent expenses list shows last 10 with category emoji
7. `firebase deploy` succeeds
8. Open deployed URL → app loads and works

**Final E2E Test:**
1. Open deployed URL on mobile phone
2. Sign in with Google
3. Add expense: 150, Eating Out, "lunch"
4. Verify appears on home page
5. Check Google Sheet → row exists
6. View reports → see the expense in stats
7. Toggle language → all text changes
8. Sign out → redirects to login

---

### Task 8.1: Bottom Navigation Component

**Files:**
- Create: `expense-tracker/src/components/ui/BottomNav.tsx`

- [ ] **Step 1: Create BottomNav component**

Create file `expense-tracker/src/components/ui/BottomNav.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: '🏠', labelKey: 'home' as const },
  { href: '/reports', icon: '📊', labelKey: 'reports' as const },
  { href: '/categories', icon: '📁', labelKey: 'categories' as const },
  { href: '/settings', icon: '⚙️', labelKey: 'settings' as const },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  // Don't show on login or add pages
  if (pathname === '/login' || pathname === '/add') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t safe-area-pb">
      <div className="flex justify-around items-center h-16">
        {navItems.map(item => {
          const isActive = pathname === item.href;
          const label = t.nav[item.labelKey];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full',
                'transition-colors',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Add safe-area utility to globals.css**

Add to `expense-tracker/src/app/globals.css`:

```css
/* Add at the end of the file */
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom);
}
```

- [ ] **Step 3: Update root layout to include BottomNav**

Update `expense-tracker/src/app/layout.tsx` to include BottomNav:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { BottomNav } from '@/components/ui/BottomNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Personal expense tracking app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <LanguageProvider>
            {children}
            <BottomNav />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/BottomNav.tsx src/app/globals.css src/app/layout.tsx
git commit -m "feat: add bottom navigation"
```

---

### Task 8.2: Home Page

**Files:**
- Modify: `expense-tracker/src/app/page.tsx`

- [ ] **Step 1: Create home page**

Replace `expense-tracker/src/app/page.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/Button';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { useLanguage } from '@/context/LanguageContext';

export default function HomePage() {
  const { expenses, loading } = useExpenses();
  const { categories } = useCategories();
  const { t, language } = useLanguage();

  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(new Date(), 'yyyy-MM-01');

  const todayTotal = expenses
    .filter(e => e.date === today && e.status === 'confirmed')
    .reduce((sum, e) => sum + e.amount, 0);

  const monthTotal = expenses
    .filter(e => e.date >= monthStart && e.status === 'confirmed')
    .reduce((sum, e) => sum + e.amount, 0);

  const recentExpenses = expenses.slice(0, 10);

  const getCategoryDisplay = (categoryName: string) => {
    const cat = categories.find(c => c.name_en === categoryName);
    if (!cat) return { icon: '📦', name: categoryName };
    return {
      icon: cat.icon,
      name: language === 'zh' ? cat.name_zh : cat.name_en,
    };
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <header className="bg-blue-600 text-white px-4 py-6">
          <h1 className="text-xl font-bold mb-4">{t.home.title}</h1>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm opacity-80">{t.home.todayTotal}</p>
              <p className="text-2xl font-bold">TWD {todayTotal.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm opacity-80">{t.home.monthTotal}</p>
              <p className="text-2xl font-bold">TWD {monthTotal.toLocaleString()}</p>
            </div>
          </div>
        </header>

        {/* Add button */}
        <div className="px-4 -mt-4">
          <Link href="/add">
            <Button size="lg" className="w-full shadow-lg">
              + {t.home.addExpense}
            </Button>
          </Link>
        </div>

        {/* Recent expenses */}
        <main className="p-4">
          <h2 className="text-lg font-semibold mb-3">{t.home.recentExpenses}</h2>

          {recentExpenses.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{t.home.noExpenses}</p>
          ) : (
            <div className="space-y-2">
              {recentExpenses.map(expense => {
                const { icon, name } = getCategoryDisplay(expense.category);
                return (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between bg-white p-3 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <div className="font-medium">{name}</div>
                        <div className="text-sm text-gray-500">
                          {expense.date} · {expense.notes || '-'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        TWD {expense.amount.toLocaleString()}
                      </div>
                      {expense.status === 'pending' && (
                        <span className="text-xs text-yellow-600">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add home page with expense list and stats"
```

---

### Task 8.3: Settings Page

**Files:**
- Create: `expense-tracker/src/app/settings/page.tsx`

- [ ] **Step 1: Create settings page**

```bash
mkdir -p /Users/ijac/Claude-ijac/expense-sheet/expense-tracker/src/app/settings
```

Create file `expense-tracker/src/app/settings/page.tsx`:

```typescript
'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Language } from '@/types';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white border-b px-4 py-4">
          <h1 className="text-xl font-bold">{t.settings.title}</h1>
        </header>

        <main className="p-4 space-y-4">
          {/* Language setting */}
          <div className="bg-white rounded-lg p-4">
            <h2 className="font-semibold mb-3">{t.settings.language}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 py-2 px-4 rounded-lg border ${
                  language === 'en'
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-200'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('zh')}
                className={`flex-1 py-2 px-4 rounded-lg border ${
                  language === 'zh'
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-200'
                }`}
              >
                繁體中文
              </button>
            </div>
          </div>

          {/* Account info */}
          <div className="bg-white rounded-lg p-4">
            <h2 className="font-semibold mb-3">{t.settings.account}</h2>
            <div className="flex items-center gap-3">
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <div className="font-medium">{user?.displayName}</div>
                <div className="text-sm text-gray-500">{user?.email}</div>
              </div>
            </div>
          </div>

          {/* Sign out */}
          <Button variant="outline" onClick={handleSignOut} className="w-full">
            {t.settings.signOut}
          </Button>
        </main>
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add settings page"
```

---

### Task 8.4: Firebase Deployment

- [ ] **Step 1: Build the application**

```bash
cd /Users/ijac/Claude-ijac/expense-sheet/expense-tracker
npm run build
```

Expected: Build succeeds with no errors

- [ ] **Step 2: Test locally with Firebase emulator (optional)**

```bash
firebase emulators:start
```

- [ ] **Step 3: Deploy to Firebase**

```bash
firebase deploy --only hosting
```

Expected: Deployment succeeds, URL provided

- [ ] **Step 4: Test deployed application**

1. Open the deployed URL
2. Sign in with Google
3. Add an expense
4. Verify it appears in Google Sheet
5. View reports

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: production ready - Phase 1 complete"
```

---

## Summary

Phase 1 implementation complete. The app includes:

- **Authentication:** Google Sign-In with user validation against Users sheet
- **Expense Recording:** Multi-step form with calculator, category selection
- **Category Management:** View, add, edit, delete categories
- **Reports:** Monthly summary, category pie charts, spending trend
- **Internationalization:** English and Traditional Chinese support
- **Mobile-First UI:** Bottom navigation, responsive design

**Next Phase:** Subscription management and Gmail invoice scanning (see design spec).
