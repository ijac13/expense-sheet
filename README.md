# Expense Sheet

A household expense tracker for two, built on Next.js, Firebase, and Google Sheets.

## What it does

- Log expenses by category with a mobile-first calculator UI
- Track recurring subscriptions
- Reports with donut/bar charts, category drill-down, and payer breakdown
- AI-generated spending insights (Claude API)
- History with filter and search
- Google Sign-in — access limited to two authorized household emails
- Bilingual: English / 繁體中文

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (static export), TypeScript, Tailwind CSS v4, daisyUI v5 |
| Backend | Firebase Cloud Functions Gen 2 (Node 20) |
| Data | Google Sheets (Expenses, Subscriptions, Users, Categories tabs) |
| Auth | Firebase Auth — Google Sign-in |
| AI | Anthropic Claude API (spending insights) |
| Hosting | Firebase Hosting |

## Project structure

```
expense-sheet/
├── app/              # Next.js frontend
│   └── app/
│       ├── components/
│       ├── lib/          # services, auth context, data types
│       ├── history/
│       ├── reports/
│       ├── settings/
│       └── subscriptions/
├── functions/        # Firebase Cloud Functions
│   └── src/index.ts  # API routes: expenses, subscriptions, users, insights
├── workflow/         # Spacedock project workflow (entities + plan)
└── firebase.json
```

## Setup

See `SETUP.md` for full environment setup instructions.

Key environment variables (never committed — see `.env.example`):

- `NEXT_PUBLIC_FIREBASE_*` — Firebase project config (client-side)
- `SPREADSHEET_ID` — Google Sheets ID (functions)
- `ANTHROPIC_API_KEY` — stored in Firebase Secret Manager, not in env files

## Development

```bash
# Frontend
cd app && npm install && npm run dev

# Functions (in a separate terminal)
cd functions && npm install && npm run build:watch
```

## Deploy

```bash
# Frontend only
firebase deploy --only hosting

# Functions only
firebase deploy --only functions

# Both
firebase deploy --only functions,hosting
```

## Authorized users

Access is restricted to emails defined in `app/app/lib/users.ts`. Any other Google account gets an "Access Denied" screen.
