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

5 tabs, always visible in the bottom bar:

| Tab | Content | Entity |
|-----|---------|--------|
| **Home** | Entry form + today's expense list | 002 |
| **History** | Plain expense list — date, who billed, who paid, amount, category | — |
| **Subscriptions** | Recurring expense list + add/edit | 004 |
| **Reports** | Monthly summary, trends, deep-dives | 005 |
| **Settings** | Categories, user management, language toggle | 003, 006, 007 |

### Settings Sections

- Category management — view, create, edit, archive categories (entity 003)
- User management — see who has access (entity 006)
- Language toggle — EN/繁中 (entity 007)
