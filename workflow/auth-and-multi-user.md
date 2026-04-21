---
id: "006"
title: Auth and Multi-User
status: ideation
source: commission seed
started:
completed:
verdict:
score: 0.9
worktree:
issue:
pr:
---

Both my husband and I need to log expenses independently on our own phones and see each other's entries. Sign in with Google. Access controlled by whether your email is in the Users sheet. All authorized users see all expenses. Every expense has a "paid by" field so we know who actually spent the money — important for the reports to make sense.

## User Stories

- As a user, I want to sign in with my Google account so I don't need to manage a separate password
- As a user, I want to be automatically signed out after inactivity so my financial data is protected on a shared or unattended phone
- As a user, I want to see my husband's expenses and have him see mine so we have a shared view of household spending
- As an unauthorized user, I want to be blocked from accessing the app so our private data stays private

## Success

- Sign in with Google works on mobile browser in iOS and Andriod
- Only emails listed in the Users tab can access the app — any other Google account is rejected after sign-in
- Session auto-expires after 1 minute of inactivity
- Reports screen requires Google re-authentication before loading
- Both users see all expenses, categories, and subscriptions
- Each expense records `created_by` (who logged it) and `paid_by` (who paid) — these can be different people
- User management is visible in Settings → User management (view only — adding/removing users is done directly in the Users tab)

### Out of Scope

- Registering new users from within the app — done by editing the Users tab directly in Google Sheets
- Role-based permissions — all authorized users have equal access
- Sharing with more than 2 users — designed for 2, but the Users tab supports more if needed
- Password-based login — Google Sign-In only

## Plan

### Sign-In Flow

1. App loads → check Firebase Auth session
2. If no session → show sign-in screen with "Sign in with Google" button
3. After Google sign-in → Firebase Auth returns the user's email
4. Firebase Function checks the email against the Users tab
5. If email found → allow access, load the app
6. If email not found → sign out immediately, show "Access denied" message

### Session Management

- Firebase Auth tokens expire after 1 hour — not extended
- App tracks last activity timestamp in memory (not localStorage)
- After 1 minute of inactivity → auto sign-out, redirect to sign-in screen
- Activity = any tap or navigation event

### Re-auth for Reports

Before the Reports screen loads, trigger a Google re-authentication prompt. If the user completes it, proceed. If cancelled, stay on previous screen.

### User Management Screen (Settings)

Read-only view of who has access:
- List of emails from the Users tab with display names
- No add/remove UI — users are managed directly in the Google Sheet

### Users Tab

Defined in `project-setup.md`. The captain adds/removes users by editing this tab directly. The app reads it on every auth check.

## Open Questions

- **Access denied message** — when an unauthorized Google account signs in, what should the message say? Generic error or something specific like "This account isn't authorized — contact [name] to be added"?
- **Inactivity timer** — 1 minute was decided in project setup. Still feel right in practice, or too aggressive?
- **Re-auth for reports** — does Reports require Google re-auth every time the tab is opened, or just once per session?
- **Two-user assumption** — the app is designed for exactly 2 users. If a 3rd person needs temporary access (e.g., a house-sitter), how should that work?
