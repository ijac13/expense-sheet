---
id: "011"
title: Navigation and Pages
status: ideation
source: commission seed
started:
completed:
verdict:
score: 1.0
worktree:
issue:
pr:
---

Every feature lives somewhere in the app. Without a defined page structure and navigation, each feature makes its own assumptions and they won't be consistent. This entity defines the full page map once so all other features can reference it.

## Success

- Bottom tab bar is in place with all tabs defined
- Every feature knows which page and tab it belongs to
- Navigation between pages works correctly on mobile
- Sign-in intercepts navigation for unauthenticated users
- Settings page exists with the right sections

### Out of Scope

- The content of each page — that belongs to each feature entity
- Auth logic — entity 006
- Bilingual tab/page labels — entity 007

## Plan

### Navigation Pattern

Bottom tab bar — standard mobile pattern, always visible, 4–5 tabs.

### Tabs and Pages

| Tab | Pages | Notes |
|-----|-------|-------|
| **Home** | Entry form + today's expense list | Opens directly to entry UI |
| **History** | Past expenses by date | TBD: own tab or under Home? |
| **Subscriptions** | Recurring expense list + add/edit | Entity 004 |
| **Reports** | Monthly summary, trends, deep-dives | Entity 005 |
| **Settings** | Categories, users, language | Entities 003, 006, 007 |

### Open Questions

- **History tab** — is expense history its own tab, or does it live under Home (scroll down past today to see older entries)?
- **Settings contents** — what sections live in Settings? Categories management, user management, language toggle?
- **Tab count** — 4 tabs (Home, Reports, Subscriptions, Settings) or 5 (add History)?
