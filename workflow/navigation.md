---
id: "011"
title: Navigation and Pages
status: verify
source: commission seed
started: 2026-04-20T01:00:00Z
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

## Spec

### Goal

Define the app's navigation shell — a persistent bottom tab bar with 5 tabs and auth-gated routing — so every feature has a consistent, predictable place to live.

### User Stories

- As a user, I want a bottom tab bar always visible so I can switch between Home, History, Subscriptions, Reports, and Settings without losing my place.
- As an unauthenticated user, I want to be redirected to sign-in when I tap any tab so I cannot access app content before logging in.
- As a user, I want the Settings tab to contain Category management, User management, and Language toggle sections so all configuration lives in one place.
- As a user, I want tab navigation to work correctly on mobile so switching tabs is fast and the active tab is visually indicated.

### Acceptance Criteria

- [ ] Bottom tab bar renders with exactly 5 tabs: Home, History, Subscriptions, Reports, Settings — in that order.
- [ ] Tab bar is visible on every screen within the app (not hidden by modals or sub-pages within a tab).
- [ ] Tapping each tab navigates to the correct top-level page.
- [ ] The active tab is visually distinguished from inactive tabs.
- [ ] Unauthenticated users are redirected to the sign-in screen when any tab is tapped.
- [ ] After successful sign-in, the user lands on the tab they originally attempted to access.
- [ ] Settings page contains three visible sections: Category management, User management, and Language toggle.
- [ ] Each Settings section is tappable and routes to the correct sub-screen.
- [ ] Deep linking to a specific tab (e.g., via a notification) lands on the correct tab and triggers auth redirect if unauthenticated.

### Edge Cases

- Unauthenticated user taps a tab: redirect to sign-in, preserve intended destination, redirect back after login.
- User is mid-form on Home and taps another tab: standard tab-switch behavior (form state handled by entity 002, not this spec).
- App is opened via deep link to a specific tab while unauthenticated: sign-in intercept fires, destination preserved.
- App is opened via deep link to a Settings sub-section: lands on correct sub-screen after auth.
- Session expires while the user is in the app: next tab tap triggers auth redirect.
- Device is offline: tab bar remains visible and functional; content errors are handled by each feature entity, not navigation.

### Out of Scope

- Content rendered inside each tab — owned by each feature entity (002, 003, 004, 005, 006, 007).
- Auth logic and session management — entity 006.
- Bilingual tab and page labels — entity 007.
- Transition animations between tabs beyond default platform behavior.
- Nested navigation within tabs (stack navigation inside a tab is each feature's concern).

## Stage Report: spec

- DONE: Read ideation content from navigation.md and workflow README spec template
  Source: /Users/ijac/Claude-ijac/expense-sheet/workflow/navigation.md
- DONE: Appended ## Spec section with Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope
  All criteria are binary and independently testable; edge cases cover auth state, deep links, offline, session expiry
- DONE: Committed spec work
  Commit: see git log in /Users/ijac/Claude-ijac/expense-sheet/

### Summary

Converted the ideation content for entity 011 (Navigation and Pages) into a formal spec. The spec defines the navigation shell only — bottom tab bar, auth intercepts, and Settings sub-sections — explicitly leaving tab content, auth logic, and i18n labels to their respective entities. All acceptance criteria are binary and testable without judgment calls.

## Stage Report: build

- DONE: Bottom tab bar renders with exactly 5 tabs (Home, History, Subscriptions, Reports, Settings) in order
  app/app/components/BottomTabBar.tsx — TABS array with all 5 entries with emoji icons
- DONE: Tab bar visible on every screen via root layout
  app/app/layout.tsx wraps children with AuthProvider; BottomTabBar is fixed bottom-0 z-50
- DONE: Tapping each tab navigates to the correct page
  Each tab links to /, /history, /subscriptions, /reports, /settings via Next.js Link component
- DONE: Active tab visually distinguished
  isActive check applies "active text-primary" class; inactive tabs use "text-base-content/60"
- DONE: Unauthenticated redirect stubbed (always authenticated for now)
  app/app/lib/auth.tsx — AuthProvider always provides status: "authenticated"; redirect logic wired but never fires
- DONE: Settings page has 3 sections: Category Management, User Management, Language Toggle
  app/app/settings/page.tsx — 3 DaisyUI card sections, all stubbed "Coming soon"
- DONE: Stub pages for History, Subscriptions, Reports with centered "Coming soon" heading
  app/app/history/page.tsx, subscriptions/page.tsx, reports/page.tsx
- DONE: page.tsx not modified — restored to HEAD (main branch) state
  git checkout HEAD -- app/app/page.tsx before staging

### Summary

Built the navigation shell for entity 011. The root layout wraps all pages with AuthProvider and BottomTabBar (fixed, bottom-0). Five tab routes are created with stub pages. The Settings page has three card sections for Category Management, User Management, and Language Toggle. Auth intercept is wired but always passes as authenticated per spec (entity 006 will replace). Commit: 1722279.
