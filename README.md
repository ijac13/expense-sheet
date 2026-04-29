# Expense Sheet

## Why I built this

I've tracked my expenses for many years. The tools changed over time, but the analysis always ended up in a spreadsheet anyway — Google Sheets. At some point I realized what I actually wanted was a simple mobile UI to reduce the friction of logging expenses on the go, feeding data into a spreadsheet I already know how to analyze.

Third-party apps do a fine job at tracking and visualization. But when I need the raw data — to plan for retirement, to understand what I'm actually spending on, to run my own analysis — I have to export it first, and the structure is always a mystery until I do. That felt wrong.

**Owning the data matters to me.** It's a privacy thing. I don't want anyone else to know how my household spends money. And this is a household app — my husband and I share one budget, and we want full transparency between us. Not an app that shows each of us a filtered view, but one shared record we both contribute to and can both see completely.

Expense tracking is personal. Everyone has different categories, different habits, different ways they want to look at the numbers. Building your own means it fits exactly how you think, and the data is yours to do whatever you want with — query it, analyze it, feed it to an AI, export it, keep it forever.

One thing the agent convinced me of: a single Google Sheet is more than enough for 20 years of expense tracking. No database needed. Just one spreadsheet you already know how to use.

---

A household expense tracker for two, built on Next.js, Firebase, and Google Sheets.

## What it does

- Log expenses by category with a mobile-first calculator UI
- Track recurring subscriptions
- Reports with donut/bar charts, category drill-down, and payer breakdown
- AI-generated spending insights (Claude API)
- History with filter, search, edit, and delete
- Google Sign-in — access limited to two authorized household emails
- Bilingual: English / 繁體中文
- Data lives in Google Sheets — yours to query, export, or analyze however you want

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (static export), TypeScript, Tailwind CSS v4, daisyUI v5 |
| Backend | Firebase Cloud Functions Gen 2 (Node 20) |
| Data | Google Sheets (Expenses, Subscriptions, Users tabs) |
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

Key environment variables (never committed):

- `NEXT_PUBLIC_FIREBASE_*` — Firebase project config (client-side)
- `NEXT_PUBLIC_SPREADSHEET_ID` — Google Sheets ID (links to sheet from Settings)
- `SPREADSHEET_ID` — Google Sheets ID (functions)
- `ANTHROPIC_API_KEY` — stored in Firebase Secret Manager

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
